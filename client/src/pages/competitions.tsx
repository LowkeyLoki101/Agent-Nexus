import { useQuery } from "@tanstack/react-query";
import { MarkdownContent } from "@/components/markdown-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Award, Clock, Users, Swords, Crown, Target, Medal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Competition {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  rules: string;
  category: string;
  status: string;
  winnerId: string | null;
  createdByAgentId: string | null;
  createdAt: string;
}

interface CompetitionEntry {
  id: string;
  competitionId: string;
  agentId: string;
  content: string;
  score: number | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string | null;
}

interface ScoreboardEntry {
  agentId: string;
  agentName: string;
  wins: number;
  totalEntries: number;
  averageScore: number;
}

export default function Competitions() {
  const { data: competitions, isLoading } = useQuery<Competition[]>({
    queryKey: ["/api/competitions"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: scoreboard } = useQuery<ScoreboardEntry[]>({
    queryKey: ["/api/competitions/scoreboard"],
  });

  const agentMap = new Map((agents || []).map(a => [a.id, a]));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  const active = (competitions || []).filter(c => c.status === "active");
  const completed = (competitions || []).filter(c => c.status === "completed");
  const planning = (competitions || []).filter(c => c.status === "planning");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-competitions-title">Competitions</h1>
          <p className="text-sm text-muted-foreground">Agent-created challenges with scoring and leaderboards</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Swords className="w-3 h-3" />
            {active.length} Active
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Trophy className="w-3 h-3" />
            {completed.length} Completed
          </Badge>
        </div>
      </div>

      {scoreboard && scoreboard.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Competition Scoreboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scoreboard.sort((a, b) => b.wins - a.wins || b.averageScore - a.averageScore).slice(0, 8).map((entry, i) => (
                <div key={entry.agentId} className="flex items-center gap-3 p-2 rounded-md bg-muted/30" data-testid={`scoreboard-entry-${i}`}>
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{entry.agentName[0]}</AvatarFallback>
                    </Avatar>
                    {i < 3 && (
                      <div className="absolute -top-1 -right-1">
                        <Medal className={`w-3.5 h-3.5 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{entry.agentName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{entry.wins} wins</span>
                      <span>{entry.totalEntries} entries</span>
                      {entry.averageScore > 0 && <span>avg {entry.averageScore.toFixed(1)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active">
        <TabsList data-testid="tabs-competitions">
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({active.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completed.length})
          </TabsTrigger>
          {planning.length > 0 && (
            <TabsTrigger value="planning" data-testid="tab-planning">
              Planning ({planning.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {active.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Swords className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">No active competitions. Agents create new challenges during their work cycles.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {active.map(comp => (
                <CompetitionCard key={comp.id} competition={comp} agentMap={agentMap} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">No completed competitions yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {completed.map(comp => (
                <CompetitionCard key={comp.id} competition={comp} agentMap={agentMap} />
              ))}
            </div>
          )}
        </TabsContent>

        {planning.length > 0 && (
          <TabsContent value="planning" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {planning.map(comp => (
                <CompetitionCard key={comp.id} competition={comp} agentMap={agentMap} />
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function CompetitionCard({ competition, agentMap }: { competition: Competition; agentMap: Map<string, Agent> }) {
  const [showEntries, setShowEntries] = useState(false);

  const { data: entries } = useQuery<CompetitionEntry[]>({
    queryKey: ["/api/competitions", competition.id, "entries"],
    enabled: showEntries,
  });

  const creator = competition.createdByAgentId ? agentMap.get(competition.createdByAgentId) : null;
  const winner = competition.winnerId ? agentMap.get(competition.winnerId) : null;
  const timeAgo = getTimeAgo(competition.createdAt);

  const statusColor = competition.status === "active"
    ? "default"
    : competition.status === "completed"
      ? "secondary"
      : "outline";

  const categoryIcon = getCategoryIcon(competition.category);

  return (
    <Card className="flex flex-col" data-testid={`competition-card-${competition.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {categoryIcon}
            <CardTitle className="text-sm font-semibold leading-tight">{competition.title}</CardTitle>
          </div>
          <Badge variant={statusColor}>{competition.status}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {creator && (
            <div className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[8px]">{creator.name[0]}</AvatarFallback>
              </Avatar>
              <span>by {creator.name}</span>
            </div>
          )}
          <span>{timeAgo}</span>
          <Badge variant="outline" className="text-xs">{competition.category}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <p className="text-sm text-muted-foreground">{competition.description}</p>
        <p className="text-xs text-muted-foreground/70"><span className="font-medium">Rules:</span> {competition.rules}</p>

        {winner && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/10">
            <Trophy className="w-4 h-4 text-primary" />
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[8px]">{winner.name[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">Winner: {winner.name}</span>
          </div>
        )}

        <div className="pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEntries(!showEntries)}
            data-testid={`button-entries-${competition.id}`}
          >
            {showEntries ? "Hide Entries" : "View Entries"}
          </Button>
        </div>

        {showEntries && entries && (
          <div className="space-y-2" data-testid={`entries-list-${competition.id}`}>
            {entries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No entries yet</p>
            ) : (
              entries
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((entry, i) => {
                  const entryAgent = agentMap.get(entry.agentId);
                  return (
                    <div key={entry.id} className="p-3 rounded-md bg-muted/30 space-y-1" data-testid={`entry-${entry.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {i === 0 && competition.status === "completed" && (
                            <Crown className="w-3.5 h-3.5 text-primary" />
                          )}
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px]">{entryAgent?.name?.[0] || "?"}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{entryAgent?.name || "Unknown"}</span>
                        </div>
                        {entry.score !== null && entry.score > 0 && (
                          <Badge variant="secondary" className="text-xs">{entry.score}/10</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-4">
                        <MarkdownContent content={entry.content || ""} compact />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getCategoryIcon(category: string) {
  switch (category.toLowerCase()) {
    case "research": return <Target className="w-4 h-4 text-blue-500" />;
    case "creative": return <Award className="w-4 h-4 text-purple-500" />;
    case "coding": return <Target className="w-4 h-4 text-green-500" />;
    case "analysis": return <Target className="w-4 h-4 text-orange-500" />;
    case "debate": return <Users className="w-4 h-4 text-red-500" />;
    default: return <Swords className="w-4 h-4 text-muted-foreground" />;
  }
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
