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
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MemoryEntry, Workspace } from "@shared/schema";

const tierIcons = {
  hot: Flame,
  warm: Thermometer,
  cold: Snowflake,
};

const tierColors = {
  hot: "bg-red-500/10 text-red-600",
  warm: "bg-orange-500/10 text-orange-600",
  cold: "bg-blue-500/10 text-blue-600",
};

const typeIcons = {
  identity: Brain,
  goal: Target,
  fact: Lightbulb,
  event: Calendar,
  artifact: FileBox,
  summary: FileText,
};

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

  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const firstWorkspace = workspaces?.[0];

  const { data: memories, isLoading: loadingMemories } = useQuery<MemoryEntry[]>({
    queryKey: ["/api/workspaces", firstWorkspace?.slug, "memory", selectedTier !== "all" ? selectedTier : undefined],
    enabled: !!firstWorkspace?.slug,
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string): Promise<{ entries: MemoryEntry[]; summary?: string }> => {
      const res = await apiRequest("POST", `/api/workspaces/${firstWorkspace?.slug}/memory/search`, {
        query,
        summarize: true,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Found ${data.entries?.length || 0} memories` });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newEntry) => {
      return apiRequest("POST", `/api/workspaces/${firstWorkspace?.slug}/memory`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "memory"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "memory"] });
      toast({ title: "Memory deleted" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/memory/${id}`, { tier: "hot" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "memory"] });
      toast({ title: "Memory promoted to hot tier" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/memory/${id}`, { tier: "cold" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "memory"] });
      toast({ title: "Memory archived to cold tier" });
    },
  });

  const maintenanceMutation = useMutation({
    mutationFn: async (): Promise<{ archived: number; promoted: number }> => {
      const res = await apiRequest("POST", `/api/workspaces/${firstWorkspace?.slug}/memory/maintain`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "memory"] });
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

  const filteredMemories = memories?.filter(m => 
    selectedTier === "all" || m.tier === selectedTier
  );

  if (loadingWorkspaces || loadingMemories) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-memory-title">Memory</h1>
          <p className="text-muted-foreground">Recursive learning memory system for agents</p>
        </div>
        <div className="flex gap-2">
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
              <CardHeader className="flex flex-row items-center justify-between pb-2">
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
          <CardTitle>Search Memory</CardTitle>
          <CardDescription>Query the memory system to find relevant information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search for memories..."
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
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
          {searchMutation.data?.summary && (
            <div className="mt-4 p-4 rounded-lg bg-muted">
              <h4 className="font-medium mb-2">Summary</h4>
              <p className="text-sm text-muted-foreground">{searchMutation.data.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={selectedTier} onValueChange={setSelectedTier}>
        <TabsList>
          <TabsTrigger value="all">All ({memories?.length || 0})</TabsTrigger>
          <TabsTrigger value="hot">Hot ({tierCounts.hot})</TabsTrigger>
          <TabsTrigger value="warm">Warm ({tierCounts.warm})</TabsTrigger>
          <TabsTrigger value="cold">Cold ({tierCounts.cold})</TabsTrigger>
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
              {filteredMemories.map((memory) => {
                const TierIcon = tierIcons[memory.tier as keyof typeof tierIcons];
                const TypeIcon = typeIcons[memory.type as keyof typeof typeIcons] || Lightbulb;
                return (
                  <Card key={memory.id} data-testid={`card-memory-${memory.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 rounded-md bg-primary/10 shrink-0">
                            <TypeIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{memory.title}</h4>
                              <Badge className={tierColors[memory.tier as keyof typeof tierColors]}>
                                <TierIcon className="h-3 w-3 mr-1" />
                                {memory.tier}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {memory.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {memory.summary || memory.content}
                            </p>
                            {memory.tags && memory.tags.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {memory.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Accessed {memory.accessCount || 0} times</span>
                              {memory.createdAt && (
                                <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {memory.tier !== "hot" && (
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => promoteMutation.mutate(memory.id)}
                              title="Promote to hot"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                          )}
                          {memory.tier !== "cold" && (
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => archiveMutation.mutate(memory.id)}
                              title="Archive to cold"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(memory.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
