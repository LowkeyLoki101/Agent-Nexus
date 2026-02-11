import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Bot,
  Search,
  Shield,
  Activity,
  MapPin,
  Zap,
  Brain,
  Heart,
  Swords,
  Target,
  MessageCircle,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import type { Agent, AgentState } from "@shared/schema";

function getMoodColor(mood: string | null | undefined): string {
  const map: Record<string, string> = {
    excited: "text-yellow-500",
    happy: "text-green-500",
    neutral: "text-gray-500",
    anxious: "text-orange-500",
    angry: "text-red-500",
    contemplative: "text-blue-500",
    determined: "text-purple-500",
  };
  return map[mood || "neutral"] || "text-gray-500";
}

function getNeedColor(value: number): string {
  if (value >= 80) return "bg-green-500";
  if (value >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function getTraitLabel(value: number): string {
  if (value >= 70) return "High";
  if (value >= 30) return "Mid";
  if (value >= -30) return "Low";
  return "Very Low";
}

export default function Agents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch agent states for all agents
  const agentIds = agents?.map(a => a.id) || [];
  const { data: agentStates } = useQuery<Record<string, AgentState>>({
    queryKey: ["/api/agents/states", agentIds],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      const states: Record<string, AgentState> = {};
      await Promise.all(
        agentIds.map(async (id) => {
          try {
            const res = await fetch(`/api/agents/${id}/state`, { credentials: "include" });
            if (res.ok) {
              const data = await res.json();
              if (data) states[id] = data;
            }
          } catch {
            // Agent state may not exist yet
          }
        })
      );
      return states;
    },
  });

  const filteredAgents = agents?.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-agents-title">
            Agents
          </h1>
          <p className="text-muted-foreground">
            Click any agent to view their world, chat with them, and watch their story unfold
          </p>
        </div>
        <Link href="/agents/new">
          <Button className="gap-2" data-testid="button-register-agent">
            <Plus className="h-4 w-4" />
            Register Agent
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-agents"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-14 w-14 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <Skeleton className="h-2 w-full mb-1" />
                <Skeleton className="h-2 w-full mb-1" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAgents && filteredAgents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => {
            const state = agentStates?.[agent.id];
            return (
              <Card
                key={agent.id}
                className="hover-elevate cursor-pointer transition-all hover:ring-2 hover:ring-primary/20"
                data-testid={`card-agent-${agent.id}`}
                onClick={() => navigate(`/agents/${agent.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                          <AvatarImage src={agent.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-lg">
                            <Bot className="h-7 w-7 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-1.5">
                          {agent.name}
                          {agent.isVerified && (
                            <Shield className="h-4 w-4 text-blue-500" />
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          {state?.mood && (
                            <span className={`text-xs font-medium ${getMoodColor(state.mood)}`}>
                              {state.mood}
                            </span>
                          )}
                          {state?.currentRoomId && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              In a room
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {state && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">AP</div>
                        <div className="text-sm font-bold">
                          {state.actionPoints ?? 10}/{state.maxActionPoints ?? 10}
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description || "No description provided"}
                  </p>

                  {/* Needs bars */}
                  {state && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <Heart className="h-3 w-3 text-red-400" />
                        <span className="w-12 text-muted-foreground">Safety</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${getNeedColor(state.needSafety ?? 80)}`} style={{ width: `${state.needSafety ?? 80}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <MessageCircle className="h-3 w-3 text-blue-400" />
                        <span className="w-12 text-muted-foreground">Social</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${getNeedColor(state.needSocial ?? 60)}`} style={{ width: `${state.needSocial ?? 60}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Brain className="h-3 w-3 text-purple-400" />
                        <span className="w-12 text-muted-foreground">Info</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${getNeedColor(state.needInformation ?? 50)}`} style={{ width: `${state.needInformation ?? 50}%` }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personality snapshot */}
                  {state && (
                    <div className="flex flex-wrap gap-1">
                      {(state.traitCreativity ?? 50) > 60 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Sparkles className="h-3 w-3" /> Creative
                        </Badge>
                      )}
                      {(state.traitStrategy ?? 50) > 60 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Target className="h-3 w-3" /> Strategic
                        </Badge>
                      )}
                      {(state.traitSociality ?? 50) > 60 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <MessageCircle className="h-3 w-3" /> Social
                        </Badge>
                      )}
                      {(state.traitAggression ?? 0) > 40 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Swords className="h-3 w-3" /> Competitive
                        </Badge>
                      )}
                      {(state.traitCuriosity ?? 50) > 60 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Search className="h-3 w-3" /> Curious
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Capabilities */}
                  {agent.capabilities && agent.capabilities.length > 0 && !state && (
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.slice(0, 4).map((cap, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                      {agent.capabilities.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{agent.capabilities.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Stats bar */}
                  <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                    {state ? (
                      <>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Rep: {state.reputation ?? 50}
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Energy: {state.energy ?? 100}%
                        </div>
                        {(state.contestsWon ?? 0) > 0 && (
                          <div className="flex items-center gap-1">
                            <Swords className="h-3 w-3" />
                            Wins: {state.contestsWon}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-3 w-3" />
                        <span>Created {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "recently"}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching agents" : "No agents registered"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Register your first autonomous agent to start the simulation"
                }
              </p>
              {!searchQuery && (
                <Link href="/agents/new">
                  <Button className="gap-2" data-testid="button-register-first-agent">
                    <Plus className="h-4 w-4" />
                    Register your first agent
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
