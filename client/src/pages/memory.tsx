import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Plus, 
  Search, 
  Brain, 
  Flame, 
  Thermometer, 
  Snowflake,
  Target,
  Lightbulb,
  Calendar,
  FileBox,
  FileText,
  Trash2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Pencil,
  X,
  Check,
  Bot,
  Clock,
  Eye,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import type { MemoryEntry, Workspace, Agent } from "@shared/schema";

const tierIcons = {
  hot: Flame,
  warm: Thermometer,
  cold: Snowflake,
};

const tierColors = {
  hot: "bg-red-500/10 text-red-600 dark:text-red-400",
  warm: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  cold: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const typeIcons: Record<string, any> = {
  identity: Brain,
  goal: Target,
  fact: Lightbulb,
  event: Calendar,
  artifact: FileBox,
  summary: FileText,
};

interface MemoryCardProps {
  memory: MemoryEntry;
  agent?: Agent;
  onPromote: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<MemoryEntry>) => void;
}

function MemoryCard({ memory, agent, onPromote, onArchive, onDelete, onUpdate }: MemoryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(memory.title);
  const [editContent, setEditContent] = useState(memory.content);
  const [editTier, setEditTier] = useState<string>(memory.tier);
  const [editType, setEditType] = useState<string>(memory.type);
  const [editTags, setEditTags] = useState((memory.tags || []).join(", "));

  const TierIcon = tierIcons[memory.tier as keyof typeof tierIcons];
  const TypeIcon = typeIcons[memory.type] || Lightbulb;

  const handleSave = () => {
    const tags = editTags.split(",").map(t => t.trim()).filter(Boolean);
    onUpdate(memory.id, {
      title: editTitle,
      content: editContent,
      tier: editTier as any,
      type: editType as any,
      tags,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(memory.title);
    setEditContent(memory.content);
    setEditTier(memory.tier);
    setEditType(memory.type);
    setEditTags((memory.tags || []).join(", "));
    setIsEditing(false);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    if (!isOpen) setIsOpen(true);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid={`card-memory-${memory.id}`} className={isOpen ? "ring-1 ring-primary/20" : ""}>
        <CollapsibleTrigger asChild>
          <CardContent className="py-4 cursor-pointer hover-elevate rounded-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-md bg-primary/10 shrink-0">
                  <TypeIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium truncate" data-testid={`text-memory-title-${memory.id}`}>{memory.title}</h4>
                    <Badge className={tierColors[memory.tier as keyof typeof tierColors]}>
                      <TierIcon className="h-3 w-3 mr-1" />
                      {memory.tier}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {memory.type}
                    </Badge>
                  </div>
                  {!isOpen && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {memory.summary || memory.content}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    {agent && (
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {agent.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {memory.accessCount || 0}
                    </span>
                    {memory.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(memory.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-6 py-4">
            {isEditing ? (
              <div className="space-y-4" data-testid={`edit-form-${memory.id}`}>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    data-testid={`input-edit-title-${memory.id}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tier</Label>
                    <Select value={editTier} onValueChange={setEditTier}>
                      <SelectTrigger data-testid={`select-edit-tier-${memory.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hot">Hot (Always loaded)</SelectItem>
                        <SelectItem value="warm">Warm (Searchable)</SelectItem>
                        <SelectItem value="cold">Cold (Archived)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={editType} onValueChange={setEditType}>
                      <SelectTrigger data-testid={`select-edit-type-${memory.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="identity">Identity</SelectItem>
                        <SelectItem value="goal">Goal</SelectItem>
                        <SelectItem value="fact">Fact</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="artifact">Artifact</SelectItem>
                        <SelectItem value="summary">Summary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    data-testid={`input-edit-content-${memory.id}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="e.g. architecture, security, research"
                    data-testid={`input-edit-tags-${memory.id}`}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancel} data-testid={`button-cancel-edit-${memory.id}`}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} data-testid={`button-save-edit-${memory.id}`}>
                    <Check className="h-4 w-4 mr-1" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div data-testid={`expanded-content-${memory.id}`}>
                {memory.summary && memory.summary !== memory.content && (
                  <div className="mb-4 p-3 rounded-md bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm">{memory.summary}</p>
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-blockquote:my-2">
                  <ReactMarkdown>{memory.content}</ReactMarkdown>
                </div>
                {memory.tags && memory.tags.length > 0 && (
                  <div className="flex gap-1 mt-4 flex-wrap">
                    {memory.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-4 pt-3 border-t flex-wrap gap-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {agent && (
                      <span className="flex items-center gap-1">
                        <Bot className="h-3.5 w-3.5" />
                        Created by {agent.name}
                        {agent.provider && <span className="text-muted-foreground/60">({agent.provider})</span>}
                      </span>
                    )}
                    {memory.sourceType && (
                      <span>Source: {memory.sourceType}</span>
                    )}
                    {memory.updatedAt && (
                      <span>Updated: {new Date(memory.updatedAt).toLocaleString()}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleStartEdit}
                      data-testid={`button-edit-${memory.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    {memory.tier !== "hot" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); onPromote(memory.id); }}
                        title="Promote to hot"
                        data-testid={`button-promote-${memory.id}`}
                      >
                        <ArrowUp className="h-3.5 w-3.5 mr-1" />
                        Hot
                      </Button>
                    )}
                    {memory.tier !== "cold" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); onArchive(memory.id); }}
                        title="Archive to cold"
                        data-testid={`button-archive-${memory.id}`}
                      >
                        <ArrowDown className="h-3.5 w-3.5 mr-1" />
                        Cold
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); onDelete(memory.id); }}
                      data-testid={`button-delete-${memory.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function Memory() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: "fact",
    tier: "warm",
    title: "",
    content: "",
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const firstWorkspace = workspaces?.[0];

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agentMap = new Map<string, Agent>();
  agents?.forEach(a => agentMap.set(a.id, a));

  const { data: memories, isLoading: loadingMemories } = useQuery<MemoryEntry[]>({
    queryKey: ["/api/memory", selectedTier !== "all" ? selectedTier : undefined],
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string): Promise<{ entries: MemoryEntry[]; summary?: string; strategy?: string; searchTerms?: string[]; totalScanned?: number }> => {
      if (!firstWorkspace) throw new Error("No workspace");
      const res = await apiRequest("POST", `/api/workspaces/${firstWorkspace.slug}/memory/search`, {
        query,
        summarize: true,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Found ${data.entries?.length || 0} memories across ${data.totalScanned || 0} scanned` });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newEntry) => {
      if (!firstWorkspace) throw new Error("No workspace");
      return apiRequest("POST", `/api/workspaces/${firstWorkspace.slug}/memory`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memory"] });
      toast({ title: "Memory created" });
      setNewEntryOpen(false);
      setNewEntry({ type: "fact", tier: "warm", title: "", content: "" });
    },
    onError: () => {
      toast({ title: "Failed to create memory", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/memory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memory"] });
      toast({ title: "Memory deleted" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/memory/${id}`, { tier: "hot" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memory"] });
      toast({ title: "Memory promoted to hot tier" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/memory/${id}`, { tier: "cold" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memory"] });
      toast({ title: "Memory archived to cold tier" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MemoryEntry> }) => {
      return apiRequest("PATCH", `/api/memory/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memory"] });
      toast({ title: "Memory updated" });
    },
    onError: () => {
      toast({ title: "Failed to update memory", variant: "destructive" });
    },
  });

  const maintenanceMutation = useMutation({
    mutationFn: async (): Promise<{ archived: number; promoted: number }> => {
      const res = await apiRequest("POST", `/api/workspaces/${firstWorkspace?.slug}/memory/maintain`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/memory"] });
      toast({ 
        title: "Maintenance complete",
        description: `Archived: ${data.archived}, Promoted: ${data.promoted}`
      });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleUpdate = (id: string, updates: Partial<MemoryEntry>) => {
    updateMutation.mutate({ id, updates });
  };

  const filteredMemories = memories?.filter(m => 
    selectedTier === "all" || m.tier === selectedTier
  );

  if (loadingMemories) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const tierCounts = {
    hot: memories?.filter(m => m.tier === "hot").length || 0,
    warm: memories?.filter(m => m.tier === "warm").length || 0,
    cold: memories?.filter(m => m.tier === "cold").length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-memory-title">Memory</h1>
          <p className="text-muted-foreground">Click any entry to expand, view full content, and edit</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => maintenanceMutation.mutate()}
            disabled={maintenanceMutation.isPending}
            data-testid="button-maintenance"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${maintenanceMutation.isPending ? 'animate-spin' : ''}`} />
            Run Maintenance
          </Button>
          <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-memory">
                <Plus className="h-4 w-4 mr-2" />
                Add Memory
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Memory Entry</DialogTitle>
                <DialogDescription>
                  Create a new memory entry for agents to access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select 
                      value={newEntry.type} 
                      onValueChange={(v) => setNewEntry(prev => ({ ...prev, type: v }))}
                    >
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="identity">Identity</SelectItem>
                        <SelectItem value="goal">Goal</SelectItem>
                        <SelectItem value="fact">Fact</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="artifact">Artifact</SelectItem>
                        <SelectItem value="summary">Summary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tier</Label>
                    <Select 
                      value={newEntry.tier} 
                      onValueChange={(v) => setNewEntry(prev => ({ ...prev, tier: v }))}
                    >
                      <SelectTrigger data-testid="select-tier">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hot">Hot (Always loaded)</SelectItem>
                        <SelectItem value="warm">Warm (Searchable)</SelectItem>
                        <SelectItem value="cold">Cold (Archived)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newEntry.title}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Brief title for this memory"
                    data-testid="input-memory-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={newEntry.content}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="The full memory content..."
                    className="min-h-[100px]"
                    data-testid="input-memory-content"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewEntryOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createMutation.mutate(newEntry)}
                  disabled={!newEntry.title || !newEntry.content || createMutation.isPending}
                  data-testid="button-save-memory"
                >
                  Save Memory
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(["hot", "warm", "cold"] as const).map((tier) => {
          const Icon = tierIcons[tier];
          return (
            <Card key={tier} className="cursor-pointer hover-elevate" onClick={() => setSelectedTier(tier)}>
              <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                <CardTitle className="text-sm font-medium capitalize">{tier} Memory</CardTitle>
                <Icon className={`h-4 w-4 ${tier === "hot" ? "text-red-500" : tier === "warm" ? "text-orange-500" : "text-blue-500"}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tierCounts[tier]}</div>
                <p className="text-xs text-muted-foreground">
                  {tier === "hot" ? "Always in agent context" : 
                   tier === "warm" ? "Searchable on demand" : 
                   "Archived, rarely accessed"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recursive Learning Memory (RLM)
          </CardTitle>
          <CardDescription>AI-powered semantic search: expands your query, scans all memories, ranks by relevance, and synthesizes findings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ask anything — e.g. 'What do we know about coordination strategies?'"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-search"
            />
            <Button 
              onClick={handleSearch} 
              disabled={searchMutation.isPending}
              data-testid="button-search"
            >
              {searchMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
          </div>

          {searchMutation.isPending && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Expanding query, scanning memories, ranking by relevance...
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {searchMutation.data?.strategy && (
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
              <Brain className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">RLM Strategy:</span> {searchMutation.data.strategy}
                {searchMutation.data.searchTerms && searchMutation.data.searchTerms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {searchMutation.data.searchTerms.map((term, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{term}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {searchMutation.data?.summary && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                RLM Synthesis
              </h4>
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                <ReactMarkdown>{searchMutation.data.summary}</ReactMarkdown>
              </div>
            </div>
          )}

          {searchMutation.data?.entries && searchMutation.data.entries.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Retrieved Memories ({searchMutation.data.entries.length})
              </h4>
              {searchMutation.data.entries.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  agent={memory.agentId ? agentMap.get(memory.agentId) : undefined}
                  onPromote={(id) => promoteMutation.mutate(id)}
                  onArchive={(id) => archiveMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}

          {searchMutation.data && searchMutation.data.entries?.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No memories found for this query. Try different terms or add memories first.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={selectedTier} onValueChange={setSelectedTier}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All ({memories?.length || 0})</TabsTrigger>
          <TabsTrigger value="hot" data-testid="tab-hot">Hot ({tierCounts.hot})</TabsTrigger>
          <TabsTrigger value="warm" data-testid="tab-warm">Warm ({tierCounts.warm})</TabsTrigger>
          <TabsTrigger value="cold" data-testid="tab-cold">Cold ({tierCounts.cold})</TabsTrigger>
        </TabsList>
        
        <TabsContent value={selectedTier} className="mt-4">
          {!filteredMemories || filteredMemories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Brain className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-1">No memories yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add memories to help agents learn and remember
                </p>
                <Button onClick={() => setNewEntryOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Memory
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredMemories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  agent={memory.agentId ? agentMap.get(memory.agentId) : undefined}
                  onPromote={(id) => promoteMutation.mutate(id)}
                  onArchive={(id) => archiveMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
