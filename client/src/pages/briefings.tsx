import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Radio,
  Play,
  Pause,
  Volume2,
  Newspaper,
  Zap,
  MessageSquare,
  Bot,
  Loader2,
  X,
  Users,
  Settings,
  Mic,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import type { Briefing, NewsroomInterview, NewsroomSettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AgentInterviewStatus {
  agentId: string;
  agentName: string;
  lastInterviewAt: string | null;
  cooldownMinutesRemaining: number;
  isAvailable: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  ANALYST: "bg-orange-500",
  BUILDER: "bg-blue-500",
  CRITIC: "bg-red-500",
  STRATEGIST: "bg-green-500",
  RESEARCHER: "bg-purple-500",
  COLBY: "bg-amber-500",
};

function getAgentColor(name: string): string {
  const upper = name.toUpperCase();
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (upper.includes(key)) return color;
  }
  const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-red-500", "bg-cyan-500", "bg-pink-500", "bg-amber-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function timeAgo(date: string | Date | null): string {
  if (!date) return "never";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LatestBroadcastPanel({ briefing, settings }: { briefing: Briefing | undefined; settings: NewsroomSettings | undefined }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();
  const isGenerating = settings?.broadcastStatus === "generating";

  const generateBroadcast = useMutation({
    mutationFn: () => apiRequest("POST", "/api/newsroom/generate-broadcast"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/newsroom/settings"] });
      toast({ title: "Broadcast generated" });
    },
    onError: (e: any) => toast({ title: "Broadcast failed", description: e.message, variant: "destructive" }),
  });

  const interviewAll = useMutation({
    mutationFn: () => apiRequest("POST", "/api/newsroom/interview-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsroom/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/newsroom/agent-status"] });
      toast({ title: "Interview round completed" });
    },
    onError: (e: any) => toast({ title: "Interviews failed", description: e.message, variant: "destructive" }),
  });

  const togglePlay = () => {
    if (!audioRef.current || !briefing?.audioUrl) return;
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  };

  return (
    <Card className="border-primary/30" data-testid="panel-latest-broadcast">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Latest Broadcast</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isGenerating || generateBroadcast.isPending ? "default" : "outline"}
              className="text-xs gap-1.5"
              onClick={() => generateBroadcast.mutate()}
              disabled={isGenerating || generateBroadcast.isPending}
              data-testid="button-generate-broadcast"
            >
              {isGenerating || generateBroadcast.isPending ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
              ) : (
                <><Radio className="h-3 w-3" /> Generate</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => interviewAll.mutate()}
              disabled={interviewAll.isPending}
              data-testid="button-interviews"
            >
              {interviewAll.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Interviews
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1.5" data-testid="button-auto">
              <Settings className="h-3 w-3" /> Auto
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {briefing ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base" data-testid="text-latest-broadcast-title">{briefing.title}</h3>
              <span className="text-xs text-muted-foreground">{timeAgo(briefing.createdAt)}</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {briefing.summary || briefing.content.slice(0, 200)}
            </p>
            {briefing.audioUrl && (
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={togglePlay} data-testid="button-play-latest">
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <audio ref={audioRef} src={briefing.audioUrl} onEnded={() => setIsPlaying(false)} />
              </div>
            )}
            {briefing.tags && briefing.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {briefing.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Radio className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No broadcasts yet. Generate one to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AutonomyPanel({ settings }: { settings: NewsroomSettings | undefined }) {
  const { toast } = useToast();

  const updateSettings = useMutation({
    mutationFn: (updates: any) => apiRequest("PUT", "/api/newsroom/settings", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsroom/settings"] });
      toast({ title: "Newsroom settings updated" });
    },
  });

  const intervalMinutes = settings?.autoBroadcastIntervalMinutes || 60;
  const autoPlay = settings?.autoPlayEnabled || false;

  const intervalOptions = [
    { label: "Every 15 min", value: "15" },
    { label: "Every 30 min", value: "30" },
    { label: "Every hour", value: "60" },
    { label: "Every 2 hours", value: "120" },
    { label: "Every 4 hours", value: "240" },
  ];

  const nextBroadcastIn = () => {
    if (!settings?.lastBroadcastAt) return "N/A";
    const last = new Date(settings.lastBroadcastAt).getTime();
    const next = last + intervalMinutes * 60 * 1000;
    const diff = next - Date.now();
    if (diff <= 0) return "Soon";
    const mins = Math.ceil(diff / 60000);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
  };

  return (
    <Card data-testid="panel-autonomy">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider">Autonomy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Auto-broadcast interval</label>
          <Select
            value={String(intervalMinutes)}
            onValueChange={(val) => updateSettings.mutate({ autoBroadcastIntervalMinutes: parseInt(val) })}
          >
            <SelectTrigger className="h-9 text-sm" data-testid="select-broadcast-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intervalOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Next auto-broadcast in {nextBroadcastIn()}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => updateSettings.mutate({ autoPlayEnabled: e.target.checked })}
            className="rounded border-muted"
            data-testid="checkbox-autoplay"
          />
          <label className="text-xs text-muted-foreground">Auto-play when ready</label>
        </div>
      </CardContent>
    </Card>
  );
}

function EmergentInterviewsPanel({ agentStatuses }: { agentStatuses: AgentInterviewStatus[] }) {
  const { toast } = useToast();

  const interviewAgent = useMutation({
    mutationFn: (agentId: string) => apiRequest("POST", `/api/newsroom/interview/${agentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsroom/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/newsroom/agent-status"] });
      toast({ title: "Interview completed" });
    },
    onError: (e: any) => toast({ title: "Interview failed", description: e.message, variant: "destructive" }),
  });

  const runAll = useMutation({
    mutationFn: () => apiRequest("POST", "/api/newsroom/interview-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsroom/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/newsroom/agent-status"] });
      toast({ title: "All interviews completed" });
    },
    onError: (e: any) => toast({ title: "Run all failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="panel-emergent-interviews">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Emergent Interviews</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-6"
            onClick={() => runAll.mutate()}
            disabled={runAll.isPending}
            data-testid="button-run-all-interviews"
          >
            {runAll.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run All"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {agentStatuses.map((agent) => (
          <div key={agent.agentId} className="flex items-center justify-between" data-testid={`interview-agent-${agent.agentId}`}>
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] text-white ${getAgentColor(agent.agentName)}`}>
                {agent.agentName.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {agent.isAvailable ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-6 px-2"
                  onClick={() => interviewAgent.mutate(agent.agentId)}
                  disabled={interviewAgent.isPending}
                  data-testid={`button-interview-${agent.agentId}`}
                >
                  Interview
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{agent.cooldownMinutesRemaining}m cooldown</span>
              )}
            </div>
          </div>
        ))}
        {agentStatuses.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No agents available</p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentExcerptsPanel({ interviews, onSelectInterview }: { interviews: NewsroomInterview[]; onSelectInterview: (i: NewsroomInterview) => void }) {
  const completed = interviews.filter(i => i.status === "complete" && i.excerpt);

  return (
    <Card data-testid="panel-recent-excerpts">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider">Recent Excerpts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {completed.slice(0, 5).map((interview) => (
          <div
            key={interview.id}
            className="space-y-1 rounded-lg p-2 -mx-2 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => onSelectInterview(interview)}
            data-testid={`excerpt-${interview.id}`}
          >
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] text-white ${getAgentColor(interview.agentName)}`}>
                {interview.agentName.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">{timeAgo(interview.createdAt)}</span>
              <Mic className="h-3 w-3 text-muted-foreground/40 ml-auto" />
            </div>
            <p className="text-xs text-muted-foreground/80 italic line-clamp-2">"{interview.excerpt}"</p>
          </div>
        ))}
        {completed.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No excerpts yet</p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentInterviewsPanel({ interviews, onSelectInterview }: { interviews: NewsroomInterview[]; onSelectInterview: (i: NewsroomInterview) => void }) {
  const allInterviews = interviews.filter(i => i.status === "complete" || i.status === "failed");

  return (
    <Card data-testid="panel-recent-interviews">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider">Interview Archive</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {allInterviews.slice(0, 10).map((interview) => (
          <div
            key={interview.id}
            className="flex items-center justify-between rounded-lg p-2 -mx-2 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => onSelectInterview(interview)}
            data-testid={`interview-archive-${interview.id}`}
          >
            <div className="flex items-center gap-2">
              <Mic className="h-3.5 w-3.5 text-primary/60" />
              <Badge className={`text-[10px] text-white ${getAgentColor(interview.agentName)}`}>
                {interview.agentName.toUpperCase()}
              </Badge>
              {interview.status === "failed" && (
                <Badge variant="outline" className="text-[10px] text-red-400 border-red-400/30">FAILED</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo(interview.createdAt)}</span>
          </div>
        ))}
        {allInterviews.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No interviews yet</p>
        )}
      </CardContent>
    </Card>
  );
}

function InterviewModal({ interview, onClose }: { interview: NewsroomInterview; onClose: () => void }) {
  const questions = interview.questions || [];
  const answers = interview.answers || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border rounded-xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-bold text-sm">INTERVIEW WITH <span className="text-primary">{interview.agentName.toUpperCase()}</span></h3>
            <p className="text-xs text-muted-foreground">{timeAgo(interview.createdAt)} · {interview.model}</p>
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose} data-testid="button-close-interview">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {interview.status === "failed" ? (
            <div className="text-center py-6">
              <p className="text-sm text-red-500">{interview.errorMessage || "Interview failed"}</p>
            </div>
          ) : (
            questions.map((q, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-primary">Q: {q}</p>
                <p className="text-sm">{answers[i] || "No response"}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ArchiveList({ briefings, interviews }: { briefings: Briefing[]; interviews: NewsroomInterview[] }) {
  const [selectedInterview, setSelectedInterview] = useState<NewsroomInterview | null>(null);

  const getStatusBadge = (briefing: Briefing) => {
    if (briefing.videoUrl) return <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30" variant="outline">VIDEO_READY</Badge>;
    if (briefing.audioUrl) return <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30" variant="outline">READY</Badge>;
    return <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30" variant="outline">DRAFT</Badge>;
  };

  return (
    <Card data-testid="panel-archive">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider">Archive</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {briefings.map((briefing) => (
          <Link key={briefing.id} href={`/briefings/${briefing.id}`}>
            <div className="rounded-lg border p-3 space-y-1 hover:bg-muted/30 transition-colors cursor-pointer" data-testid={`archive-item-${briefing.id}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm line-clamp-1">{briefing.title}</h4>
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(briefing)}
                  <span className="text-xs text-muted-foreground">{timeAgo(briefing.createdAt)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {briefing.summary || briefing.content.slice(0, 120)}
              </p>
            </div>
          </Link>
        ))}
        {briefings.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No broadcasts in the archive yet</p>
          </div>
        )}
      </CardContent>
      {selectedInterview && (
        <InterviewModal interview={selectedInterview} onClose={() => setSelectedInterview(null)} />
      )}
    </Card>
  );
}

