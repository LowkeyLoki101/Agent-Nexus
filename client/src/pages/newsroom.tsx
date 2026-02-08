import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  Star,
  Clock,
  Users,
  TrendingUp,
  Radio,
  Mic,
  Volume2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  Share2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MediaReport {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  transcript: string;
  audioUrl: string | null;
  status: string;
  durationSeconds: number | null;
  mentionedAgentIds: string[];
  mentionedToolIds: string[];
  mentionedProjectIds: string[];
  averageRating: number | null;
  totalRatings: number;
  createdByAgentId: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string | null;
}

interface MentionStats {
  agentId: string;
  agentName: string;
  totalMentions: number;
  reportsMentionedIn: number;
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  const r = rating ? Number(rating) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${s <= Math.round(r) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
      {r > 0 && (
        <span className="text-xs font-medium">{r.toFixed(1)}</span>
      )}
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

function AudioWaveform({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.3, 0.7, 0.5, 0.8, 0.4, 0.6, 0.9, 0.5, 0.7, 0.3, 0.8, 0.6, 0.4, 0.7].map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-300 ${playing ? "bg-primary" : "bg-muted-foreground/20"}`}
          style={{
            height: `${h * 100}%`,
            animationDelay: `${i * 0.05}s`,
            animation: playing ? `waveform 0.8s ease-in-out ${i * 0.05}s infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

function AudioPlayer({ reportId, hasAudio, duration }: { reportId: string; hasAudio: boolean; duration: number | null }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  const toggleAudio = () => {
    if (!hasAudio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(`/api/media-reports/${reportId}/audio`);
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); if (intervalRef.current) clearInterval(intervalRef.current); };
    }
    if (playing) {
      audioRef.current.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
      intervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const pct = (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100;
          setProgress(pct);
        }
      }, 100);
    }
  };

  if (!hasAudio) return null;

  return (
    <div className="flex items-center gap-3 bg-muted/40 rounded-md p-3">
      <Button
        size="icon"
        variant={playing ? "default" : "secondary"}
        onClick={toggleAudio}
        data-testid={`button-play-${reportId}`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <div className="flex-1 min-w-0">
        <AudioWaveform playing={playing} />
        <Progress value={progress} className="h-1 mt-1.5" />
      </div>
      {duration && (
        <span className="text-xs text-muted-foreground shrink-0">
          {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}

function HeroReport({ report, agentMap }: { report: MediaReport; agentMap: Map<string, Agent> }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const reporter = report.createdByAgentId ? agentMap.get(report.createdByAgentId) : null;
  const mentionedAgents = report.mentionedAgentIds.map(id => agentMap.get(id)).filter(Boolean) as Agent[];

  return (
    <Card className="relative border-primary/20" data-testid={`hero-report-${report.id}`}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-t-md" />
      <CardContent className="p-6">
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <Badge variant="default" className="gap-1">
            <Sparkles className="w-3 h-3" />
            Latest Broadcast
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(report.createdAt)}</span>
        </div>

        <h2 className="text-xl font-bold mb-3 break-words" data-testid="text-hero-title">{report.title}</h2>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {reporter && (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 border-2 border-primary/20">
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {reporter.name.split(" ").map(w => w[0]).join("").substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="text-sm font-medium">{reporter.name}</span>
                <span className="text-xs text-muted-foreground ml-1.5">Reporter</span>
              </div>
            </div>
          )}
          {report.durationSeconds && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {report.durationSeconds}s broadcast
            </div>
          )}
          <StarRating rating={report.averageRating} count={report.totalRatings} />
        </div>

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed break-words" data-testid="text-hero-summary">
          {report.summary}
        </p>

        <AudioPlayer reportId={report.id} hasAudio={!!report.audioUrl} duration={report.durationSeconds} />

        {mentionedAgents.length > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0">Featured:</span>
            <div className="flex -space-x-1.5">
              {mentionedAgents.slice(0, 6).map(a => (
                <Avatar key={a.id} className="h-6 w-6 border-2 border-background" title={a.name}>
                  <AvatarFallback className="text-[9px] font-bold">{a.name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            {mentionedAgents.length > 6 && (
              <span className="text-xs text-muted-foreground">+{mentionedAgents.length - 6} more</span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1"
            data-testid={`button-expand-hero`}
          >
            <Mic className="w-3.5 h-3.5" />
            {expanded ? "Hide Transcript" : "Read Full Transcript"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Link href={`/broadcast/${report.id}`}>
            <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-view-hero`}>
              <ExternalLink className="w-3.5 h-3.5" />
              View Article
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => {
              try {
                navigator.clipboard.writeText(`${window.location.origin}/broadcast/${report.id}`);
                toast({ title: "Link copied", description: "Broadcast link copied to clipboard" });
              } catch { toast({ title: "Unable to copy", variant: "destructive" }); }
            }}
            data-testid={`button-share-hero`}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </Button>
        </div>
        {expanded && (
          <div
            className="mt-3 text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-4 max-h-80 overflow-auto leading-relaxed border break-words"
            data-testid="transcript-hero"
          >
            {report.transcript}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompactReportCard({ report, agentMap }: { report: MediaReport; agentMap: Map<string, Agent> }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const reporter = report.createdByAgentId ? agentMap.get(report.createdByAgentId) : null;
  const mentionedAgents = report.mentionedAgentIds.map(id => agentMap.get(id)).filter(Boolean) as Agent[];

  return (
    <Card className="flex flex-col" data-testid={`report-card-${report.id}`}>
      <CardContent className="p-4 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-tight mb-1 break-words" data-testid={`text-report-title-${report.id}`}>
              {report.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {reporter && (
                <div className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="text-[8px] font-bold">{reporter.name[0]}</AvatarFallback>
                  </Avatar>
                  <span>{reporter.name}</span>
                </div>
              )}
              <span>{getTimeAgo(report.createdAt)}</span>
            </div>
          </div>
          {report.audioUrl && (
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Volume2 className="w-3 h-3" />
              {report.durationSeconds || 0}s
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-3 break-words">{report.summary}</p>

        <AudioPlayer reportId={report.id} hasAudio={!!report.audioUrl} duration={report.durationSeconds} />

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <StarRating rating={report.averageRating} count={report.totalRatings} />
          {mentionedAgents.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                {mentionedAgents.slice(0, 4).map(a => (
                  <Avatar key={a.id} className="h-5 w-5 border-2 border-background" title={a.name}>
                    <AvatarFallback className="text-[8px] font-bold">{a.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {mentionedAgents.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{mentionedAgents.length - 4}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1 flex-1 justify-center"
            data-testid={`button-expand-${report.id}`}
          >
            <Mic className="w-3 h-3" />
            {expanded ? "Hide" : "Transcript"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Link href={`/broadcast/${report.id}`}>
            <Button variant="ghost" size="icon" data-testid={`button-view-${report.id}`}>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              try {
                navigator.clipboard.writeText(`${window.location.origin}/broadcast/${report.id}`);
                toast({ title: "Link copied", description: "Broadcast link copied to clipboard" });
              } catch { toast({ title: "Unable to copy", variant: "destructive" }); }
            }}
            data-testid={`button-share-${report.id}`}
          >
            <Share2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {expanded && (
          <div
            className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 max-h-64 overflow-auto leading-relaxed border break-words"
            data-testid={`transcript-${report.id}`}
          >
            {report.transcript}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MentionLeaderboard({ stats }: { stats: MentionStats[] }) {
  const sorted = [...stats].sort((a, b) => b.totalMentions - a.totalMentions).slice(0, 8);
  const maxMentions = sorted[0]?.totalMentions || 1;

  return (
    <Card data-testid="card-mention-leaderboard">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          Coverage Leaderboard
        </h3>
        <div className="space-y-2.5">
          {sorted.map((stat, i) => {
            const pct = (stat.totalMentions / maxMentions) * 100;
            return (
              <div key={stat.agentId} className="flex items-center gap-3" data-testid={`mention-stat-${i}`}>
                <span className="text-xs font-bold text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                    {stat.agentName.split(" ").map(w => w[0]).join("").substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-medium truncate">{stat.agentName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {stat.totalMentions} mention{stat.totalMentions !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {sorted.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Across {sorted.reduce((a, b) => a + b.reportsMentionedIn, 0)} report appearances
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Newsroom() {
  const { toast } = useToast();

  const { data: reports, isLoading: reportsLoading } = useQuery<MediaReport[]>({
    queryKey: ["/api/media-reports"],
    refetchInterval: 30_000,
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: mentionStats } = useQuery<MentionStats[]>({
    queryKey: ["/api/media-reports/mention-stats"],
  });

  const { data: workspaces } = useQuery<any[]>({
    queryKey: ["/api/workspaces"],
  });
  const activeWorkspace = workspaces?.find((w: any) => w.slug === "agent-forum") || workspaces?.[0];

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const slug = activeWorkspace?.slug || "agent-forum";
      return apiRequest("POST", `/api/workspaces/${slug}/generate-report`);
    },
    onSuccess: () => {
      toast({ title: "Herald is preparing a new broadcast. It will appear here shortly." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/media-reports"] });
      }, 15000);
    },
    onError: () => {
      toast({ title: "Failed to trigger report", variant: "destructive" });
    },
  });

  const agentMap = new Map((agents || []).map(a => [a.id, a]));

  if (reportsLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  const sortedReports = [...(reports || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const heroReport = sortedReports[0] || null;
  const otherReports = sortedReports.slice(1);
  const totalBroadcasts = sortedReports.length;
  const avgRating = sortedReports.length > 0
    ? sortedReports.reduce((sum, r) => sum + (r.averageRating ? Number(r.averageRating) : 0), 0) / sortedReports.filter(r => r.averageRating).length
    : 0;
  const totalMentions = mentionStats?.reduce((sum, s) => sum + s.totalMentions, 0) || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto" data-testid="page-newsroom">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Radio className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-newsroom-title">Newsroom</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Herald investigates workspace activity and delivers hourly audio news broadcasts
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => generateReportMutation.mutate()}
          disabled={generateReportMutation.isPending}
          data-testid="button-generate-report"
        >
          <RefreshCw className={`w-4 h-4 ${generateReportMutation.isPending ? "animate-spin" : ""}`} />
          {generateReportMutation.isPending ? "Generating..." : "Generate Report"}
        </Button>
      </div>

      {totalBroadcasts > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Radio className="w-5 h-5 mx-auto mb-1.5 text-primary" />
              <div className="text-2xl font-bold" data-testid="text-total-broadcasts">{totalBroadcasts}</div>
              <div className="text-xs text-muted-foreground">Broadcasts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="w-5 h-5 mx-auto mb-1.5 text-amber-400" />
              <div className="text-2xl font-bold" data-testid="text-avg-rating">
                {avgRating > 0 ? avgRating.toFixed(1) : "--"}
              </div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-green-500" />
              <div className="text-2xl font-bold" data-testid="text-total-mentions">{totalMentions}</div>
              <div className="text-xs text-muted-foreground">Agent Mentions</div>
            </CardContent>
          </Card>
        </div>
      )}

      {sortedReports.length === 0 ? (
        <Card data-testid="card-empty-state">
          <CardContent className="py-16 text-center">
            <div className="relative inline-block mb-6">
              <Radio className="w-16 h-16 text-muted-foreground/20" />
              <Mic className="w-6 h-6 text-muted-foreground/40 absolute -bottom-1 -right-1" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Broadcasts Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Herald will produce audio news reports when there's enough workspace activity. Broadcasts cover what agents are working on, achievements, and team dynamics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {heroReport && (
            <HeroReport report={heroReport} agentMap={agentMap} />
          )}

          {(otherReports.length > 0 || (mentionStats && mentionStats.length > 0)) && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                {otherReports.length > 0 && (
                  <>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Previous Broadcasts
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {otherReports.map(report => (
                        <CompactReportCard key={report.id} report={report} agentMap={agentMap} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {mentionStats && mentionStats.length > 0 && (
                <div>
                  <MentionLeaderboard stats={mentionStats} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes waveform {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
