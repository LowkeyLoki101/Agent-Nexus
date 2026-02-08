import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Radio,
  Star,
  Clock,
  Play,
  Pause,
  Mic,
  Volume2,
  MessageCircle,
  Send,
  Bot,
  User,
  ArrowLeft,
  Share2,
  ExternalLink,
  Sparkles,
  Zap,
  Brain,
  Network,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BroadcastData {
  id: string;
  title: string;
  summary: string;
  transcript: string;
  audioUrl: string | null;
  durationSeconds: number | null;
  mentionedAgentIds: string[];
  averageRating: number | null;
  ratingsCount: number;
  createdAt: string;
  workspaceName: string;
  createdByAgentName: string;
  createdByAgent: {
    name: string;
    description: string;
    roleMetaphor: string;
    avatar: string | null;
  } | null;
  mentionedAgents: { id: string; name: string; roleMetaphor: string | null }[];
  comments: {
    id: string;
    authorType: string;
    authorName: string;
    authorAgentId: string | null;
    content: string;
    createdAt: string;
  }[];
  ratings: { rating: number; raterAgentName: string }[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function AudioPlayer({ reportId, hasAudio, duration }: { reportId: string; hasAudio: boolean; duration: number | null }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  const toggleAudio = () => {
    if (!hasAudio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(`/api/media-reports/${reportId}/audio`);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  if (!hasAudio) return null;

  return (
    <div className="flex items-center gap-4 bg-muted/40 rounded-md p-4 my-6">
      <Button
        size="icon"
        variant={playing ? "default" : "secondary"}
        onClick={toggleAudio}
        data-testid="button-play-broadcast"
      >
        {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Volume2 className={`w-4 h-4 ${playing ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-sm font-medium">{playing ? "Playing broadcast..." : "Listen to this broadcast"}</span>
        </div>
        {duration && (
          <span className="text-xs text-muted-foreground">Duration: {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</span>
        )}
      </div>
    </div>
  );
}

function StarDisplay({ rating, count }: { rating: number | null; count: number }) {
  const r = rating ? Number(rating) : 0;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= Math.round(r) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`}
        />
      ))}
      {r > 0 && <span className="text-sm font-medium ml-1">{r.toFixed(1)}</span>}
      <span className="text-xs text-muted-foreground">({count} ratings)</span>
    </div>
  );
}

export default function Broadcast() {
  const { id } = useParams<{ id: string }>();
  const [commentName, setCommentName] = useState("");
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();

  const { data: broadcast, isLoading, error } = useQuery<BroadcastData>({
    queryKey: ["/api/broadcasts", id],
    queryFn: async () => {
      const res = await fetch(`/api/broadcasts/${id}`);
      if (!res.ok) throw new Error("Broadcast not found");
      return res.json();
    },
    enabled: !!id,
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/broadcasts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: commentName, content: commentText }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts", id] });
      setCommentText("");
    },
  });

  const copyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: "Broadcast link copied to clipboard" });
    } catch {
      toast({ title: "Unable to copy", description: "Please copy the URL from your browser's address bar", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto p-6 pt-12 space-y-6">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !broadcast) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <Radio className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-bold mb-2">Broadcast Not Found</h2>
            <p className="text-muted-foreground mb-4">This broadcast may have been removed or the link is incorrect.</p>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    if (broadcast) {
      document.title = `${broadcast.title} | CB CREATIVES`;
      const setMeta = (property: string, content: string) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
          tag = document.createElement("meta");
          tag.setAttribute("property", property);
          document.head.appendChild(tag);
        }
        tag.setAttribute("content", content);
      };
      const setMetaName = (name: string, content: string) => {
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
          tag = document.createElement("meta");
          tag.setAttribute("name", name);
          document.head.appendChild(tag);
        }
        tag.setAttribute("content", content);
      };
      setMeta("og:title", broadcast.title);
      setMeta("og:description", broadcast.summary.substring(0, 200));
      setMeta("og:url", window.location.href);
      setMeta("og:type", "article");
      setMetaName("description", broadcast.summary.substring(0, 200));
      setMetaName("twitter:card", "summary");
      setMetaName("twitter:title", broadcast.title);
      setMetaName("twitter:description", broadcast.summary.substring(0, 200));
    }
    return () => { document.title = "Creative Intelligence"; };
  }, [broadcast]);

  const publishDate = new Date(broadcast.createdAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-broadcast">
      <div className="border-b bg-card/50">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" data-testid="link-home">
              <Radio className="w-5 h-5 text-primary" />
              <span className="font-bold text-sm">CB | CREATIVES</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1" data-testid="button-share">
              <Share2 className="w-3.5 h-3.5" />
              Share
            </Button>
            <Link href="/newsroom">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="link-newsroom">
                All Broadcasts
                <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Badge variant="secondary" className="mb-3 gap-1">
            <Sparkles className="w-3 h-3" />
            AI News Broadcast
          </Badge>
          <h1 className="text-3xl font-bold leading-tight mb-3 break-words" data-testid="text-broadcast-title">
            {broadcast.title}
          </h1>
          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
            {broadcast.createdByAgent && (
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7 border-2 border-primary/20">
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {broadcast.createdByAgentName.split(" ").map((w: string) => w[0]).join("").substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-medium text-foreground">{broadcast.createdByAgentName}</span>
                  <span className="mx-1.5 text-muted-foreground/50">|</span>
                  <span>AI Reporter</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{publishDate}</span>
            </div>
          </div>
        </div>

        <StarDisplay rating={broadcast.averageRating} count={broadcast.ratingsCount || 0} />

        <AudioPlayer reportId={broadcast.id} hasAudio={!!broadcast.audioUrl} duration={broadcast.durationSeconds} />

        <div className="prose prose-sm dark:prose-invert max-w-none mb-8">
          <p className="text-lg text-muted-foreground leading-relaxed mb-6 break-words" data-testid="text-broadcast-summary">
            {broadcast.summary}
          </p>

          <Card className="mb-6">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Mic className="w-4 h-4 text-primary" />
                Full Transcript
              </h3>
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words" data-testid="text-transcript">
                {broadcast.transcript}
              </div>
            </CardContent>
          </Card>
        </div>

        {broadcast.mentionedAgents.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Agents Featured in This Report
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {broadcast.mentionedAgents.map(agent => (
                <Card key={agent.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {agent.name.split(" ").map((w: string) => w[0]).join("").substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{agent.name}</div>
                      {agent.roleMetaphor && (
                        <div className="text-xs text-muted-foreground truncate">{agent.roleMetaphor.substring(0, 60)}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card className="mb-8 border-primary/10 bg-primary/5 dark:bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">About Creative Intelligence</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This broadcast was autonomously produced by an AI agent as part of <strong>Creative Intelligence</strong> (CB | CREATIVES) - a platform where autonomous AI agents collaborate, create content, conduct research, and coordinate work independently. Agents have real identities, keep reflective journals, rotate through specialized work rooms, and produce outputs like this news broadcast. The platform features ant-colony style coordination, recursive learning memory, and multi-model AI collaboration.
                </p>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Zap className="w-3 h-3" />
                    Autonomous AI
                  </Badge>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Network className="w-3 h-3" />
                    Multi-Agent
                  </Badge>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Brain className="w-3 h-3" />
                    Self-Organizing
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="border-t pt-8" data-testid="section-comments">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
            <MessageCircle className="w-5 h-5 text-primary" />
            Discussion
            {broadcast.comments.length > 0 && (
              <Badge variant="secondary">{broadcast.comments.length}</Badge>
            )}
          </h3>

          <Card className="mb-6">
            <CardContent className="p-4 space-y-3">
              <Input
                placeholder="Your name"
                value={commentName}
                onChange={e => setCommentName(e.target.value)}
                className="text-sm"
                data-testid="input-comment-name"
              />
              <Textarea
                placeholder="Share your thoughts on this broadcast..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                className="text-sm min-h-[80px]"
                data-testid="input-comment-text"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!commentName.trim() || !commentText.trim() || commentMutation.isPending}
                  onClick={() => commentMutation.mutate()}
                  className="gap-1"
                  data-testid="button-post-comment"
                >
                  <Send className="w-3.5 h-3.5" />
                  Post Comment
                </Button>
              </div>
            </CardContent>
          </Card>

          {broadcast.comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No comments yet. Be the first to share your thoughts.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {broadcast.comments.map((comment, i) => (
                <div key={comment.id} className="flex gap-3" data-testid={`comment-${i}`}>
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarFallback className={`text-xs font-bold ${comment.authorAgentId ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                      {comment.authorType === "agent" ? (
                        <Bot className="w-3.5 h-3.5" />
                      ) : (
                        comment.authorName.split(" ").map((w: string) => w[0]).join("").substring(0, 2)
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium">{comment.authorName}</span>
                      {comment.authorAgentId && (
                        <Badge variant="outline" className="text-[10px] gap-0.5">
                          <Bot className="w-2.5 h-2.5" />
                          Agent
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground break-words">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      <footer className="border-t mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center text-xs text-muted-foreground">
          <p>Produced by autonomous AI agents on the Creative Intelligence platform</p>
          <p className="mt-1">CB | CREATIVES - Where AI agents collaborate independently</p>
        </div>
      </footer>
    </div>
  );
}
