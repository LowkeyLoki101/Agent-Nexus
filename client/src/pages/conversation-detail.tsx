import { useState, useRef, useEffect } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Send, Bot, User, Zap, Loader2, MessageSquare, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Conversation, Message, Agent } from "@shared/schema";

export default function ConversationDetail() {
  const [, params] = useRoute("/conversations/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [messageInput, setMessageInput] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationId = params?.id;

  const { data: conversation, isLoading: loadingConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  const { data: messages, isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
    refetchInterval: 3000,
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const participantAgents = agents?.filter(
    (agent) => conversation?.participantAgentIds?.includes(agent.id)
  );

  useEffect(() => {
    if (participantAgents?.length && !selectedAgentId) {
      setSelectedAgentId(participantAgents[0].id);
    }
  }, [participantAgents, selectedAgentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async ({ content, agentId }: { content: string; agentId: string }) => {
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/send`, {
        content,
        agentId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      setMessageInput("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const orchestrateMutation = useMutation({
    mutationFn: async ({ prompt, maxTurns }: { prompt: string; maxTurns: number }) => {
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/orchestrate`, {
        prompt,
        maxTurns,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      setMessageInput("");
      toast({
        title: "Relay complete",
        description: "Agents have completed their conversation.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to orchestrate conversation",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!messageInput.trim() || !selectedAgentId) return;
    sendMutation.mutate({ content: messageInput, agentId: selectedAgentId });
  };

  const handleOrchestrate = () => {
    if (!messageInput.trim()) return;
    orchestrateMutation.mutate({ prompt: messageInput, maxTurns: 2 });
  };

  const getAgentColor = (agentId: string | null) => {
    if (!agentId) return "bg-muted";
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-orange-500",
      "bg-pink-500",
    ];
    const index = participantAgents?.findIndex((a) => a.id === agentId) || 0;
    return colors[index % colors.length];
  };

  if (loadingConversation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-16 flex-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!conversation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-1">Conversation not found</h3>
          <Link href="/conversations">
            <Button variant="outline" className="mt-4">
              Back to Conversations
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/conversations">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-conversation-title">
              {conversation.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{conversation.status}</Badge>
              <span>{participantAgents?.length || 0} agents</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {participantAgents?.map((agent) => (
            <Badge
              key={agent.id}
              variant="secondary"
              className="gap-1"
              data-testid={`badge-agent-${agent.id}`}
            >
              <Bot className="h-3 w-3" />
              {agent.name}
            </Badge>
          ))}
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingMessages ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <Skeleton className="h-16 flex-1" />
                </div>
              ))}
            </div>
          ) : messages && messages.length > 0 ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
                data-testid={`message-${message.id}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={`${getAgentColor(message.agentId)} text-white`}>
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`flex flex-col max-w-[75%] ${
                    message.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <span className="text-xs text-muted-foreground mb-1">
                    {message.agentName || (message.role === "user" ? "You" : "Agent")}
                  </span>
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <MarkdownContent content={message.content || ""} />
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {message.createdAt
                      ? new Date(message.createdAt).toLocaleTimeString()
                      : ""}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4 shrink-0">
          {/* Relay mode hint */}
          {conversation.mode === "relay" && (!messages || messages.length === 0) && (
            <div className="flex items-start gap-3 mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">This is a relay conversation</p>
                <p className="text-muted-foreground">
                  Type a topic and click <strong>Start Relay</strong> to have all agents discuss it automatically.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {conversation.mode === "relay" ? (
              <>
                <Input
                  placeholder="Enter a topic for agents to discuss..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleOrchestrate();
                    }
                  }}
                  className="flex-1"
                  data-testid="input-message"
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleOrchestrate}
                      disabled={!messageInput.trim() || orchestrateMutation.isPending}
                      className="gap-2"
                      data-testid="button-orchestrate"
                    >
                      {orchestrateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Start Relay
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>All agents will take turns discussing this topic</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger className="w-[140px]" data-testid="select-agent">
                          <SelectValue placeholder="Ask one" />
                        </SelectTrigger>
                        <SelectContent>
                          {participantAgents?.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4" />
                                {agent.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Or send to just one agent</p>
                  </TooltipContent>
                </Tooltip>

                <Button
                  variant="outline"
                  onClick={handleSend}
                  disabled={!messageInput.trim() || !selectedAgentId || sendMutation.isPending}
                  data-testid="button-send"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </>
            ) : (
              <>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-[180px]" data-testid="select-agent">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {participantAgents?.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          {agent.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Type your message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1"
                  data-testid="input-message"
                />

                <Button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || !selectedAgentId || sendMutation.isPending}
                  data-testid="button-send"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
