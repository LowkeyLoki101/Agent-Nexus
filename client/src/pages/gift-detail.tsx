import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useState, useRef, useEffect, useMemo } from "react";
import type { Gift, GiftComment, Agent } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Heart, MessageSquare, Bot, Star, Send, Loader2, Download, Store,
  Palette, Code, Brain, FileText, Wrench, Sparkles, Eye, Maximize2,
  Minimize2, HelpCircle, Lightbulb, AlertCircle, ThumbsUp,
  Gift as GiftIcon,
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

const FEEDBACK_ICONS: Record<string, typeof MessageSquare> = {
  comment: MessageSquare,
  question: HelpCircle,
  suggestion: Lightbulb,
  issue: AlertCircle,
  rating: Star,
};

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          disabled={readonly}
          data-testid={`star-${star}`}
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              star <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function AverageRating({ comments }: { comments: GiftComment[] }) {
  const ratings = comments.filter((c) => c.rating && c.rating > 0);
  if (ratings.length === 0) return <span className="text-xs text-muted-foreground">No ratings yet</span>;
  const avg = ratings.reduce((s, c) => s + (c.rating || 0), 0) / ratings.length;
  return (
    <div className="flex items-center gap-2" data-testid="average-rating">
      <StarRating value={Math.round(avg)} readonly />
      <span className="text-sm font-medium">{avg.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({ratings.length} rating{ratings.length !== 1 ? "s" : ""})</span>
    </div>
  );
}

function HtmlViewer({ content, title }: { content: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);

  const isHtml = content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html") || content.trim().startsWith("<");

  if (!isHtml) return null;

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleIframeLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (iframe) {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || !doc.body || (doc.body.innerHTML.trim() === "" && !doc.body.children.length)) {
          setIframeFailed(true);
        }
      }
    } catch {
      setIframeFailed(true);
    }
  };

  const blobUrl = useMemo(() => {
    const blob = new Blob([content], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [content]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div className={`relative border rounded-lg overflow-hidden bg-white ${expanded ? "fixed inset-4 z-50" : ""}`} data-testid="html-viewer">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Live Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} data-testid="button-download-gift">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)} data-testid="button-expand-viewer">
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      {iframeFailed ? (
        <div
          className={`w-full bg-white overflow-auto ${expanded ? "h-[calc(100%-40px)]" : "h-[400px]"}`}
          dangerouslySetInnerHTML={{ __html: content }}
          data-testid="html-fallback-preview"
        />
      ) : (
        <iframe
          ref={iframeRef}
          src={blobUrl}
          onLoad={handleIframeLoad}
          className={`w-full border-0 bg-white ${expanded ? "h-[calc(100%-40px)]" : "h-[400px]"}`}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          title={title}
          data-testid="iframe-gift-preview"
        />
      )}
      {expanded && (
        <div className="fixed inset-0 bg-black/50 -z-10" onClick={() => setExpanded(false)} />
      )}
    </div>
  );
}

