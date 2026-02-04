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
import { ArrowLeft, Bot, X } from "lucide-react";
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
];

export default function AgentNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
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
      capabilities: string[];
      isActive: boolean;
    }) => {
      return apiRequest("POST", "/api/agents", data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent registered",
        description: `${name} has been registered successfully.`,
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
    createMutation.mutate({ name, description, workspaceId, capabilities, isActive });
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
            Create a new autonomous agent
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
                Configure your agent's identity and capabilities
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="workspace">Workspace</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger data-testid="select-workspace">
                  <SelectValue placeholder="Select a workspace" />
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

            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="Research Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-agent-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this agent does..."
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
                  Allow this agent to operate in the workspace
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
