import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Play,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronRight,
  Bot,
  Clock,
  Code,
  Terminal,
  AlertTriangle,
  CheckCircle,
  FileCode,
  Loader2,
  Copy,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgentTool, Workspace, Agent } from "@shared/schema";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileCode },
  tested: { label: "Tested", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle },
  approved: { label: "Approved", color: "bg-primary/10 text-primary", icon: Check },
  failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

interface ToolCardProps {
  tool: AgentTool;
  agent?: Agent;
  workspaceSlug: string;
}

function ToolCard({ tool, agent, workspaceSlug }: ToolCardProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(tool.title);
  const [editDescription, setEditDescription] = useState(tool.description || "");
  const [editCode, setEditCode] = useState(tool.code);
  const [editTags, setEditTags] = useState((tool.tags || []).join(", "));
  const [runOutput, setRunOutput] = useState(tool.lastOutput || "");
  const [runError, setRunError] = useState(tool.lastError || "");

  const status = statusConfig[tool.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tools/${tool.id}/run`);
      return res.json();
    },
    onSuccess: (data) => {
      setRunOutput(data.output || "");
      setRunError(data.error || "");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceSlug, "tools"] });
      toast({ title: data.error ? "Tool ran with errors" : "Tool executed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to run tool", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<AgentTool>) => {
      return apiRequest("PATCH", `/api/tools/${tool.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceSlug, "tools"] });
      toast({ title: "Tool updated" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update tool", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tools/${tool.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceSlug, "tools"] });
      toast({ title: "Tool deleted" });
    },
  });

  const handleSave = () => {
    const tags = editTags.split(",").map(t => t.trim()).filter(Boolean);
    updateMutation.mutate({
      title: editTitle,
      description: editDescription,
      code: editCode,
      tags,
    });
  };

  const handleCancel = () => {
    setEditTitle(tool.title);
    setEditDescription(tool.description || "");
    setEditCode(tool.code);
    setEditTags((tool.tags || []).join(", "));
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tool.code);
    toast({ title: "Code copied to clipboard" });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid={`card-tool-${tool.id}`} className={isOpen ? "ring-1 ring-primary/20" : ""}>
        <CollapsibleTrigger asChild>
          <CardContent className="py-4 cursor-pointer hover-elevate rounded-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-md bg-primary/10 shrink-0">
                  <Code className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium truncate" data-testid={`text-tool-title-${tool.id}`}>{tool.title}</h4>
                    <Badge className={status.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {tool.language}
                    </Badge>
                  </div>
                  {!isOpen && tool.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {tool.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    {agent && (
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {agent.name}
                      </span>
                    )}
                    {tool.runCount !== null && tool.runCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        {tool.runCount} runs
                      </span>
                    )}
                    {tool.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(tool.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 mt-1 ${isOpen ? "rotate-90" : ""}`} />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-6 py-4 space-y-4" data-testid={`expanded-tool-${tool.id}`}>
            {tool.description && (
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            )}

            {isEditing ? (
              <div className="space-y-4" data-testid={`edit-form-tool-${tool.id}`}>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    data-testid={`input-edit-tool-title-${tool.id}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    data-testid={`input-edit-tool-desc-${tool.id}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Textarea
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    data-testid={`input-edit-tool-code-${tool.id}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    data-testid={`input-edit-tool-tags-${tool.id}`}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancel} data-testid={`button-cancel-edit-tool-${tool.id}`}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid={`button-save-edit-tool-${tool.id}`}>
                    <Check className="h-4 w-4 mr-1" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute top-2 right-2 z-10 flex gap-1">
                    <Button size="icon" variant="ghost" onClick={handleCopy} title="Copy code" data-testid={`button-copy-${tool.id}`}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ScrollArea className="max-h-[400px]">
                    <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto" data-testid={`code-block-${tool.id}`}>
                      <code>{tool.code}</code>
                    </pre>
                  </ScrollArea>
                </div>

                {tool.tags && tool.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {tool.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={() => runMutation.mutate()}
                    disabled={runMutation.isPending}
                    data-testid={`button-run-${tool.id}`}
                  >
                    {runMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Run Tool
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                    data-testid={`button-edit-tool-${tool.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
                    data-testid={`button-delete-tool-${tool.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {(runOutput || runError || tool.lastOutput || tool.lastError) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Output</span>
                      {tool.lastRunAt && (
                        <span className="text-xs text-muted-foreground">
                          Last run: {new Date(tool.lastRunAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {(runError || tool.lastError) && (
                      <pre className="bg-destructive/5 border border-destructive/20 rounded-md p-3 text-sm font-mono text-destructive whitespace-pre-wrap" data-testid={`error-output-${tool.id}`}>
                        {runError || tool.lastError}
                      </pre>
                    )}
                    {(runOutput || tool.lastOutput) && (
                      <ScrollArea className="max-h-[200px]">
                        <pre className="bg-muted rounded-md p-3 text-sm font-mono whitespace-pre-wrap" data-testid={`run-output-${tool.id}`}>
                          {runOutput || tool.lastOutput}
                        </pre>
                      </ScrollArea>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground flex-wrap">
                  {agent && (
                    <span className="flex items-center gap-1">
                      <Bot className="h-3.5 w-3.5" />
                      Built by {agent.name}
                      {agent.provider && <span className="text-muted-foreground/60">({agent.provider})</span>}
                    </span>
                  )}
                  {tool.updatedAt && (
                    <span>Updated: {new Date(tool.updatedAt).toLocaleString()}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function Tools() {
  const { toast } = useToast();
  const [newToolOpen, setNewToolOpen] = useState(false);
  const [newTool, setNewTool] = useState({
    title: "",
    description: "",
    code: "",
    language: "javascript",
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const agentForumWorkspace = workspaces?.find(w => w.slug === "agent-forum");
  const activeWorkspace = agentForumWorkspace || workspaces?.[0];

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agentMap = new Map<string, Agent>();
  agents?.forEach(a => agentMap.set(a.id, a));

  const { data: tools, isLoading } = useQuery<AgentTool[]>({
    queryKey: ["/api/workspaces", activeWorkspace?.slug, "tools"],
    enabled: !!activeWorkspace?.slug,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newTool) => {
      if (!activeWorkspace) throw new Error("No workspace");
      return apiRequest("POST", `/api/workspaces/${activeWorkspace.slug}/tools`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", activeWorkspace?.slug, "tools"] });
      toast({ title: "Tool created" });
      setNewToolOpen(false);
      setNewTool({ title: "", description: "", code: "", language: "javascript" });
    },
    onError: () => {
      toast({ title: "Failed to create tool", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const testedCount = tools?.filter(t => t.status === "tested" || t.status === "approved").length || 0;
  const failedCount = tools?.filter(t => t.status === "failed").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-tools-title">Tools</h1>
          <p className="text-muted-foreground">Working code built by agents - view, edit, and run</p>
        </div>
        <Dialog open={newToolOpen} onOpenChange={setNewToolOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-tool">
              <Plus className="h-4 w-4 mr-2" />
              New Tool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Tool</DialogTitle>
              <DialogDescription>Write a new code tool that can be executed</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newTool.title}
                  onChange={(e) => setNewTool(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Tool name"
                  data-testid="input-new-tool-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newTool.description}
                  onChange={(e) => setNewTool(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this tool do?"
                  data-testid="input-new-tool-desc"
                />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={newTool.language}
                  onValueChange={(v) => setNewTool(prev => ({ ...prev, language: v }))}
                >
                  <SelectTrigger data-testid="select-new-tool-lang">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Textarea
                  value={newTool.code}
                  onChange={(e) => setNewTool(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="// Write your code here..."
                  className="min-h-[200px] font-mono text-sm"
                  data-testid="input-new-tool-code"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewToolOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(newTool)}
                disabled={!newTool.title || !newTool.code || createMutation.isPending}
                data-testid="button-save-new-tool"
              >
                Create Tool
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tools">{tools?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Code artifacts built by agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">Working</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-tested-tools">{testedCount}</div>
            <p className="text-xs text-muted-foreground">Tested and running successfully</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">Needs Fix</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-failed-tools">{failedCount}</div>
            <p className="text-xs text-muted-foreground">Failed execution, needs editing</p>
          </CardContent>
        </Card>
      </div>

      {!tools || tools.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Code className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No tools yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Agents will build working code tools when the factory runs, or create one manually
            </p>
            <Button onClick={() => setNewToolOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Tool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              agent={tool.createdByAgentId ? agentMap.get(tool.createdByAgentId) : undefined}
              workspaceSlug={activeWorkspace?.slug || ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}
