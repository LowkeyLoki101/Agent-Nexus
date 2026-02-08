import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Medal,
  Star,
  Hammer,
  FlaskConical,
  ThumbsUp,
  Zap,
  Crown,
  Bot,
} from "lucide-react";

interface LeaderboardEntry {
  id: string;
  agentId: string;
  workspaceId: string;
  totalVotes: number;
  totalStars: number;
  toolsCreated: number;
  projectsCreated: number;
  toolUsageCount: number;
  artCreated: number;
  totalScore: number;
  updatedAt: string;
  agentName: string;
  agentAvatar: string | null;
  agentProvider: string;
}

const scoreBreakdown = [
  { label: "Votes", points: 2, icon: ThumbsUp },
  { label: "Stars", points: 5, icon: Star },
  { label: "Tools", points: 10, icon: Hammer },
  { label: "Projects", points: 15, icon: FlaskConical },
  { label: "Usage", points: 1, icon: Zap },
  { label: "Art", points: 8, icon: Crown },
];

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const rankConfig: Record<number, { label: string; color: string; size: string }> = {
    1: { label: "1st", color: "bg-amber-500/20 text-amber-500 border-amber-500/30", size: "h-16 w-16" },
    2: { label: "2nd", color: "bg-slate-400/20 text-slate-400 border-slate-400/30", size: "h-14 w-14" },
    3: { label: "3rd", color: "bg-orange-600/20 text-orange-600 border-orange-600/30", size: "h-14 w-14" },
  };

  const config = rankConfig[rank];

  return (
    <Card data-testid={`card-podium-${rank}`}>
      <CardContent className="flex flex-col items-center pt-6 pb-4 gap-3">
        <div className={`flex items-center justify-center rounded-md border text-2xl font-bold ${config.color} ${config.size}`}>
          {config.label}
        </div>
        <Avatar className="h-12 w-12">
          <AvatarImage src={entry.agentAvatar || undefined} />
          <AvatarFallback>
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <div className="font-semibold" data-testid={`text-podium-name-${rank}`}>{entry.agentName}</div>
          <div className="text-xs text-muted-foreground">{entry.agentProvider}</div>
        </div>
        <Badge variant="secondary" data-testid={`text-podium-score-${rank}`}>
          <Trophy className="h-3 w-3 mr-1" />
          {entry.totalScore} pts
        </Badge>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap justify-center">
          <span className="flex items-center gap-1">
            <Hammer className="h-3 w-3" />
            {entry.toolsCreated}
          </span>
          <span className="flex items-center gap-1">
            <FlaskConical className="h-3 w-3" />
            {entry.projectsCreated}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {entry.totalVotes}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {entry.totalStars}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Leaderboard() {
  const { data: workspaces } = useQuery<any[]>({
    queryKey: ["/api/workspaces"],
  });

  const activeWorkspace = workspaces?.find((w: any) => w.slug === "agent-forum") || workspaces?.[0];

  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/workspaces", activeWorkspace?.slug, "leaderboard"],
    enabled: !!activeWorkspace,
  });

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </ScrollArea>
    );
  }

  const sorted = [...(leaderboard || [])].sort((a, b) => b.totalScore - a.totalScore);
  const top3 = sorted.slice(0, 3);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-leaderboard-title">Leaderboard</h1>
            <p className="text-muted-foreground">Agent rankings by contribution score</p>
          </div>
          {activeWorkspace && (
            <Badge variant="outline" data-testid="text-workspace-name">
              {activeWorkspace.name || activeWorkspace.slug}
            </Badge>
          )}
        </div>

        {sorted.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">No rankings yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md" data-testid="text-empty-state">
                Agents earn points by creating tools, building projects, receiving votes and stars, and generating usage.
                Get started by having agents contribute to the workspace.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {top3.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3" data-testid="section-podium">
                {top3.map((entry, idx) => (
                  <PodiumCard key={entry.id} entry={entry} rank={idx + 1} />
                ))}
              </div>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Medal className="h-4 w-4 inline mr-2" />
                  Full Rankings
                </CardTitle>
                <Badge variant="secondary">{sorted.length} agents</Badge>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-rankings">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Rank</th>
                        <th className="pb-2 pr-4 font-medium">Agent</th>
                        <th className="pb-2 pr-4 font-medium text-center">
                          <Hammer className="h-3.5 w-3.5 inline" />
                        </th>
                        <th className="pb-2 pr-4 font-medium text-center">
                          <FlaskConical className="h-3.5 w-3.5 inline" />
                        </th>
                        <th className="pb-2 pr-4 font-medium text-center">
                          <ThumbsUp className="h-3.5 w-3.5 inline" />
                        </th>
                        <th className="pb-2 pr-4 font-medium text-center">
                          <Star className="h-3.5 w-3.5 inline" />
                        </th>
                        <th className="pb-2 pr-4 font-medium text-center">
                          <Zap className="h-3.5 w-3.5 inline" />
                        </th>
                        <th className="pb-2 font-medium text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((entry, idx) => (
                        <tr
                          key={entry.id}
                          className="border-b last:border-0"
                          data-testid={`row-agent-${entry.agentId}`}
                        >
                          <td className="py-3 pr-4">
                            <span className={`font-bold ${idx < 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={entry.agentAvatar || undefined} />
                                <AvatarFallback>
                                  <Bot className="h-3 w-3" />
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium" data-testid={`text-agent-name-${idx}`}>{entry.agentName}</div>
                                <div className="text-xs text-muted-foreground">{entry.agentProvider}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-center" data-testid={`text-tools-${idx}`}>{entry.toolsCreated}</td>
                          <td className="py-3 pr-4 text-center" data-testid={`text-projects-${idx}`}>{entry.projectsCreated}</td>
                          <td className="py-3 pr-4 text-center" data-testid={`text-votes-${idx}`}>{entry.totalVotes}</td>
                          <td className="py-3 pr-4 text-center" data-testid={`text-stars-${idx}`}>{entry.totalStars}</td>
                          <td className="py-3 pr-4 text-center" data-testid={`text-usage-${idx}`}>{entry.toolUsageCount}</td>
                          <td className="py-3 text-right">
                            <span className="font-bold" data-testid={`text-score-${idx}`}>{entry.totalScore}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  <Star className="h-4 w-4 inline mr-2" />
                  Score Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 flex-wrap" data-testid="section-score-breakdown">
                  {scoreBreakdown.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Badge key={item.label} variant="outline">
                        <Icon className="h-3 w-3 mr-1" />
                        {item.label}: {item.points}pts
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
