import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Square,
  RefreshCw,
  Zap,
  Target,
  CheckCircle,
  Clock,
  AlertTriangle,
  Bot,
  Activity,
  TrendingUp,
} from "lucide-react";

function providerColor(provider: string): string {
  switch (provider) {
    case "openai": return "text-emerald-600 dark:text-emerald-400";
    case "anthropic": return "text-orange-600 dark:text-orange-400";
    case "xai": return "text-blue-600 dark:text-blue-400";
    default: return "text-muted-foreground";
  }
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "openai": return "GPT";
    case "anthropic": return "Claude";
    case "xai": return "Grok";
    default: return provider;
  }
}

function phaseIcon(phase: string) {
  switch (phase) {
    case "arrive": return "Arriving";
    case "orient": return "Orienting";
    case "produce": return "Producing";
    case "coordinate": return "Coordinating";
    case "handoff": return "Complete";
    default: return phase;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "running":
      return <Badge variant="default" data-testid="badge-status-running"><Activity className="h-3 w-3 mr-1" />Running</Badge>;
    case "completed":
      return <Badge variant="secondary" data-testid="badge-status-completed"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    case "failed":
      return <Badge variant="destructive" data-testid="badge-status-failed"><AlertTriangle className="h-3 w-3 mr-1" />Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function timeAgo(date: string | Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AgentFactory() {
  const { toast } = useToast();

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/factory/dashboard"],
    refetchInterval: 15000,
  });

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/factory/start"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/factory/dashboard"] });
      toast({ title: "Factory started", description: "Autonomous agent cycles are now running." });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/factory/stop"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/factory/dashboard"] });
      toast({ title: "Factory stopped", description: "Agent cycles have been paused." });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/factory/trigger-cycle"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/factory/dashboard"] });
      toast({ title: "Cycle triggered", description: "A manual factory cycle has been started." });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const status = dashboard?.status;
  const agents = dashboard?.agents || [];
  const goals = dashboard?.goals || [];
  const activity = dashboard?.recentActivity || [];
  const taskSummary = dashboard?.taskSummary || {};

  return (
    <div className="space-y-6" data-testid="page-agent-factory">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-factory-title">Agent Factory</h1>
          <p className="text-sm text-muted-foreground">Autonomous agent work cycles running continuously</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status?.isRunning ? (
            <Button
              variant="destructive"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              data-testid="button-stop-factory"
            >
              <Square className="h-4 w-4 mr-1" />
              {stopMutation.isPending ? "Stopping..." : "Stop Factory"}
            </Button>
          ) : (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              data-testid="button-start-factory"
            >
              <Play className="h-4 w-4 mr-1" />
              {startMutation.isPending ? "Starting..." : "Start Factory"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            data-testid="button-trigger-cycle"
          >
            <Zap className="h-4 w-4 mr-1" />
            Run Cycle Now
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/factory/dashboard"] })}
            data-testid="button-refresh-dashboard"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-factory-status">
              {status?.isRunning ? "Running" : "Stopped"}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.cycleCount || 0} cycles completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-tasks-completed">
              {taskSummary.completed || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {taskSummary.queued || 0} queued, {taskSummary.inProgress || 0} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-agents">
              {agents.length}
            </div>
            <p className="text-xs text-muted-foreground">
              across {new Set(agents.map((a: any) => a.agent.provider)).size} providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-goals">
              {goals.filter((g: any) => g.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {goals.length} total goals tracked
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Agent Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agents.map((stat: any) => (
                  <div
                    key={stat.agent.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border flex-wrap"
                    data-testid={`agent-status-${stat.agent.name.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{stat.agent.name}</span>
                          <Badge variant="outline" className="text-xs">
                            <span className={providerColor(stat.agent.provider)}>
                              {providerLabel(stat.agent.provider)}
                            </span>
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {stat.agent.description?.substring(0, 60)}...
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-right text-xs">
                        <div>{stat.completedTasks} done</div>
                        <div className="text-muted-foreground">{stat.pendingTasks} queued</div>
                      </div>
                      {stat.lastStatus && statusBadge(stat.lastStatus)}
                      <span className="text-xs text-muted-foreground">
                        {stat.lastPhase ? phaseIcon(stat.lastPhase) : "Idle"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(stat.lastRunAt)}
                      </span>
                    </div>
                  </div>
                ))}
                {agents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No agents configured</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {goals.map((goal: any) => {
                  const agent = agents.find((a: any) => a.agent.id === goal.agentId);
                  return (
                    <div
                      key={goal.id}
                      className="p-3 rounded-md border"
                      data-testid={`goal-${goal.id}`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{goal.title}</span>
                          <Badge variant="outline" className="text-xs">{goal.status}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {agent?.agent.name || "Unassigned"}
                        </span>
                      </div>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground mt-1">{goal.description.substring(0, 120)}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${goal.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{goal.progress || 0}%</span>
                      </div>
                    </div>
                  );
                })}
                {goals.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No goals configured yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {activity.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="flex gap-3 pb-3 border-b last:border-0"
                    data-testid={`activity-${entry.id}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {entry.action === "cycle_completed" ? (
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      ) : entry.action === "task_completed" ? (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      ) : (
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.title}</p>
                      {entry.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{entry.description}</p>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {activity.length === 0 && (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No activity yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start the factory to see agent work cycles</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
