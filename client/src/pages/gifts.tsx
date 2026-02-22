import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import type { Gift, GiftComment, Agent, Workspace } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Gift as GiftIcon, Heart, MessageSquare, Bot, Palette, Code, Brain,
  FileText, Wrench, Sparkles, Search, Eye, ArrowRight, Send, X, Loader2,
  Zap, AlertTriangle, TrendingUp, Flame, Snowflake, Grid3X3,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof GiftIcon }> = {
  redesign: { label: "Redesign", color: "text-blue-500", bgColor: "bg-blue-500", icon: Palette },
  content: { label: "Content", color: "text-green-500", bgColor: "bg-green-500", icon: FileText },
  tool: { label: "Tool", color: "text-orange-500", bgColor: "bg-orange-500", icon: Wrench },
  analysis: { label: "Analysis", color: "text-purple-500", bgColor: "bg-purple-500", icon: Brain },
  prototype: { label: "Prototype", color: "text-cyan-500", bgColor: "bg-cyan-500", icon: Code },
  artwork: { label: "Artwork", color: "text-pink-500", bgColor: "bg-pink-500", icon: Sparkles },
  other: { label: "Other", color: "text-gray-500", bgColor: "bg-gray-500", icon: GiftIcon },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  creating: { label: "Creating", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  featured: { label: "Featured", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

interface HeatmapResponse {
  heatmap: Record<string, Record<string, number>>;
  agents: Record<string, { name: string; capabilities: string[]; workspaceId: string }>;
  giftTypes: string[];
  totalGifts: number;
  coldSpots: { agentId: string; agentName: string; type: string; count: number; suggestion: string }[];
  topAgents: { id: string; name: string; total: number }[];
  typeBreakdown: { type: string; count: number }[];
  workspaces: { id: string; name: string }[];
}

function GiftCommentsPanel({ giftId, onClose }: { giftId: string; onClose: () => void }) {
  const [newComment, setNewComment] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: comments, isLoading } = useQuery<GiftComment[]>({
    queryKey: ["/api/gifts", giftId, "comments"],
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/gifts/${giftId}/comments`, {
        authorId: user?.id || "unknown",
        authorType: "human",
        authorName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User" : "User",
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gifts", giftId, "comments"] });
      setNewComment("");
    },
    onError: () => { toast({ title: "Failed to post comment", variant: "destructive" }); },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [comments]);

  return (
    <div className="border-t pt-3 space-y-3" data-testid={`panel-comments-${giftId}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Discussion</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto space-y-2">
        {isLoading && <Skeleton className="h-16 w-full" />}
        {comments && comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Start the discussion!</p>
        )}
        {comments?.map(comment => (
          <div key={comment.id} className="flex gap-2" data-testid={`comment-${comment.id}`}>
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              {comment.authorType === "agent" ? <Bot className="h-3 w-3" /> : <span className="text-[10px]">{comment.authorName[0]}</span>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{comment.authorName}</span>
                {comment.authorType === "agent" && <Badge variant="outline" className="text-[8px] py-0">Agent</Badge>}
                <span className="text-[10px] text-muted-foreground">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (newComment.trim()) addComment.mutate(newComment.trim()); }}
        className="flex gap-1.5"
      >
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="text-xs"
          disabled={addComment.isPending}
          data-testid={`input-comment-${giftId}`}
        />
        <Button type="submit" size="icon" className="shrink-0 h-8 w-8" disabled={!newComment.trim() || addComment.isPending} data-testid={`button-send-comment-${giftId}`}>
          {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </form>
    </div>
  );
}

function GiftCard({ gift, agents }: { gift: Gift; agents: Agent[] }) {
  const [showComments, setShowComments] = useState(false);
  const { toast } = useToast();
  const typeConfig = TYPE_CONFIG[gift.type] || TYPE_CONFIG.other;
  const TypeIcon = typeConfig.icon;
  const statusConfig = STATUS_CONFIG[gift.status] || STATUS_CONFIG.creating;
  const agent = agents.find(a => a.id === gift.agentId);

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/gifts/${gift.id}/like`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gifts/recent"] });
    },
    onError: () => { toast({ title: "Failed to like", variant: "destructive" }); },
  });

  return (
    <Card className="group hover-elevate transition-all" data-testid={`card-gift-${gift.id}`}>
      {gift.thumbnail && (
        <div className="h-40 overflow-hidden rounded-t-lg bg-muted">
          <img src={gift.thumbnail} alt={gift.title} className="w-full h-full object-cover" />
        </div>
      )}
      {!gift.thumbnail && (
        <div className="h-32 rounded-t-lg bg-gradient-to-br from-primary/5 to-primary/15 flex items-center justify-center">
          <TypeIcon className={`h-10 w-10 ${typeConfig.color} opacity-50`} />
        </div>
      )}
      <CardContent className="pt-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-sm truncate" data-testid={`text-gift-title-${gift.id}`}>{gift.title}</h3>
            {gift.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{gift.description}</p>}
          </div>
          <Badge variant={statusConfig.variant} className="text-[10px] shrink-0">{statusConfig.label}</Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {agent && (
            <div className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              <span className="truncate">{agent.name}</span>
            </div>
          )}
          <Badge variant="outline" className={`text-[10px] gap-0.5 ${typeConfig.color}`}>
            <TypeIcon className="h-2.5 w-2.5" />
            {typeConfig.label}
          </Badge>
        </div>

        {gift.toolUsed && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Wrench className="h-2.5 w-2.5" />
            <span>Made with {gift.toolUsed}</span>
          </div>
        )}

        {gift.departmentRoom && (
          <div className="text-[10px] text-muted-foreground">
            Created in {gift.departmentRoom}
          </div>
        )}

        {gift.content && (
          <div className="rounded-md bg-muted/50 p-2 max-h-[100px] overflow-hidden text-xs text-muted-foreground">
            {gift.content.slice(0, 200)}{gift.content.length > 200 ? "..." : ""}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 px-2"
              onClick={() => likeMutation.mutate()}
              disabled={likeMutation.isPending}
              data-testid={`button-like-${gift.id}`}
            >
              <Heart className={`h-3 w-3 ${(gift.likes || 0) > 0 ? "fill-red-500 text-red-500" : ""}`} />
              {gift.likes || 0}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 px-2"
              onClick={() => setShowComments(!showComments)}
              data-testid={`button-comments-${gift.id}`}
            >
              <MessageSquare className="h-3 w-3" />
              Discuss
            </Button>
          </div>
          {gift.contentUrl && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2" asChild>
              <a href={gift.contentUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-view-gift-${gift.id}`}>
                <Eye className="h-3 w-3" /> View
              </a>
            </Button>
          )}
        </div>

        {showComments && <GiftCommentsPanel giftId={gift.id} onClose={() => setShowComments(false)} />}
      </CardContent>
    </Card>
  );
}

function HeatMapGrid({ onSparkFromCold }: { onSparkFromCold?: (agentId: string, type: string) => void }) {
  const { data: heatmapData, isLoading } = useQuery<HeatmapResponse>({
    queryKey: ["/api/gifts/heatmap"],
  });

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (!heatmapData) return null;

  const { heatmap, agents, giftTypes, totalGifts, coldSpots, topAgents, typeBreakdown } = heatmapData;
  const agentIds = Object.keys(heatmap);

  const maxCount = Math.max(1, ...agentIds.flatMap(id => giftTypes.map(t => heatmap[id]?.[t] || 0)));

  const getHeatColor = (count: number) => {
    if (count === 0) return "bg-muted/30 border border-dashed border-muted-foreground/20";
    const intensity = count / maxCount;
    if (intensity >= 0.75) return "bg-red-500/80 text-white";
    if (intensity >= 0.5) return "bg-orange-500/70 text-white";
    if (intensity >= 0.25) return "bg-yellow-500/60 text-yellow-900";
    return "bg-green-500/40 text-green-900";
  };

  return (
    <TooltipProvider>
      <Card className="border-primary/20" data-testid="card-heatmap">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Gift Heat Map</CardTitle>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-red-500" /> Hot</span>
              <span className="flex items-center gap-1"><Snowflake className="h-3 w-3 text-blue-400" /> Cold</span>
              <Badge variant="outline" className="text-[10px]">{totalGifts} total gifts</Badge>
            </div>
          </div>
          <CardDescription>
            Agent activity by gift type. Cold spots show where agents need refocusing or new agents are needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {agentIds.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No agents found. Create agents first to see the heat map.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="table-heatmap">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground sticky left-0 bg-card min-w-[120px]">Agent</th>
                      {giftTypes.map(t => {
                        const cfg = TYPE_CONFIG[t] || TYPE_CONFIG.other;
                        return (
                          <th key={t} className="px-1 py-2 text-center font-medium text-muted-foreground min-w-[70px]">
                            <div className="flex flex-col items-center gap-0.5">
                              <cfg.icon className={`h-3 w-3 ${cfg.color}`} />
                              <span className="text-[10px]">{cfg.label}</span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="px-2 py-2 text-center font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentIds.map(agentId => {
                      const agent = agents[agentId];
                      const agentTotal = giftTypes.reduce((sum, t) => sum + (heatmap[agentId]?.[t] || 0), 0);
                      return (
                        <tr key={agentId} className="border-t border-border/30" data-testid={`heatmap-row-${agentId}`}>
                          <td className="px-2 py-1.5 font-medium sticky left-0 bg-card">
                            <div className="flex items-center gap-1.5">
                              <Bot className="h-3 w-3 text-primary shrink-0" />
                              <span className="truncate max-w-[100px]">{agent?.name || "Unknown"}</span>
                            </div>
                          </td>
                          {giftTypes.map(t => {
                            const count = heatmap[agentId]?.[t] || 0;
                            return (
                              <td key={t} className="px-1 py-1.5 text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={`w-full h-8 rounded-md text-xs font-bold flex items-center justify-center transition-colors ${getHeatColor(count)} ${count === 0 ? "cursor-pointer" : ""}`}
                                      onClick={() => {
                                        if (count === 0 && onSparkFromCold) {
                                          onSparkFromCold(agentId, t);
                                        }
                                      }}
                                      data-testid={`heatmap-cell-${agentId}-${t}`}
                                    >
                                      {count === 0 ? (
                                        <Snowflake className="h-3 w-3 text-muted-foreground/40" />
                                      ) : count}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs max-w-[200px]">
                                    <p className="font-medium">{agent?.name} - {TYPE_CONFIG[t]?.label || t}</p>
                                    <p>{count === 0 ? "No gifts yet. Click to spark one!" : `${count} gift${count > 1 ? "s" : ""} created`}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center">
                            <Badge variant={agentTotal > 0 ? "default" : "outline"} className="text-[10px]">
                              {agentTotal}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-primary/20">
                      <td className="px-2 py-1.5 font-medium text-xs sticky left-0 bg-card">Totals</td>
                      {giftTypes.map(t => {
                        const typeTotal = typeBreakdown.find(tb => tb.type === t)?.count || 0;
                        return (
                          <td key={t} className="px-1 py-1.5 text-center text-xs font-bold">{typeTotal}</td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center">
                        <Badge className="text-[10px]">{totalGifts}</Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {coldSpots.length > 0 && (
                <div className="space-y-2" data-testid="section-cold-spots">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <h3 className="text-sm font-medium">Cold Spots - Untapped Potential</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {coldSpots.map((spot, i) => (
                      <Card key={i} className="border-yellow-500/20 bg-yellow-500/5" data-testid={`card-cold-spot-${i}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Snowflake className="h-3 w-3 text-blue-400 shrink-0" />
                                <span className="text-xs font-medium">{spot.agentName}</span>
                                <Badge variant="outline" className={`text-[9px] px-1 ${TYPE_CONFIG[spot.type]?.color || ""}`}>
                                  {TYPE_CONFIG[spot.type]?.label || spot.type}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{spot.suggestion}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-7 text-[10px] gap-1 text-primary"
                              onClick={() => onSparkFromCold?.(spot.agentId, spot.type)}
                              data-testid={`button-spark-cold-${i}`}
                            >
                              <Zap className="h-3 w-3" />
                              Spark
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {topAgents.length > 0 && topAgents.some(a => a.total > 0) && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                  <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="font-medium">Top Creators:</span>
                  {topAgents.filter(a => a.total > 0).map((a, i) => (
                    <span key={a.id} className="flex items-center gap-1">
                      <Bot className="h-3 w-3" /> {a.name} ({a.total})
                      {i < topAgents.filter(x => x.total > 0).length - 1 && <span className="text-muted-foreground/50 ml-1">|</span>}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default function Gifts() {
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sparkDialogOpen, setSparkDialogOpen] = useState(false);
  const [prefilledAgent, setPrefilledAgent] = useState("");
  const [prefilledType, setPrefilledType] = useState("");

  const { data: gifts, isLoading } = useQuery<Gift[]>({ queryKey: ["/api/gifts/recent"] });
  const { data: agents } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { data: workspaces } = useQuery<Workspace[]>({ queryKey: ["/api/workspaces"] });

  const filteredGifts = (gifts || []).filter(g => {
    if (filter && !g.title.toLowerCase().includes(filter.toLowerCase())) return false;
    if (typeFilter && g.type !== typeFilter) return false;
    return true;
  });

  const handleSparkFromCold = useCallback((agentId: string, type: string) => {
    setPrefilledAgent(agentId);
    setPrefilledType(type);
    setSparkDialogOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-gifts-title">Gifts</h1>
          <p className="text-muted-foreground text-sm">
            Novel creations and surprises from your agents
          </p>
        </div>
        <SparkGiftDialogControlled
          agents={agents || []}
          workspaces={workspaces || []}
          open={sparkDialogOpen}
          onOpenChange={setSparkDialogOpen}
          prefilledAgent={prefilledAgent}
          prefilledType={prefilledType}
          onClearPrefill={() => { setPrefilledAgent(""); setPrefilledType(""); }}
        />
      </div>

      <HeatMapGrid onSparkFromCold={handleSparkFromCold} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search gifts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
            data-testid="input-search-gifts"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={typeFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter(null)}
            data-testid="button-filter-all"
          >
            All
          </Button>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <Button
              key={key}
              variant={typeFilter === key ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() => setTypeFilter(typeFilter === key ? null : key)}
              data-testid={`button-filter-${key}`}
            >
              <cfg.icon className="h-3 w-3" />
              {cfg.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[300px]" />)}
        </div>
      )}

      {!isLoading && filteredGifts.length === 0 && (
        <Card className="p-12 text-center">
          <GiftIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-medium text-lg" data-testid="text-no-gifts">No gifts yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Use the "Spark a Gift" button above to have an agent create something. Or click any cold spot on the heat map!
          </p>
        </Card>
      )}

      {!isLoading && filteredGifts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGifts.map(gift => (
            <GiftCard key={gift.id} gift={gift} agents={agents || []} />
          ))}
        </div>
      )}
    </div>
  );
}

function SparkGiftDialogControlled({
  agents, workspaces, open, onOpenChange, prefilledAgent, prefilledType, onClearPrefill
}: {
  agents: Agent[]; workspaces: Workspace[]; open: boolean; onOpenChange: (open: boolean) => void;
  prefilledAgent: string; prefilledType: string; onClearPrefill: () => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [prompt, setPrompt] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && prefilledAgent) setSelectedAgent(prefilledAgent);
    if (open && prefilledType) setSelectedType(prefilledType);
  }, [open, prefilledAgent, prefilledType]);

  const selectedAgentObj = agents.find(a => a.id === selectedAgent);
  const workspaceId = selectedAgentObj?.workspaceId || "";

  const sparkMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/gifts/spark", {
        agentId: selectedAgent,
        workspaceId,
        type: selectedType,
        prompt: prompt.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gifts/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gifts/heatmap"] });
      toast({ title: "Gift created!", description: `${selectedAgentObj?.name || "Agent"} created a new ${selectedType} gift.` });
      onOpenChange(false);
      setSelectedAgent("");
      setSelectedType("");
      setPrompt("");
      onClearPrefill();
    },
    onError: () => {
      toast({ title: "Failed to spark gift", description: "The agent couldn't create the gift. Try again.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) onClearPrefill(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-spark-gift">
          <Zap className="h-4 w-4" />
          Spark a Gift
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Spark a Gift
          </DialogTitle>
          <DialogDescription>
            Choose an agent and gift type. The agent will use AI to create something original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent</label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger data-testid="select-spark-agent">
                <SelectValue placeholder="Choose an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.filter(a => a.isActive).map(agent => {
                  const ws = workspaces.find(w => w.id === agent.workspaceId);
                  return (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <Bot className="h-3 w-3" />
                        {agent.name}
                        {ws && <span className="text-muted-foreground text-xs">({ws.name})</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Gift Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger data-testid="select-spark-type">
                <SelectValue placeholder="Choose a type..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <cfg.icon className={`h-3 w-3 ${cfg.color}`} />
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Direction (optional)</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Give the agent a nudge... e.g., 'Write about emerging AI safety frameworks' or leave blank for full autonomy"
              className="min-h-[80px] text-sm"
              data-testid="input-spark-prompt"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={() => sparkMutation.mutate()}
            disabled={!selectedAgent || !selectedType || sparkMutation.isPending}
            data-testid="button-spark-submit"
          >
            {sparkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Agent is creating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Spark Gift
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
