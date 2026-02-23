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
import { ArrowLeft, Bot, X, Video, Mic } from "lucide-react";
import { Link } from "wouter";
import type { Workspace } from "@shared/schema";

const CAPABILITY_CATALOG: { id: string; label: string; description: string; examples: string }[] = [
  { id: "read", label: "Read", description: "Access and process documents, files, and data sources", examples: "PDFs, databases, web pages, APIs" },
  { id: "write", label: "Write", description: "Create and edit text content, documents, and reports", examples: "Articles, summaries, emails, proposals" },
  { id: "execute", label: "Execute", description: "Run code, scripts, and automated workflows", examples: "Python scripts, shell commands, CI/CD pipelines" },
  { id: "publish", label: "Publish", description: "Push content live to websites, channels, or feeds", examples: "Blog posts, social media, newsletters, briefings" },
  { id: "research", label: "Research", description: "Find, gather, and synthesize information from sources", examples: "Market research, literature reviews, competitive analysis" },
  { id: "analyze", label: "Analyze", description: "Break down data, identify patterns, and draw insights", examples: "Data analysis, trend detection, sentiment analysis" },
  { id: "communicate", label: "Communicate", description: "Engage with humans and other agents through conversation", examples: "Meetings, updates, Q&A, coordination" },
  { id: "manage_tokens", label: "Manage Tokens", description: "Create and manage API tokens and access credentials", examples: "Token rotation, permission scoping, key management" },
  { id: "create", label: "Create", description: "Build new artifacts, prototypes, and original work", examples: "Prototypes, mockups, creative pieces, tools" },
  { id: "design", label: "Design", description: "Visual and UX design for interfaces and experiences", examples: "Wireframes, UI layouts, color schemes, typography" },
  { id: "investigate", label: "Investigate", description: "Deep-dive into issues, bugs, and complex problems", examples: "Root cause analysis, debugging, forensic review" },
  { id: "scrape", label: "Scrape", description: "Extract structured data from websites and documents", examples: "Product listings, pricing data, contact info" },
  { id: "crawl", label: "Crawl", description: "Systematically browse and index web content", examples: "Site mapping, link discovery, content indexing" },
  { id: "audio", label: "Audio", description: "Process, generate, and edit audio content", examples: "Podcasts, sound effects, audio transcription" },
  { id: "tts", label: "Text-to-Speech", description: "Convert written text into spoken audio", examples: "Voiceovers, audiobooks, broadcast narration" },
  { id: "image_generation", label: "Image Generation", description: "Create images from text prompts using AI models", examples: "Illustrations, product mockups, concept art" },
  { id: "screenshot", label: "Screenshot", description: "Capture visual snapshots of screens and interfaces", examples: "Bug reports, visual documentation, before/after comparisons" },
  { id: "crop", label: "Crop", description: "Edit and resize images for specific formats", examples: "Thumbnails, social media images, profile pictures" },
  { id: "produce", label: "Produce", description: "Orchestrate multi-step content production workflows", examples: "Video editing, podcast production, campaign creation" },
  { id: "compile", label: "Compile", description: "Aggregate and assemble content from multiple sources", examples: "Reports, dashboards, summaries, digests" },
  { id: "discuss", label: "Discuss", description: "Engage in collaborative discussions and debates", examples: "Brainstorming, peer review, planning sessions" },
  { id: "content_generation", label: "Content Generation", description: "Generate original content using AI models", examples: "Blog posts, marketing copy, product descriptions" },
  { id: "code_review", label: "Code Review", description: "Review code for quality, bugs, and best practices", examples: "Pull request reviews, refactoring suggestions, linting" },
  { id: "testing", label: "Testing", description: "Write and run tests to verify software behavior", examples: "Unit tests, integration tests, load testing" },
  { id: "strategy", label: "Strategy", description: "Plan long-term goals, roadmaps, and approaches", examples: "Product roadmaps, go-to-market plans, OKRs" },
  { id: "architecture", label: "Architecture", description: "Design system structures and technical foundations", examples: "System diagrams, API design, database schemas" },
  { id: "security", label: "Security", description: "Assess and enforce security policies and practices", examples: "Vulnerability scans, access audits, compliance checks" },
  { id: "critique", label: "Critique", description: "Evaluate work quality and provide constructive feedback", examples: "Design reviews, content editing, quality scoring" },
];

const CAPABILITY_OPTIONS = CAPABILITY_CATALOG.map(c => c.id);

export default function AgentNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [newCapability, setNewCapability] = useState("");
  const [customCapInput, setCustomCapInput] = useState("");
  const [heygenAvatarId, setHeygenAvatarId] = useState("");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState("");

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
      heygenAvatarId?: string;
      elevenLabsVoiceId?: string;
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
    createMutation.mutate({ 
      name, description, workspaceId, capabilities, isActive,
      heygenAvatarId: heygenAvatarId || undefined,
      elevenLabsVoiceId: elevenLabsVoiceId || undefined,
    });
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
              <Label htmlFor="workspace">Department</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger data-testid="select-workspace">
                  <SelectValue placeholder="Select a department" />
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
              <p className="text-xs text-muted-foreground -mt-2">Choose from the list or type your own. Each capability defines what this agent can do.</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {capabilities.map((cap) => {
                  const info = CAPABILITY_CATALOG.find(c => c.id === cap);
                  return (
                    <Badge key={cap} variant="secondary" className="gap-1 pr-1" title={info ? `${info.description} (e.g. ${info.examples})` : cap}>
                      {info?.label || cap}
                      <button
                        type="button"
                        onClick={() => removeCapability(cap)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Select value={newCapability} onValueChange={(value) => addCapability(value)}>
                  <SelectTrigger className="flex-1" data-testid="select-capability">
                    <SelectValue placeholder="Choose from list" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAPABILITY_CATALOG.filter((c) => !capabilities.includes(c.id)).map((cap) => (
                      <SelectItem key={cap.id} value={cap.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{cap.label}</span>
                          <span className="text-xs text-muted-foreground">{cap.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Or type a custom capability..."
                  value={customCapInput}
                  onChange={(e) => setCustomCapInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = customCapInput.trim().toLowerCase();
                      if (val) { addCapability(val); setCustomCapInput(""); }
                    }
                  }}
                  data-testid="input-custom-capability"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const val = customCapInput.trim().toLowerCase();
                    if (val) { addCapability(val); setCustomCapInput(""); }
                  }}
                  disabled={!customCapInput.trim()}
                  data-testid="button-add-capability"
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Digital Identity (Media)</Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Give this agent a unique digital avatar and voice for video broadcasts
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="heygenAvatarId" className="text-xs flex items-center gap-1.5">
                    <Video className="h-3 w-3" /> HeyGen Avatar ID
                  </Label>
                  <Input
                    id="heygenAvatarId"
                    placeholder="e.g. Kristin_pubblic_2_20240108"
                    value={heygenAvatarId}
                    onChange={(e) => setHeygenAvatarId(e.target.value)}
                    className="text-sm"
                    data-testid="input-heygen-avatar-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="elevenLabsVoiceId" className="text-xs flex items-center gap-1.5">
                    <Mic className="h-3 w-3" /> ElevenLabs Voice ID
                  </Label>
                  <Input
                    id="elevenLabsVoiceId"
                    placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                    value={elevenLabsVoiceId}
                    onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                    className="text-sm"
                    data-testid="input-elevenlabs-voice-id"
                  />
                </div>
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
