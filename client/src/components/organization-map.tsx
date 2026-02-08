import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pause,
  Play,
  Search,
  Palette,
  MessageSquare,
  Code2,
  Brain,
  Network,
  Zap,
  Target,
  Clock,
  CheckCircle2,
  Circle,
  Cpu,
  ArrowRight,
} from "lucide-react";

interface AgentMapData {
  id: string;
  name: string;
  description: string;
  provider: string;
  modelName: string;
  avatar: string | null;
  roleMetaphor: string | null;
  strengths: string[] | null;
  capabilities: string[] | null;
  currentRoom: string | null;
  rotation: {
    current: number;
    visitedRooms: string[];
    unvisitedRooms: string[];
    totalRotations: number;
  };
  currentTask: { title: string; type: string; status: string } | null;
  longTermGoal: { title: string; progress: number | null; milestones: string[] | null } | null;
  shortTermGoal: { title: string; progress: number | null } | null;
  latestDiary: { title: string; mood: string; content: string; createdAt: string } | null;
  latestPulse: { doingNow: string; nextActions: string; createdAt: string } | null;
  yesterdayWork: { title: string; type: string }[];
  tokensUsed: number;
  totalTasks: number;
  lastActiveAt: string | null;
}

interface RoomStats {
  name: string;
  agentCount: number;
  totalTasks: number;
  activeTasks: number;
}

interface OrgMapData {
  agents: AgentMapData[];
  rooms: RoomStats[];
  factory: { isRunning: boolean; cycleCount: number; lastCycleAt: string | null };
  tokenBudget: { allocation: number; used: number; remaining: number; cadence: string } | null;
  updatedAt: string;
}

const ROOM_CONFIG: Record<string, { label: string; icon: typeof Search; color: string; bgClass: string }> = {
  research: { label: "Research", icon: Search, color: "text-blue-500", bgClass: "bg-blue-500/10 dark:bg-blue-500/5 border-blue-500/20" },
  create: { label: "Create", icon: Palette, color: "text-purple-500", bgClass: "bg-purple-500/10 dark:bg-purple-500/5 border-purple-500/20" },
  discuss: { label: "Discuss", icon: MessageSquare, color: "text-green-500", bgClass: "bg-green-500/10 dark:bg-green-500/5 border-green-500/20" },
  review: { label: "Review", icon: Code2, color: "text-orange-500", bgClass: "bg-orange-500/10 dark:bg-orange-500/5 border-orange-500/20" },
  reflect: { label: "Reflect", icon: Brain, color: "text-pink-500", bgClass: "bg-pink-500/10 dark:bg-pink-500/5 border-pink-500/20" },
  coordinate: { label: "Coordinate", icon: Network, color: "text-amber-500", bgClass: "bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/20" },
};

const ROOMS_ORDER = ["research", "create", "discuss", "review", "reflect", "coordinate"];

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function AgentAvatar({ agent, onClick, isPaused }: { agent: AgentMapData; onClick: () => void; isPaused: boolean }) {
  const initials = agent.name.split(" ").map(w => w[0]).join("").substring(0, 2);
  const isActive = agent.currentTask?.status === "in_progress";

  return (
    <button
      onClick={isPaused ? onClick : undefined}
      className={`relative group transition-transform duration-300 ${isPaused ? "cursor-pointer" : "cursor-default"}`}
      data-testid={`avatar-agent-${agent.id}`}
      title={isPaused ? `Click to inspect ${agent.name}` : agent.name}
    >
      <Avatar className={`h-9 w-9 border-2 transition-all duration-300 ${isActive ? "border-primary ring-2 ring-primary/30" : "border-border"} ${isPaused ? "hover-elevate" : ""}`}>
        <AvatarFallback className="text-xs font-semibold bg-muted">
          {initials}
        </AvatarFallback>
      </Avatar>
      {isActive && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />
      )}
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
        {agent.name}
      </span>
    </button>
  );
}