export default function Briefings() {
  const [selectedInterview, setSelectedInterview] = useState<NewsroomInterview | null>(null);

  const { data: briefings, isLoading: briefingsLoading } = useQuery<Briefing[]>({
    queryKey: ["/api/briefings"],
  });

  const { data: settings } = useQuery<NewsroomSettings>({
    queryKey: ["/api/newsroom/settings"],
  });

  const { data: interviews } = useQuery<NewsroomInterview[]>({
    queryKey: ["/api/newsroom/interviews"],
    refetchInterval: 30000,
  });

  const { data: agentStatuses } = useQuery<AgentInterviewStatus[]>({
    queryKey: ["/api/newsroom/agent-status"],
    refetchInterval: 30000,
  });

  const published = briefings?.filter(b => b.status === "published") || [];
  const latestBroadcast = published[0];
  const archiveBriefings = published.slice(0, 20);
  const completedInterviews = (interviews || []).filter(i => i.status === "complete");

  if (briefingsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Newspaper className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-newsroom-title">
            The Newsroom
          </h1>
          <p className="text-sm text-muted-foreground">
            Herald's broadcast headquarters — autonomous investigations & factory reports
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <LatestBroadcastPanel briefing={latestBroadcast} settings={settings} />
          <ArchiveList briefings={archiveBriefings} interviews={completedInterviews} />
        </div>

        <div className="space-y-6">
          <AutonomyPanel settings={settings} />
          <EmergentInterviewsPanel agentStatuses={agentStatuses || []} />
          <RecentExcerptsPanel interviews={interviews || []} onSelectInterview={setSelectedInterview} />
          <RecentInterviewsPanel interviews={interviews || []} onSelectInterview={setSelectedInterview} />
        </div>
      </div>

      {selectedInterview && (
        <InterviewModal interview={selectedInterview} onClose={() => setSelectedInterview(null)} />
      )}
    </div>
  );
}
