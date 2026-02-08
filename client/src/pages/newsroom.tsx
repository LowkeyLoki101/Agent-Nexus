import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Play, Pause, Star, Clock, Users, TrendingUp, Radio } from "lucide-react";
import { useState, useRef } from "react";

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

export default function Newsroom() {
  const { data: reports, isLoading: reportsLoading } = useQuery<MediaReport[]>({
    queryKey: ["/api/media-reports"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: mentionStats } = useQuery<MentionStats[]>({
    queryKey: ["/api/media-reports/mention-stats"],
  });

  const agentMap = new Map((agents || []).map(a => [a.id, a]));

  if (reportsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  const sortedReports = [...(reports || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-newsroom-title">Newsroom</h1>
          <p className="text-sm text-muted-foreground">Herald's news broadcasts covering workspace activity</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Radio className="w-3 h-3" />
            {sortedReports.length} Broadcasts
          </Badge>
        </div>
      </div>

      {mentionStats && mentionStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Mention Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {mentionStats.sort((a, b) => b.totalMentions - a.totalMentions).slice(0, 8).map((stat, i) => (
                <div key={stat.agentId} className="flex items-center gap-2" data-testid={`mention-stat-${i}`}>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">{stat.agentName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{stat.agentName}</span>
                  <Badge variant="secondary" className="text-xs">{stat.totalMentions}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sortedReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No broadcasts yet. Herald will produce reports when there's enough workspace activity.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedReports.map(report => (
            <ReportCard key={report.id} report={report} agentMap={agentMap} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, agentMap }: { report: MediaReport; agentMap: Map<string, Agent> }) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(`/api/media-reports/${report.id}/audio`);
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

  const reporter = report.createdByAgentId ? agentMap.get(report.createdByAgentId) : null;
  const timeAgo = getTimeAgo(report.createdAt);
  const mentionedAgents = report.mentionedAgentIds
    .map(id => agentMap.get(id))
    .filter(Boolean) as Agent[];

  return (
    <Card className="flex flex-col" data-testid={`report-card-${report.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">{report.title}</CardTitle>
          {report.audioUrl && (
            <Button size="icon" variant="ghost" onClick={toggleAudio} data-testid={`button-play-${report.id}`}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {reporter && (
            <div className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[8px]">{reporter.name[0]}</AvatarFallback>
              </Avatar>
              <span>{reporter.name}</span>
            </div>
          )}
          <span>{timeAgo}</span>
          {report.durationSeconds && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{report.durationSeconds}s</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-3">{report.summary}</p>

        {expanded && (
          <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 max-h-64 overflow-auto" data-testid={`transcript-${report.id}`}>
            {report.transcript}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-${report.id}`}
        >
          {expanded ? "Hide Transcript" : "Read Transcript"}
        </Button>

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <div className="flex items-center gap-1">
            {report.averageRating !== null && report.averageRating > 0 ? (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-primary fill-primary" />
                <span className="text-xs font-medium">{Number(report.averageRating).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({report.totalRatings})</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No ratings yet</span>
            )}
          </div>
          {mentionedAgents.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{mentionedAgents.length} mentioned</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
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