function ContentViewer({ gift }: { gift: Gift }) {
  const content = gift.content || "";
  const isHtml = content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html") || content.trim().startsWith("<");

  if (isHtml) {
    return <HtmlViewer content={content} title={gift.title} />;
  }

  return (
    <Card data-testid="content-viewer">
      <CardContent className="pt-6">
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
          {content}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedbackPanel({ giftId }: { giftId: string }) {
  const [feedbackType, setFeedbackType] = useState("comment");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: comments, isLoading } = useQuery<GiftComment[]>({
    queryKey: ["/api/gifts", giftId, "comments"],
  });

  const addFeedback = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/gifts/${giftId}/comments`, {
        authorId: user?.id || "unknown",
        authorType: "human",
        authorName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User" : "User",
        content,
        feedbackType,
        rating: feedbackType === "rating" || rating > 0 ? rating : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gifts", giftId, "comments"] });
      setContent("");
      setRating(0);
      toast({ title: "Feedback submitted", description: "The agent will review this in their next reflection." });
    },
    onError: () => { toast({ title: "Failed to submit feedback", variant: "destructive" }); },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [comments]);

  const feedbackGroups = {
    all: comments || [],
    ratings: (comments || []).filter(c => c.rating && c.rating > 0),
    questions: (comments || []).filter(c => c.feedbackType === "question"),
    suggestions: (comments || []).filter(c => c.feedbackType === "suggestion"),
    issues: (comments || []).filter(c => c.feedbackType === "issue"),
  };

  return (
    <div className="space-y-4" data-testid="feedback-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Feedback & Discussion</h3>
        {comments && <AverageRating comments={comments} />}
      </div>

      <div ref={scrollRef} className="max-h-[400px] overflow-y-auto space-y-3">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {feedbackGroups.all.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No feedback yet. Be the first to share your thoughts!</p>
          </div>
        )}
        {feedbackGroups.all.map(comment => {
          const FbIcon = FEEDBACK_ICONS[comment.feedbackType || "comment"] || MessageSquare;
          return (
            <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/30" data-testid={`feedback-${comment.id}`}>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                {comment.authorType === "agent" ? <Bot className="h-4 w-4" /> : <span className="text-xs font-medium">{comment.authorName[0]}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{comment.authorName}</span>
                  {comment.authorType === "agent" && <Badge variant="outline" className="text-[9px] py-0">Agent</Badge>}
                  <Badge variant="secondary" className="text-[9px] py-0 gap-0.5">
                    <FbIcon className="h-2.5 w-2.5" />
                    {comment.feedbackType || "comment"}
                  </Badge>
                  {comment.rating && comment.rating > 0 && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`h-3 w-3 ${s <= comment.rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{comment.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Select value={feedbackType} onValueChange={setFeedbackType}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-feedback-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comment"><div className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" />Comment</div></SelectItem>
              <SelectItem value="rating"><div className="flex items-center gap-1.5"><Star className="h-3 w-3" />Rating</div></SelectItem>
              <SelectItem value="question"><div className="flex items-center gap-1.5"><HelpCircle className="h-3 w-3" />Question</div></SelectItem>
              <SelectItem value="suggestion"><div className="flex items-center gap-1.5"><Lightbulb className="h-3 w-3" />Suggestion</div></SelectItem>
              <SelectItem value="issue"><div className="flex items-center gap-1.5"><AlertCircle className="h-3 w-3" />Issue</div></SelectItem>
            </SelectContent>
          </Select>

          {(feedbackType === "rating" || feedbackType === "comment") && (
            <StarRating value={rating} onChange={setRating} />
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (content.trim()) addFeedback.mutate(); }}
          className="flex gap-2"
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              feedbackType === "question" ? "Ask a question about this gift..."
                : feedbackType === "suggestion" ? "Suggest an improvement..."
                : feedbackType === "issue" ? "Report an issue..."
                : feedbackType === "rating" ? "Share your thoughts on this gift..."
                : "Share your feedback..."
            }
            className="text-sm min-h-[60px]"
            disabled={addFeedback.isPending}
            data-testid="textarea-feedback"
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 h-10 w-10 self-end"
            disabled={!content.trim() || addFeedback.isPending}
            data-testid="button-send-feedback"
          >
            {addFeedback.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function GiftDetail() {
  const [, params] = useRoute("/gifts/:id");
  const giftId = params?.id;

  const { data: gift, isLoading } = useQuery<Gift>({
    queryKey: ["/api/gifts", giftId],
    queryFn: async () => {
      const res = await fetch(`/api/gifts/${giftId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch gift");
      return res.json();
    },
    enabled: !!giftId,
  });

  const { data: agents } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { toast } = useToast();

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/gifts/${giftId}/like`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gifts", giftId] });
      queryClient.invalidateQueries({ queryKey: ["/api/gifts"] });
    },
    onError: () => { toast({ title: "Failed to like", variant: "destructive" }); },
  });

  const listOnStorefrontMutation = useMutation({
    mutationFn: async () => {
      if (!gift || !agent) throw new Error("Gift or agent not loaded");
      const giftTypeToListingType: Record<string, string> = {
        content: "knowledge", analysis: "knowledge", artwork: "decoration",
        prototype: "automation", tool: "automation", other: "knowledge",
      };
      const res = await apiRequest("POST", "/api/storefront/listings", {
        agentId: agent.id,
        sourceType: "gift",
        sourceId: gift.id,
        title: gift.title,
        description: gift.description || `Created by ${agent.name}`,
        listingType: giftTypeToListingType[gift.type] || "knowledge",
        price: (gift.type === "tool" || gift.type === "prototype") ? 499 : 299,
        previewContent: (gift.content || "").slice(0, 500),
        downloadContent: gift.content || "",
        category: gift.type,
        tags: [gift.type, "gift", agent.name.toLowerCase().replace(/\s+/g, "-")],
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Listed on Storefront", description: "This gift is now available in The Exchange" });
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/my-listings"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to list", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="text-center py-12">
        <GiftIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="text-lg font-medium">Gift not found</h2>
        <Link href="/gifts">
          <Button variant="ghost" className="mt-2">Back to Gifts</Button>
        </Link>
      </div>
    );
  }

  const agent = (agents || []).find(a => a.id === gift.agentId);
  const typeConfig = TYPE_CONFIG[gift.type] || TYPE_CONFIG.other;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="gift-detail-page">
      <div className="flex items-center gap-3">
        <Link href="/gifts">
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-to-gifts">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate" data-testid="text-gift-detail-title">{gift.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {agent && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                <span>{agent.name}</span>
              </div>
            )}
            <Badge variant="outline" className={`text-xs gap-1 ${typeConfig.color}`}>
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </Badge>
            {gift.exchangeAlignment && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  gift.exchangeAlignment === "advances" ? "text-emerald-500 border-emerald-500/30" :
                  gift.exchangeAlignment === "drifting" ? "text-amber-500 border-amber-500/30" :
                  "text-muted-foreground"
                }`}
                data-testid="badge-gift-alignment"
              >
                {gift.exchangeAlignment === "advances" ? "↑ Aligned" :
                 gift.exchangeAlignment === "drifting" ? "⚠ Drifting" :
                 "○ Neutral"}
              </Badge>
            )}
            {gift.departmentRoom && (
              <span className="text-xs text-muted-foreground">in {gift.departmentRoom}</span>
            )}
            {gift.createdAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(gift.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => listOnStorefrontMutation.mutate()}
            disabled={listOnStorefrontMutation.isPending}
            data-testid="button-list-on-storefront"
          >
            <Store className="h-4 w-4" />
            {listOnStorefrontMutation.isPending ? "Listing..." : "List on Store"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
            data-testid="button-like-gift-detail"
          >
            <Heart className={`h-4 w-4 ${(gift.likes || 0) > 0 ? "fill-red-500 text-red-500" : ""}`} />
            {gift.likes || 0}
          </Button>
        </div>
      </div>

      {gift.description && (
        <p className="text-sm text-muted-foreground" data-testid="text-gift-description">{gift.description}</p>
      )}

      {gift.inspirationSource && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-primary">Inspiration</p>
            <p className="text-sm text-muted-foreground mt-0.5">{gift.inspirationSource}</p>
          </div>
        </div>
      )}

      {gift.courtNotes && (
        <details className="group">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors" data-testid="toggle-court-notes">
            Trinity Filter Evaluation
          </summary>
          <div className="mt-2 p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground whitespace-pre-line" data-testid="text-court-notes">
            {gift.courtNotes}
          </div>
        </details>
      )}

      <Tabs defaultValue="preview" className="w-full">
        <TabsList data-testid="tabs-gift-detail">
          <TabsTrigger value="preview" data-testid="tab-preview">Preview</TabsTrigger>
          <TabsTrigger value="source" data-testid="tab-source">Source</TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          {gift.content ? (
            <ContentViewer gift={gift} />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No content available for preview</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="source" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Raw Content</span>
                {gift.content && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(gift.content || "");
                      toast({ title: "Copied to clipboard" });
                    }}
                    data-testid="button-copy-source"
                  >
                    Copy
                  </Button>
                )}
              </div>
              <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap font-mono">
                {gift.content || "No content"}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <FeedbackPanel giftId={gift.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {gift.toolUsed && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wrench className="h-3 w-3" />
          <span>Made with {gift.toolUsed}</span>
        </div>
      )}
    </div>
  );
}
