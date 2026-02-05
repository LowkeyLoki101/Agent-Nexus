import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Bot, X, Cpu } from "lucide-react";
import { Link } from "wouter";
import type { Workspace } from "@shared/schema";

const CAPABILITY_OPTIONS = [
  "read",
  "write",
  "execute",
  "publish",
  "research",
  "analyze",
  "communicate",
  "manage_tokens",
  "conversation",
  "creative_writing",
  "code_assistance",
  "analysis",
  "content_generation",
];

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI (ChatGPT)", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { value: "anthropic", label: "Anthropic (Claude)", models: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"] },
  { value: "xai", label: "xAI (Grok)", models: ["grok-2-1212", "grok-beta"] },
];

export default function AgentNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [provider, setProvider] = useState("openai");
  const [modelName, setModelName] = useState("gpt-4o");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [newCapability, setNewCapability] = useState("");

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      description: string; 
      workspaceId: string; 
      provider: string;
      modelName: string;
      capabilities: string[];
      isActive: boolean;
    }) => {
      return apiRequest("POST", "/api/agents", data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/recent"] });
      toast({
        title: "Agent registered",
        description: `${name} has been registered and a room has been created.`,
      });
      setLocation("/agents");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to register agent",
        variant: "destructive",
      });
    },
  });

  const addCapability = (capability: string) => {
    if (capability && !capabilities.includes(capability)) {
      setCapabilities([...capabilities, capability]);
    }
    setNewCapability("");
  };

  const removeCapability = (capability: string) => {
    setCapabilities(capabilities.filter((c) => c !== capability));
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const providerConfig = PROVIDER_OPTIONS.find(p => p.value === newProvider);
    if (providerConfig) {
      setModelName(providerConfig.models[0]);
    }
  };

  const currentProviderModels = PROVIDER_OPTIONS.find(p => p.value === provider)?.models || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workspaceId) {
      toast({
        title: "Validation error",
        description: "Name and workspace are required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({ name, description, workspaceId, provider, modelName, capabilities, isActive });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-new-agent-title">
            Register Agent
          </h1>
          <p className="text-muted-foreground">
            Create a new autonomous agent and assign it a private room
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Agent Details</CardTitle>
              <CardDescription>
                Configure your agent's identity, AI provider, and capabilities
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="workspace">Studio</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger data-testid="select-workspace">
                  <SelectValue placeholder="Select a studio" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces?.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">AI Provider</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4" />
                          {p.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={modelName} onValueChange={setModelName}>
                  <SelectTrigger data-testid="select-model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentProviderModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="e.g., Research Agent, Creative Writer, Code Reviewer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-agent-name"
              />
              <p className="text-xs text-muted-foreground">
                You can create multiple agents with the same provider (e.g., two ChatGPT agents with different roles)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this agent does and its role in the team..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                data-testid="input-agent-description"
              />
            </div>

            <div className="space-y-4">
              <Label>Capabilities</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary" className="gap-1 pr-1">
                    {cap}
                    <button
                      type="button"
                      onClick={() => removeCapability(cap)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Select value={newCapability} onValueChange={(value) => addCapability(value)}>
                  <SelectTrigger className="flex-1" data-testid="select-capability">
                    <SelectValue placeholder="Add capability" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPABILITY_OPTIONS.filter((c) => !capabilities.includes(c)).map((cap) => (
                      <SelectItem key={cap} value={cap}>
                        {cap}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Activate this agent and assign it a private room
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-agent-active"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/agents">
                <Button type="button" variant="outline" data-testid="button-cancel">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-register-agent-submit"
              >
                {createMutation.isPending ? "Registering..." : "Register Agent"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
