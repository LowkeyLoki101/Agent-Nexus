import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Bot, 
  Search,
  Shield,
  Activity,
  MoreHorizontal,
  Video,
  Mic,
  Settings,
  Save,
  Loader2,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useState } from "react";
import type { Agent } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GraduationCap, Pencil, Power, PowerOff } from "lucide-react";

function AgentMediaSettings({ agent }: { agent: Agent }) {
  const { toast } = useToast();
  const [heygenAvatarId, setHeygenAvatarId] = useState(agent.heygenAvatarId || "");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState(agent.elevenLabsVoiceId || "");
  const [isOpen, setIsOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/agents/${agent.id}`, {
        heygenAvatarId: heygenAvatarId || null,
        elevenLabsVoiceId: elevenLabsVoiceId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Media identity updated", description: `${agent.name}'s digital identity saved.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const hasMediaIds = agent.heygenAvatarId || agent.elevenLabsVoiceId;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors w-full"
        data-testid={`button-media-settings-${agent.id}`}
      >
        <Settings className="h-3 w-3" />
        <span>{hasMediaIds ? "Media identity configured" : "Configure media identity"}</span>
        {hasMediaIds && (
          <div className="flex items-center gap-1 ml-auto">
            {agent.heygenAvatarId && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                <Video className="h-2.5 w-2.5" /> Avatar
              </Badge>
            )}
            {agent.elevenLabsVoiceId && (
              <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                <Mic className="h-2.5 w-2.5" /> Voice
              </Badge>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-3 p-3 rounded-lg border bg-muted/30" data-testid={`panel-media-settings-${agent.id}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-primary" /> Digital Identity
        </Label>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setIsOpen(false)}
        >
          Close
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`heygen-${agent.id}`} className="text-[11px] flex items-center gap-1 text-muted-foreground">
            <Video className="h-3 w-3" /> HeyGen Avatar ID
          </Label>
          <Input
            id={`heygen-${agent.id}`}
            placeholder="e.g. Kristin_pubblic_2_20240108"
            value={heygenAvatarId}
            onChange={(e) => setHeygenAvatarId(e.target.value)}
            className="h-8 text-xs"
            data-testid={`input-heygen-${agent.id}`}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`voice-${agent.id}`} className="text-[11px] flex items-center gap-1 text-muted-foreground">
            <Mic className="h-3 w-3" /> ElevenLabs Voice ID
          </Label>
          <Input
            id={`voice-${agent.id}`}
            placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
            value={elevenLabsVoiceId}
            onChange={(e) => setElevenLabsVoiceId(e.target.value)}
            className="h-8 text-xs"
            data-testid={`input-voice-${agent.id}`}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          data-testid={`button-save-media-${agent.id}`}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : updateMutation.isSuccess ? (
            <Check className="h-3 w-3" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          {updateMutation.isPending ? "Saving..." : updateMutation.isSuccess ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function AgentEditDialog({ agent, open, onOpenChange }: { agent: Agent; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || "");
  const [capabilities, setCapabilities] = useState((agent.capabilities || []).join(", "));
  const [provider, setProvider] = useState<"openai" | "anthropic" | "minimax">(agent.provider === "anthropic" ? "anthropic" : agent.provider === "minimax" ? "minimax" : "openai");
  const [modelName, setModelName] = useState(agent.modelName || "");
  const [identityCard, setIdentityCard] = useState(agent.identityCard || "");
  const [operatingPrinciples, setOperatingPrinciples] = useState(agent.operatingPrinciples || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/agents/${agent.id}`, {
        name,
        description: description || null,
        capabilities: capabilities.split(",").map(c => c.trim()).filter(Boolean),
        provider,
        modelName: modelName || null,
        identityCard: identityCard || null,
        operatingPrinciples: operatingPrinciples || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent updated", description: `${name} has been updated.` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-edit-agent">
        <DialogHeader>
          <DialogTitle>Edit {agent.name}</DialogTitle>
          <DialogDescription>Update agent properties and identity</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-edit-agent-name" />
          </div>
          <div>
            <Label className="text-sm">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} data-testid="input-edit-agent-description" />
          </div>
          <div>
            <Label className="text-sm">Capabilities (comma-separated)</Label>
            <Input value={capabilities} onChange={e => setCapabilities(e.target.value)} placeholder="read, write, research, analyze" data-testid="input-edit-agent-capabilities" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-sm">Provider</Label>
              <Select value={provider} onValueChange={(v: "openai" | "anthropic" | "minimax") => { setProvider(v); setModelName(""); }}>
                <SelectTrigger data-testid="select-edit-agent-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="minimax">MiniMax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Model</Label>
              <Select value={modelName} onValueChange={setModelName}>
                <SelectTrigger data-testid="select-edit-agent-model">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  {provider === "openai" ? (
                    <>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    </>
                  ) : provider === "minimax" ? (
                    <>
                      <SelectItem value="MiniMax-M2.5">M2.5 (Flagship)</SelectItem>
                      <SelectItem value="MiniMax-M2.5-highspeed">M2.5 Highspeed</SelectItem>
                      <SelectItem value="MiniMax-M2.1">M2.1</SelectItem>
                      <SelectItem value="MiniMax-M2.1-highspeed">M2.1 Highspeed</SelectItem>
                      <SelectItem value="MiniMax-M2">M2</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                      <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm">Identity Card</Label>
            <Textarea value={identityCard} onChange={e => setIdentityCard(e.target.value)} rows={3} placeholder="Who is this agent? Their personality, goals, worldview..." data-testid="input-edit-agent-identity" />
          </div>
          <div>
            <Label className="text-sm">Operating Principles</Label>
            <Textarea value={operatingPrinciples} onChange={e => setOperatingPrinciples(e.target.value)} rows={3} placeholder="Rules and guidelines this agent follows..." data-testid="input-edit-agent-principles" />
          </div>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full" data-testid="button-save-agent-edit">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SendToUniversity({ agent }: { agent: Agent }) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [open, setOpen] = useState(false);

  const enrollMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/university/enroll", {
        studentAgentId: agent.id,
        subject: subject || "general improvement",
      });
    },
    onSuccess: () => {
      toast({ title: "Enrolled", description: `${agent.name} has been sent to university for "${subject || 'general improvement'}"` });
      setOpen(false);
      setSubject("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors w-full"
        data-testid={`button-university-${agent.id}`}
      >
        <GraduationCap className="h-3 w-3" />
        <span>Send to University</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" data-testid="dialog-university">
          <DialogHeader>
            <DialogTitle>Send {agent.name} to University</DialogTitle>
            <DialogDescription>A stronger model will analyze their work and provide actionable feedback</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Subject (optional)</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. writing quality, code structure, analysis depth" data-testid="input-university-subject" />
            </div>
            <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending} className="w-full" data-testid="button-enroll-university">
              {enrollMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GraduationCap className="h-4 w-4 mr-2" />}
              {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/agents/${agent.id}`, {
        isActive: !agent.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: agent.isActive ? "Agent deactivated" : "Agent activated", description: `${agent.name} is now ${agent.isActive ? "inactive" : "active"}.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card className="hover-elevate" data-testid={`card-agent-${agent.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={agent.avatar || undefined} />
                <AvatarFallback className="bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base">{agent.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {agent.isVerified && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Shield className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                  {agent.generation !== null && agent.generation !== undefined && agent.generation > 0 && (
                    <Badge variant="outline" className="text-xs">Gen {agent.generation}</Badge>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {agent.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)} data-testid={`button-edit-agent-${agent.id}`}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleActiveMutation.mutate()} data-testid={`button-toggle-agent-${agent.id}`}>
                  {agent.isActive ? <PowerOff className="h-3.5 w-3.5 mr-2" /> : <Power className="h-3.5 w-3.5 mr-2" />}
                  {agent.isActive ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {agent.description || "No description provided"}
          </p>
          {(agent.provider || agent.modelName) && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {agent.provider === "anthropic" ? (
                <Badge variant="outline" className="text-[10px] px-1 py-0">Claude</Badge>
              ) : agent.provider === "minimax" ? (
                <Badge variant="outline" className="text-[10px] px-1 py-0">MiniMax</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1 py-0">OpenAI</Badge>
              )}
              {agent.modelName && <span>{agent.modelName}</span>}
            </div>
          )}
          {agent.capabilities && agent.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.slice(0, 4).map((cap, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {cap}
                </Badge>
              ))}
              {agent.capabilities.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{agent.capabilities.length - 4}
                </Badge>
              )}
            </div>
          )}

          <AgentMediaSettings agent={agent} />
          <SendToUniversity agent={agent} />

          <div className="flex items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              <span>Created {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "recently"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <AgentEditDialog agent={agent} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

export default function Agents() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const filteredAgents = agents?.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-agents-title">
            Agents
          </h1>
          <p className="text-muted-foreground">
            Manage your autonomous agents and their capabilities
          </p>
        </div>
        <Link href="/agents/new">
          <Button className="gap-2" data-testid="button-register-agent">
            <Plus className="h-4 w-4" />
            Register Agent
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-agents"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAgents && filteredAgents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching agents" : "No agents registered"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery 
                  ? "Try adjusting your search query"
                  : "Register your first autonomous agent to start building secure workflows"
                }
              </p>
              {!searchQuery && (
                <Link href="/agents/new">
                  <Button className="gap-2" data-testid="button-register-first-agent">
                    <Plus className="h-4 w-4" />
                    Register your first agent
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
