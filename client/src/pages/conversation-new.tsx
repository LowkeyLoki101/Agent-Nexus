import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, MessageSquare, Bot } from "lucide-react";
import { Link } from "wouter";
import type { Workspace, Agent } from "@shared/schema";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(500).optional(),
  workspaceId: z.string().min(1, "Please select a studio"),
  participantAgentIds: z.array(z.string()).min(1, "Select at least one agent"),
  systemPrompt: z.string().optional(),
  mode: z.enum(["chat", "relay"]),
});

type FormData = z.infer<typeof formSchema>;

export default function ConversationNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const selectedWorkspace = workspaces?.find(w => w.id === selectedWorkspaceId);

  const { data: workspaceAgents, isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ["/api/workspaces", selectedWorkspace?.slug, "agents"],
    enabled: !!selectedWorkspace?.slug,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      workspaceId: "",
      participantAgentIds: [],
      systemPrompt: "",
      mode: "chat",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/conversations", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Conversation created",
        description: "Your new conversation is ready for agent collaboration.",
      });
      navigate(`/conversations/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/conversations">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-new-conversation-title">
            New Conversation
          </h1>
          <p className="text-muted-foreground">
            Create a new agent collaboration session
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversation Details
          </CardTitle>
          <CardDescription>
            Set up the parameters for your agent conversation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Project collaboration discussion..."
                        {...field}
                        data-testid="input-conversation-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What is this conversation about?"
                        className="resize-none"
                        {...field}
                        data-testid="input-conversation-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="workspaceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Studio</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedWorkspaceId(value);
                        form.setValue("participantAgentIds", []);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-workspace">
                          <SelectValue placeholder="Select a studio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {workspaces?.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the studio where this conversation will take place
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="participantAgentIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Participating Agents</FormLabel>
                    <div className="space-y-2">
                      {!selectedWorkspaceId ? (
                        <p className="text-sm text-muted-foreground">
                          Select a studio first to see available agents
                        </p>
                      ) : loadingAgents ? (
                        <p className="text-sm text-muted-foreground">
                          Loading agents...
                        </p>
                      ) : workspaceAgents && workspaceAgents.length > 0 ? (
                        workspaceAgents.map((agent) => (
                          <FormField
                            key={agent.id}
                            control={form.control}
                            name="participantAgentIds"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(agent.id)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValue, agent.id]);
                                      } else {
                                        field.onChange(
                                          currentValue.filter((id) => id !== agent.id)
                                        );
                                      }
                                    }}
                                    data-testid={`checkbox-agent-${agent.id}`}
                                  />
                                </FormControl>
                                <div className="flex items-center gap-2">
                                  <Bot className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{agent.name}</span>
                                  {agent.isVerified && (
                                    <span className="text-xs text-primary">Verified</span>
                                  )}
                                </div>
                              </FormItem>
                            )}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No agents found in this studio
                        </p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conversation Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-mode">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="chat">Chat (Interactive)</SelectItem>
                        <SelectItem value="relay">Relay (Autonomous)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Chat mode allows turn-by-turn responses. Relay mode runs multiple turns automatically.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Set the context or instructions for agents in this conversation..."
                        className="resize-none min-h-[100px]"
                        {...field}
                        data-testid="input-system-prompt"
                      />
                    </FormControl>
                    <FormDescription>
                      This prompt will guide how agents behave in this conversation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Link href="/conversations">
                  <Button type="button" variant="outline" data-testid="button-cancel">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-create"
                >
                  {createMutation.isPending ? "Creating..." : "Create Conversation"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
