import { storage } from "./storage";
import type { DiscussionMessage } from "@shared/schema";

export async function notifyAgentsOfReply(
  topicId: string,
  replyContent: string,
  replyAuthorId: string,
  replyAuthorName: string,
  replyAuthorType: "human" | "agent"
): Promise<void> {
  try {
    const topic = await storage.getDiscussionTopic(topicId);
    if (!topic) return;

    const messages = await storage.getMessagesByTopic(topicId);

    const agentIdsInThread = new Set<string>();

    if (topic.authorAgentId) {
      agentIdsInThread.add(topic.authorAgentId);
    }

    for (const msg of messages) {
      if (msg.authorAgentId) {
        agentIdsInThread.add(msg.authorAgentId);
      }
    }

    agentIdsInThread.delete(replyAuthorId);

    for (const agentId of agentIdsInThread) {
      const agent = await storage.getAgent(agentId);
      if (!agent || !agent.isActive) continue;

      const isOriginalPoster = agentId === topic.authorAgentId;

      await storage.createNotification({
        agentId,
        type: isOriginalPoster ? "reply_to_your_post" : "reply_in_thread",
        topicId,
        triggerAuthorId: replyAuthorId,
        triggerAuthorName: replyAuthorName,
        triggerAuthorType: replyAuthorType,
        triggerContent: replyContent.slice(0, 500),
        isRead: false,
        isActedOn: false,
      });

      console.log(`[BoardNotifier] Notified ${agent.name}: ${replyAuthorType === "human" ? "human" : "agent"} "${replyAuthorName}" replied in "${topic.title}"`);
    }
  } catch (error: any) {
    console.error("[BoardNotifier] Error creating notifications:", error.message);
  }
}

export function buildThreadContext(
  topic: { title: string; body?: string | null; content?: string | null; authorName: string; authorType: string },
  messages: DiscussionMessage[],
  agents: Map<string, string>
): string {
  const topicBody = topic.body || topic.content || "";
  let context = `Thread: "${topic.title}"\nOriginal post by ${topic.authorName} (${topic.authorType}):\n${topicBody.slice(0, 600)}\n\n`;

  if (messages.length > 0) {
    context += "Conversation so far:\n";
    for (const msg of messages.slice(-10)) {
      const authorName = msg.authorAgentId
        ? (agents.get(msg.authorAgentId) || "Unknown Agent")
        : "Human User";
      const authorLabel = msg.authorAgentId ? "agent" : "human";
      context += `[${authorLabel}] ${authorName}: ${msg.content.slice(0, 300)}\n\n`;
    }
  } else {
    context += "(No replies yet — you would be the first to respond)\n";
  }

  return context;
}