function AgentDetailDialog({ agent, open, onClose, tokenBudget }: { agent: AgentMapData | null; open: boolean; onClose: () => void; tokenBudget: OrgMapData["tokenBudget"] }) {
  if (!agent) return null;

  const totalBudget = tokenBudget?.allocation || 1000000;
  const tokenPercent = Math.min(100, Math.round((agent.tokensUsed / totalBudget) * 100));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="font-semibold">
                {agent.name.split(" ").map(w => w[0]).join("").substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-lg">{agent.name}</div>
              <div className="text-sm text-muted-foreground font-normal">{agent.roleMetaphor || agent.description?.substring(0, 60)}</div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed status snapshot for agent {agent.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" data-testid="badge-provider">{agent.provider}/{agent.modelName}</Badge>
            {agent.currentRoom && (
              <Badge className={ROOM_CONFIG[agent.currentRoom]?.color || ""} variant="secondary" data-testid="badge-current-room">
                {ROOM_CONFIG[agent.currentRoom]?.label || agent.currentRoom}
              </Badge>
            )}
          </div>

          {agent.latestPulse && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Currently Doing
              </h4>
              <p className="text-sm text-muted-foreground" data-testid="text-doing-now">{agent.latestPulse.doingNow}</p>
            </div>
          )}

          {agent.currentTask && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 text-primary" />
                Current Task
              </h4>
              <p className="text-sm text-muted-foreground" data-testid="text-current-task">{agent.currentTask.title}</p>
              <Badge variant="outline" className="mt-1">{agent.currentTask.type}</Badge>
            </div>
          )}

          {agent.longTermGoal && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
                Long-Term Goal
              </h4>
              <p className="text-sm text-muted-foreground" data-testid="text-long-term-goal">{agent.longTermGoal.title}</p>
              {agent.longTermGoal.progress != null && (
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={agent.longTermGoal.progress} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{agent.longTermGoal.progress}%</span>
                </div>
              )}
              {agent.longTermGoal.milestones && agent.longTermGoal.milestones.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {agent.longTermGoal.milestones.slice(0, 3).map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {agent.shortTermGoal && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5" />
                Short-Term Goal
              </h4>
              <p className="text-sm text-muted-foreground">{agent.shortTermGoal.title}</p>
            </div>
          )}

          {agent.yesterdayWork.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5" />
                Yesterday&apos;s Work
              </h4>
              <ul className="space-y-1">
                {agent.yesterdayWork.slice(0, 4).map((t, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="truncate">{t.title}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{t.type}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {agent.latestDiary && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <Brain className="h-3.5 w-3.5" />
                Latest Reflection
              </h4>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{agent.latestDiary.title}</span>
                <span className="mx-1">-</span>
                <span>{agent.latestDiary.content}</span>
              </div>
              <span className="text-xs text-muted-foreground">{timeAgo(agent.latestDiary.createdAt)}</span>
            </div>
          )}

          {agent.latestPulse?.nextActions && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Next Actions</h4>
              <p className="text-sm text-muted-foreground">{agent.latestPulse.nextActions}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Cpu className="h-3.5 w-3.5" />
              Room Rotation (Cycle #{agent.rotation.current})
            </h4>
            <div className="flex gap-1 flex-wrap">
              {ROOMS_ORDER.map(room => {
                const visited = agent.rotation.visitedRooms.includes(room);
                const isCurrent = agent.currentRoom === room;
                const config = ROOM_CONFIG[room];
                return (
                  <Badge
                    key={room}
                    variant={isCurrent ? "default" : visited ? "secondary" : "outline"}
                    className={`text-xs ${isCurrent ? "" : visited ? "opacity-70" : "opacity-40"}`}
                    data-testid={`badge-room-${room}`}
                  >
                    {visited ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Circle className="h-3 w-3 mr-1" />}
                    {config.label}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {agent.rotation.totalRotations} full rotations completed
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-1">Token Usage</h4>
            <div className="flex items-center gap-2">
              <Progress value={tokenPercent} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground">{formatTokens(agent.tokensUsed)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {agent.totalTasks} tasks completed | Last active {timeAgo(agent.lastActiveAt)}
            </p>
          </div>

          {agent.strengths && agent.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Strengths</h4>
              <div className="flex flex-wrap gap-1">
                {agent.strengths.slice(0, 6).map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OrganizationMap() {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentMapData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: orgData, isLoading } = useQuery<OrgMapData>({
    queryKey: ["/api/org-map"],
    refetchInterval: isPaused ? false : 5000,
  });

  const handleAgentClick = useCallback((agent: AgentMapData) => {
    if (isPaused) {
      setSelectedAgent(agent);
      setDialogOpen(true);
    }
  }, [isPaused]);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedAgent(null);
  }, []);

  if (isLoading || !orgData) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Loading organization map...
          </div>
        </CardContent>
      </Card>
    );
  }

  const agentsWithNoRoom = orgData.agents.filter(a => !a.currentRoom);
  const unassignedCount = agentsWithNoRoom.length;

  return (
    <>
      <Card data-testid="card-org-map">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Organization Map</h3>
              {orgData.factory.isRunning && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
              {isPaused && (
                <Badge variant="outline" className="text-xs">
                  Paused - click an agent to inspect
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {orgData.tokenBudget && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                  <span>{formatTokens(orgData.tokenBudget.used)}</span>
                  <span>/</span>
                  <span>{formatTokens(orgData.tokenBudget.allocation)}</span>
                  <span>tokens</span>
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                Updated {timeAgo(orgData.updatedAt)}
              </span>
              <Button
                size="icon"
                variant={isPaused ? "default" : "outline"}
                onClick={() => { setIsPaused(p => !p); if (!isPaused) { setDialogOpen(false); setSelectedAgent(null); } }}
                data-testid="button-pause-map"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {ROOMS_ORDER.map(roomName => {
              const config = ROOM_CONFIG[roomName];
              const roomStat = orgData.rooms.find(r => r.name === roomName);
              const agentsInRoom = orgData.agents.filter(a => a.currentRoom === roomName);
              const IconComp = config.icon;

              return (
                <div
                  key={roomName}
                  className={`rounded-md border p-3 transition-all duration-300 ${config.bgClass} ${agentsInRoom.length > 0 ? "ring-1 ring-inset" : ""}`}
                  data-testid={`room-${roomName}`}
                >
                  <div className="flex items-center gap-1.5 mb-3">
                    <IconComp className={`h-4 w-4 ${config.color}`} />
                    <span className="text-xs font-semibold">{config.label}</span>
                    {roomStat && roomStat.totalTasks > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-auto">{roomStat.totalTasks}</span>
                    )}
                  </div>

                  <div className="min-h-[52px] flex items-center">
                    {agentsInRoom.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">Empty</span>
                    ) : (
                      <div className="flex flex-wrap gap-2 justify-start pb-5">
                        {agentsInRoom.map(agent => (
                          <AgentAvatar
                            key={agent.id}
                            agent={agent}
                            onClick={() => handleAgentClick(agent)}
                            isPaused={isPaused}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {unassignedCount > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Not yet active:</span>
              <div className="flex gap-2 flex-wrap pb-5">
                {agentsWithNoRoom.map(agent => (
                  <AgentAvatar
                    key={agent.id}
                    agent={agent}
                    onClick={() => handleAgentClick(agent)}
                    isPaused={isPaused}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AgentDetailDialog
        agent={selectedAgent}
        open={dialogOpen}
        onClose={handleCloseDialog}
        tokenBudget={orgData.tokenBudget}
      />
    </>
  );
}
