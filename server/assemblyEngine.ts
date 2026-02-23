import OpenAI from "openai";
import { storage } from "./storage";
import type { AssemblyLine, AssemblyLineStep, Product, Agent } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
    if (allAgents.length === 0) {
      const userAgents = await storage.getAgentsByUser(assemblyLine.ownerId);
      agent = userAgents[0];
    } else {
      agent = allAgents[0];
    }
  }

  const agentContext = agent
    ? `You are ${agent.name}. ${agent.description || ""} Your capabilities: ${(agent.capabilities || []).join(", ")}.`
    : "You are an autonomous AI agent.";

  const previousWork = previousOutputs.length > 0
    ? `\n\nPREVIOUS STEPS OUTPUT:\n${previousOutputs.map((o, i) => `--- Step ${i + 1} ---\n${o}`).join("\n\n")}`
    : "";

  const systemPrompt = `${agentContext}

You are working on an assembly line called "${assemblyLine.name}".
Assembly line description: ${assemblyLine.description || "No description"}

Product being built: "${product.name}"
Product request: ${product.inputRequest || "No specific request"}

You are executing Step ${step.stepOrder}: "${step.instructions || "Complete this step"}"
Department: ${step.departmentRoom}
${step.toolName ? `Tool: ${step.toolName}` : ""}
${previousWork}

Execute this step thoroughly. Produce substantive, detailed, actionable output. This is real work that will be used in the final product. Do not produce placeholders or summaries of what you would do — actually do the work.

If this is a research step, provide actual findings, data points, and analysis.
If this is a writing step, produce the actual written content.
If this is a code step, write actual code.
If this is a design step, provide detailed specifications and descriptions.
If this is a review step, provide specific, constructive feedback on the previous work.

Your output should be comprehensive and ready to hand off to the next step.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Execute step ${step.stepOrder}: ${step.instructions || "Complete this step of the assembly line."}` },
    ],
    max_tokens: 4096,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content || "No output generated.";
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

  const finalOutput = previousOutputs.join("\n\n---\n\n");
  await storage.updateProduct(productId, {
    status: "completed",
    finalOutput,
    completedAt: new Date(),
  } as any);

  return { success: true, message: `Product "${product.name}" completed with ${sortedSteps.length} steps` };
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
      const allOutputs = updatedSteps.sort((a, b) => a.stepOrder - b.stepOrder).map(s => s.output || "").filter(Boolean);
      await storage.updateProduct(product.id, {
        status: "completed",
        finalOutput: allOutputs.join("\n\n---\n\n"),
        completedAt: new Date(),
      } as any);
    }

    return { success: true, output, message: `Step ${step.stepOrder} completed` };
  } catch (error: any) {
    await storage.updateAssemblyLineStep(step.id, { status: "failed", output: `Error: ${error.message}` } as any);
    return { success: false, output: "", message: `Step failed: ${error.message}` };
  }
}
