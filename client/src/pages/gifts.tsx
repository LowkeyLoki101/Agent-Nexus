import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import type { Gift, GiftComment, Agent } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Gift as GiftIcon, Heart, MessageSquare, Bot, Palette, Code, Brain,
  FileText, Wrench, Sparkles, Search, Eye, ArrowRight, Send, X, Loader2,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof GiftIcon }> = {
  redesign: { label: "Redesign", color: "text-blue-500", icon: Palette },
  content: { label: "Content", color: "text-green-500", icon: FileText },
  tool: { label: "Tool", color: "text-orange-500", icon: Wrench },
  analysis: { label: "Analysis", color: "text-purple-500", icon: Brain },
  prototype: { label: "Prototype", color: "text-cyan-500", icon: Code },
  artwork: { label: "Artwork", color: "text-pink-500", icon: Sparkles },
  other: { label: "Other", color: "text-gray-500", icon: GiftIcon },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  creating: { label: "Creating", variant: "secondary" },
  ready: { label: "Ready", variant: "default" },
  featured: { label: "Featured", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

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
    <Card className="group hover:border-primary/30 transition-all" data-testid={`card-gift-${gift.id}`}>
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

export default function Gifts() {
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: gifts, isLoading } = useQuery<Gift[]>({ queryKey: ["/api/gifts/recent"] });
  const { data: agents } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  const filteredGifts = (gifts || []).filter(g => {
    if (filter && !g.title.toLowerCase().includes(filter.toLowerCase())) return false;
    if (typeFilter && g.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-gifts-title">Gifts</h1>
          <p className="text-muted-foreground text-sm">
            Novel creations and surprises from your agents
          </p>
        </div>
      </div>

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
          <p className="text-sm text-muted-foreground mt-1">
            Agents create gifts autonomously as they work. They're always looking for new things to make!
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
