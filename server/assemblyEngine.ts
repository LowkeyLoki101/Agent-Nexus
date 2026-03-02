import { storage } from "./storage";
import type { AssemblyLine, AssemblyLineStep, Product, Agent } from "@shared/schema";
import { executeTool } from "./toolEngine";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function synthesizeDeliverable(
  product: Product,
  assemblyLine: AssemblyLine,
  steps: AssemblyLineStep[],
  stepOutputs: string[]
): Promise<string> {
  const isWebsite = stepOutputs.some(o => o.includes("<!DOCTYPE html>") || o.includes("<html"));

  if (isWebsite) {
    const htmlOutput = stepOutputs.find(o => o.includes("<!DOCTYPE html>") || o.includes("<html"));
    if (htmlOutput) return htmlOutput;
  }

  const stepSummary = steps.map((s, i) => 
    `### Step ${s.stepOrder}: ${s.instructions || "No instructions"}\n${stepOutputs[i]?.slice(0, 1500) || "(no output)"}`
  ).join("\n\n---\n\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional editor and deliverable synthesizer. Your job is to take raw pipeline step outputs and transform them into a polished, cohesive final deliverable.

Rules:
- Combine all step outputs into ONE unified document
- Remove redundancy, repeated headers, and step-by-step artifacts
- Create a professional structure with clear sections
- Add an executive summary at the top
- Include actionable recommendations or conclusions
- Format with clean markdown headings, lists, and emphasis
- The output should read as a finished professional document, NOT as a collection of pipeline steps
- Preserve all substantive content, data, findings, and insights
- Remove meta-commentary about the pipeline process itself`
        },
        {
          role: "user",
          content: `Product: "${product.name}"
Assembly Line: "${assemblyLine.name}" — ${assemblyLine.description || ""}
Input Request: ${product.inputRequest || "None specified"}

Raw step outputs to synthesize:

${stepSummary}

Create a polished, professional final deliverable from these raw outputs. The result should be a complete, standalone document.`
        }
      ],
      max_tokens: 4096,
      temperature: 0.4,
    });

    const synthesized = response.choices[0]?.message?.content;
    if (synthesized && synthesized.length > 200) {
      console.log(`[AssemblyEngine] Synthesized deliverable for "${product.name}" (${synthesized.length} chars)`);
      return synthesized;
    }
  } catch (err: any) {
    console.log(`[AssemblyEngine] Synthesis failed for "${product.name}": ${err.message}, using concatenated output`);
  }

  return stepOutputs.join("\n\n---\n\n");
}

export async function executeStep(
  step: AssemblyLineStep,
  assemblyLine: AssemblyLine,
  product: Product,
  previousOutputs: string[]
): Promise<string> {
  let agent: Agent | undefined;
  if (step.assignedAgentId) {
    agent = await storage.getAgent(step.assignedAgentId);
  }
  if (!agent) {
    const allAgents = await storage.getAgentsByWorkspace(assemblyLine.ownerId);
    const candidates = allAgents.length > 0 ? allAgents : await storage.getAgentsByUser(assemblyLine.ownerId);

    if (candidates.length > 0) {
      const stepText = `${step.instructions || ""} ${step.toolName || ""} ${step.departmentRoom || ""} ${product.inputRequest || ""}`.toLowerCase();
      const researchKeywords = ["research", "scrape", "scraping", "web", "search", "find", "discover", "compile", "grant", "data", "investigate", "analyze", "report", "survey", "explore"];
      const codeKeywords = ["code", "build", "develop", "program", "engineer", "html", "css", "javascript", "app", "tool", "dashboard"];
      const writeKeywords = ["write", "copy", "content", "blog", "article", "story", "ebook", "narrative", "marketing"];
      const reviewKeywords = ["review", "critique", "assess", "evaluate", "audit", "compliance", "ethics", "security"];

      const needsResearch = researchKeywords.some(k => stepText.includes(k));
      const needsCode = codeKeywords.some(k => stepText.includes(k));
      const needsWriting = writeKeywords.some(k => stepText.includes(k));
      const needsReview = reviewKeywords.some(k => stepText.includes(k));

      const hasAny = (text: string, keywords: string[]) => keywords.some(k => text.includes(k));
      const capsMatch = (caps: string[], keywords: string[]) => caps.some(c => keywords.some(k => c.includes(k)));

      const scored = candidates.map(a => {
        const caps = (a.capabilities || []).map(c => c.toLowerCase());
        const desc = (a.description || "").toLowerCase();
        const combined = `${desc} ${caps.join(" ")} ${a.name.toLowerCase()}`;
        let score = 0;

        if (needsResearch && (capsMatch(caps, ["research", "investigat", "analyz", "discover", "scout"]) || hasAny(desc, ["research", "investigat", "scout", "web", "data", "analys"]))) score += 10;
        if (needsCode && (capsMatch(caps, ["code", "build", "develop", "program", "engineer"]) || hasAny(desc, ["builder", "engineer", "developer", "programmer", "code", "software"]))) score += 10;
        if (needsWriting && (capsMatch(caps, ["create", "write", "content", "generat", "author"]) || hasAny(desc, ["writer", "content", "copywrite", "author", "creative", "storytell"]))) score += 10;
        if (needsReview && (capsMatch(caps, ["review", "analyz", "audit", "assess", "evaluat"]) || hasAny(desc, ["critic", "ethics", "security", "compliance", "review", "audit"]))) score += 10;

        if (a.isActive) score += 2;

        return { agent: a, score };
      });

      scored.sort((a, b) => b.score - a.score);
      agent = scored[0].agent;
    }
  }

  const toolName = step.toolName || "text_generate";
  const instructions = `You are working on assembly line "${assemblyLine.name}" (${assemblyLine.description || "No description"}).
Product: "${product.name}" — ${product.inputRequest || "No specific request"}
Step ${step.stepOrder}: ${step.instructions || "Complete this step"}
Department: ${step.departmentRoom}`;

  const result = await executeTool(
    toolName,
    {
      instructions,
      previousOutputs,
      acceptanceCriteria: step.acceptanceCriteria || undefined,
      productContext: `Assembly Line: ${assemblyLine.name}\nProduct: ${product.name}\nStep ${step.stepOrder} of pipeline`,
    },
    agent || undefined,
    assemblyLine.ownerId
  );

  return result.output;
}

export async function runProductThroughPipeline(productId: string): Promise<{ success: boolean; message: string }> {
  const product = await storage.getProduct(productId);
  if (!product) return { success: false, message: "Product not found" };

  const assemblyLine = await storage.getAssemblyLine(product.assemblyLineId);
  if (!assemblyLine) return { success: false, message: "Assembly line not found" };

  const steps = await storage.getAssemblyLineSteps(assemblyLine.id);
  if (steps.length === 0) return { success: false, message: "No steps in assembly line" };

  const sortedSteps = steps.sort((a, b) => a.stepOrder - b.stepOrder);

  await storage.updateProduct(productId, { status: "in_progress" } as any);

  const previousOutputs: string[] = [];

  for (const step of sortedSteps) {
    if (step.status === "completed" && step.output) {
      previousOutputs.push(step.output);
      continue;
    }

    try {
      await storage.updateAssemblyLineStep(step.id, { status: "in_progress" } as any);

      const output = await executeStep(step, assemblyLine, product, previousOutputs);

      await storage.updateAssemblyLineStep(step.id, { status: "completed", output } as any);
      previousOutputs.push(output);
    } catch (error: any) {
      await storage.updateAssemblyLineStep(step.id, { status: "failed", output: `Error: ${error.message}` } as any);
      await storage.updateProduct(productId, { status: "failed" } as any);
      return { success: false, message: `Step ${step.stepOrder} failed: ${error.message}` };
    }
  }

  const finalOutput = await synthesizeDeliverable(product, assemblyLine, sortedSteps, previousOutputs);
  await storage.updateProduct(productId, {
    status: "completed",
    finalOutput,
    completedAt: new Date(),
  } as any);

  try {
    await notifyProductReady(product, assemblyLine, finalOutput);
  } catch (err: any) {
    console.log(`[AssemblyEngine] Notification failed for "${product.name}": ${err.message}`);
  }

  try {
    await autoListCompletedProduct(product, assemblyLine, sortedSteps, previousOutputs, finalOutput);
  } catch (err: any) {
    console.log(`[AssemblyEngine] Auto-list failed for "${product.name}": ${err.message}`);
  }

  return { success: true, message: `Product "${product.name}" completed with ${sortedSteps.length} steps` };
}

async function autoListCompletedProduct(
  product: Product,
  assemblyLine: AssemblyLine,
  steps: AssemblyLineStep[],
  stepOutputs: string[],
  finalOutput: string
): Promise<void> {
  const hasHtml = stepOutputs.some(o => o.includes("<!DOCTYPE html>") || o.includes("<html"));
  const htmlStep = stepOutputs.find(o => o.includes("<!DOCTYPE html>") || o.includes("<html"));

  const agent = steps[0]?.assignedAgentId
    ? await storage.getAgent(steps[0].assignedAgentId)
    : undefined;
  const buildAgent = steps.find(s => s.toolName === "website_build" || s.toolName === "html_build");
  const builderAgent = buildAgent?.assignedAgentId
    ? await storage.getAgent(buildAgent.assignedAgentId)
    : agent;

  const agentId = builderAgent?.id || agent?.id || steps[0]?.assignedAgentId || "";
  if (!agentId) return;

  const gift = await storage.createGift({
    agentId,
    workspaceId: null,
    title: product.name,
    description: product.description || `Product from assembly line: ${assemblyLine.name}`,
    type: hasHtml ? "code" : "text",
    status: "ready",
    content: finalOutput,
    toolUsed: hasHtml ? "website_build" : "text_generate",
    departmentRoom: "Assembly Line Output",
    inspirationSource: `Assembly Line: ${assemblyLine.name}`,
  });

  const isWebsiteProduct = hasHtml || assemblyLine.name.toLowerCase().includes("website") || assemblyLine.name.toLowerCase().includes("template");
  const isConsultingProduct = assemblyLine.name.toLowerCase().includes("improvement") || assemblyLine.name.toLowerCase().includes("consult");

  const listingType = isWebsiteProduct ? "template" : isConsultingProduct ? "knowledge" : "knowledge";
  const price = isWebsiteProduct ? 499 : isConsultingProduct ? 799 : 299;

  const slug = `${product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${Date.now().toString(36)}`;

  const reviewStep = stepOutputs[stepOutputs.length - 1] || "";
  const salesPitchMatch = reviewStep.match(/sales pitch[:\s]*(.+?)(?:\n|$)/i) ||
    reviewStep.match(/storefront.*?description[:\s]*(.+?)(?:\n|$)/i);
  const description = salesPitchMatch?.[1]?.trim() ||
    product.description ||
    `Professional ${isWebsiteProduct ? "website template" : "consulting deliverable"} from ${assemblyLine.name}`;

  await storage.createStorefrontListing({
    agentId,
    factoryOwnerId: assemblyLine.ownerId,
    sourceType: "gift",
    sourceId: gift.id,
    title: product.name,
    description,
    listingType,
    status: "published",
    price,
    currency: "usd",
    slug,
    previewContent: hasHtml
      ? `Complete professional website template with nav, hero, services, about, testimonials, contact form, and footer. Responsive design with modern CSS and animations.`
      : finalOutput.slice(0, 300),
    downloadContent: finalOutput,
    category: isWebsiteProduct ? "Website Templates" : isConsultingProduct ? "Consulting Kits" : "Digital Products",
    tags: isWebsiteProduct ? ["website", "template", "html", "responsive", "professional"] : ["consulting", "report", "improvement", "business"],
  });

  console.log(`[AssemblyEngine] Auto-listed "${product.name}" on storefront as ${listingType} at $${(price / 100).toFixed(2)}`);
}

async function notifyProductReady(product: Product, assemblyLine: AssemblyLine, finalOutput: string): Promise<void> {
  const hasHtml = finalOutput.includes("<!DOCTYPE html>") || finalOutput.includes("<html");
  const preview = hasHtml
    ? "A complete website template is ready for download."
    : finalOutput.slice(0, 300) + (finalOutput.length > 300 ? "..." : "");

  await storage.createFactoryNotification({
    userId: assemblyLine.ownerId,
    type: "deliverable_ready",
    title: `Deliverable Ready: ${product.name}`,
    message: `The assembly line "${assemblyLine.name}" has finished producing "${product.name}". Your synthesized deliverable is ready to download.\n\n${preview}`,
    source: "assembly_engine",
    sourceId: product.id,
    priority: "high",
    actionUrl: "/products",
  });
  console.log(`[AssemblyEngine] Notified user: deliverable ready for "${product.name}"`);
}

export async function notifyFactory(userId: string, type: "product_ready" | "product_stalled" | "product_failed" | "system_alert" | "agent_question" | "oversight_report" | "deliverable_ready" | "action_needed", title: string, message: string, opts?: { source?: string; sourceId?: string; priority?: string; actionUrl?: string }): Promise<void> {
  await storage.createFactoryNotification({
    userId,
    type,
    title,
    message,
    source: opts?.source || "factory_overseer",
    sourceId: opts?.sourceId,
    priority: opts?.priority || "normal",
    actionUrl: opts?.actionUrl,
  });
}

export async function executeSingleStep(stepId: string, productId?: string): Promise<{ success: boolean; output: string; message: string }> {
  const step = await storage.getAssemblyLineStepById(stepId);
  if (!step) return { success: false, output: "", message: "Step not found" };

  const assemblyLine = await storage.getAssemblyLine(step.assemblyLineId);
  if (!assemblyLine) return { success: false, output: "", message: "Assembly line not found" };

  const allSteps = await storage.getAssemblyLineSteps(assemblyLine.id);
  const sortedSteps = allSteps.sort((a, b) => a.stepOrder - b.stepOrder);

  const previousOutputs: string[] = [];
  for (const s of sortedSteps) {
    if (s.stepOrder < step.stepOrder && s.output) {
      previousOutputs.push(s.output);
    }
  }

  let product;
  if (productId) {
    product = await storage.getProduct(productId);
  }
  if (!product) {
    const products = await storage.getProductsByAssemblyLine(assemblyLine.id);
    const activeProduct = products.find(p => p.status === "in_progress") || products.find(p => p.status === "queued") || products[0];
    product = activeProduct;
  }
  if (!product) return { success: false, output: "", message: "No product found for this assembly line" };

  try {
    if (product.status === "queued") {
      await storage.updateProduct(product.id, { status: "in_progress" } as any);
    }
    await storage.updateAssemblyLineStep(step.id, { status: "in_progress" } as any);
    const output = await executeStep(step, assemblyLine, product, previousOutputs);
    await storage.updateAssemblyLineStep(step.id, { status: "completed", output } as any);

    const updatedSteps = await storage.getAssemblyLineSteps(assemblyLine.id);
    const allCompleted = updatedSteps.every(s => s.status === "completed");
    if (allCompleted) {
      const sortedCompleted = updatedSteps.sort((a, b) => a.stepOrder - b.stepOrder);
      const allOutputs = sortedCompleted.map(s => s.output || "").filter(Boolean);
      const synthesized = await synthesizeDeliverable(product, assemblyLine, sortedCompleted, allOutputs);
      await storage.updateProduct(product.id, {
        status: "completed",
        finalOutput: synthesized,
        completedAt: new Date(),
      } as any);
      try {
        await notifyProductReady(product, assemblyLine, synthesized);
      } catch {}
    }

    return { success: true, output, message: `Step ${step.stepOrder} completed` };
  } catch (error: any) {
    await storage.updateAssemblyLineStep(step.id, { status: "failed", output: `Error: ${error.message}` } as any);
    return { success: false, output: "", message: `Step failed: ${error.message}` };
  }
}
