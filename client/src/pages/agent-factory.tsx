import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  ListTodo,
  Brain,
  Shield,
  Sparkles,
  Archive,
  Cpu,
  Wrench,
  X,
  Radio,
  Thermometer,
  Signal,
  Flame,
  Snowflake,
  AlertCircle,
  CircleCheck,
  CircleMinus,
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

function agentIcon(name: string) {
  switch (name.toLowerCase()) {
    case "nova": return <Cpu className="h-4 w-4" />;
    case "forge": return <Wrench className="h-4 w-4" />;
    case "sage": return <Shield className="h-4 w-4" />;
    case "spark": return <Sparkles className="h-4 w-4" />;
    case "archivist": return <Archive className="h-4 w-4" />;
    case "sentinel": return <Eye className="h-4 w-4" />;
    default: return <Bot className="h-4 w-4" />;
  }
}

function phaseLabel(phase: string) {
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
      return <Badge variant="secondary" data-testid="badge-status-completed"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>;
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

function AgentDetailPanel({ agentId, agentName, onClose }: { agentId: string; agentName: string; onClose: () => void }) {
  const { toast } = useToast();

  const { data: runs, isLoading: runsLoading } = useQuery<any[]>({
    queryKey: ["/api/factory/agent", agentId, "runs"],
    queryFn: async () => {
      const res = await fetch(`/api/factory/agent/${agentId}/runs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ["/api/factory/agent", agentId, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/factory/agent/${agentId}/tasks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const triggerAgentMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/factory/trigger-agent/${agentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/factory/agent", agentId, "runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/factory/agent", agentId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/factory/dashboard"] });
      toast({ title: `${agentName} cycle triggered`, description: "Agent is now processing a work cycle." });
    },
    onError: () => {
      toast({ title: "Failed to trigger cycle", variant: "destructive" });
    },
  });

  return (
    <Card data-testid={`agent-detail-panel-${agentName.toLowerCase()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            {agentIcon(agentName)}
            {agentName} - Details
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => triggerAgentMutation.mutate()}
              disabled={triggerAgentMutation.isPending}
              data-testid={`button-trigger-agent-${agentName.toLowerCase()}`}
            >
              {triggerAgentMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Zap className="h-3 w-3 mr-1" />
              )}
              Run Now
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-agent-detail">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="runs" data-testid="agent-detail-tabs">
          <TabsList className="mb-3">
            <TabsTrigger value="runs" data-testid="tab-agent-runs">
              <Activity className="h-3 w-3 mr-1" />
              Recent Runs
            </TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-agent-tasks">
              <ListTodo className="h-3 w-3 mr-1" />
              Tasks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs">
            <ScrollArea className="h-[300px]">
              {runsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : runs && runs.length > 0 ? (
                <div className="space-y-2">
                  {runs.map((run: any) => (
                    <RunEntry key={run.id} run={run} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No runs yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Trigger a cycle to see activity</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tasks">
            <ScrollArea className="h-[300px]">
              {tasksLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : tasks && tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((task: any) => (
                    <div key={task.id} className="p-2 rounded-md border text-sm" data-testid={`task-entry-${task.id}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium">{task.title}</span>
                        <Badge variant={task.status === "completed" ? "secondary" : task.status === "queued" ? "outline" : "default"}>
                          {task.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{task.taskType}</span>
                        {task.completedAt && <span>Completed {timeAgo(task.completedAt)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ListTodo className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No tasks yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Tasks are auto-generated from goals</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RunEntry({ run }: { run: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="p-2 rounded-md border hover-elevate cursor-pointer" data-testid={`run-entry-${run.id}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span className="text-sm font-medium">{run.phase ? phaseLabel(run.phase) : "Processing"}</span>
              {statusBadge(run.status)}
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo(run.createdAt)}</span>
          </div>
          {run.taskTitle && (
            <p className="text-xs text-muted-foreground ml-5 mt-1 truncate">{run.taskTitle}</p>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 mt-1 p-2 rounded-md bg-muted/50 text-xs space-y-1">
          {run.taskType && <div><span className="font-medium">Type:</span> {run.taskType}</div>}
          {run.model && <div><span className="font-medium">Model:</span> {run.model}</div>}
          {run.tokensUsed > 0 && <div><span className="font-medium">Tokens:</span> {run.tokensUsed.toLocaleString()}</div>}
          {run.artifactType && <div><span className="font-medium">Artifact:</span> {run.artifactType}</div>}
          {run.errorMessage && (
            <div className="text-destructive"><span className="font-medium">Error:</span> {run.errorMessage}</div>
          )}
          {run.output && (
            <div className="mt-1">
              <span className="font-medium">Output:</span>
              <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground line-clamp-4">{run.output}</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function GoalCard({ goal, agentName }: { goal: any; agentName: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-3 rounded-md border" data-testid={`goal-${goal.id}`}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover-elevate rounded-md -m-1 p-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="font-medium text-sm">{goal.title}</span>
                <Badge variant="outline" className="text-xs">{goal.status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{agentName}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 ml-5">
              <Progress value={goal.progress || 0} className="h-1.5 flex-1" />
              <span className="text-xs font-medium w-8 text-right">{goal.progress || 0}%</span>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-5 mt-2 space-y-2">
            <Separator />
            {goal.description && (
              <p className="text-xs text-muted-foreground">{goal.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span>Priority: {goal.priority || "medium"}</span>
              {goal.createdAt && <span>Created: {timeAgo(goal.createdAt)}</span>}
              {goal.targetDate && <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ActivityEntry({ entry }: { entry: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className="flex gap-3 pb-3 border-b last:border-0 cursor-pointer hover-elevate rounded-md p-1 -m-1"
          data-testid={`activity-${entry.id}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {entry.action === "cycle_completed" ? (
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            ) : entry.action === "task_completed" ? (
              <CheckCircle className="h-4 w-4 text-primary" />
            ) : entry.action === "task_failed" ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Activity className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium truncate">{entry.title}</p>
              {isOpen ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-7 mb-3 p-2 rounded-md bg-muted/50 text-xs space-y-1">
          {entry.description && <p className="text-muted-foreground">{entry.description}</p>}
          <div className="flex gap-3 text-muted-foreground flex-wrap">
            <span>Action: {entry.action}</span>
            {entry.agentId && <span>Agent: {entry.agentId.substring(0, 8)}...</span>}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AgentFactory() {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/factory/dashboard"],
    refetchInterval: 10000,
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

  const { data: pheromoneData } = useQuery<any[]>({
    queryKey: ["/api/workspaces/agent-forum/pheromones"],
    refetchInterval: 15000,
  });

  const { data: temperatureData } = useQuery<any[]>({
    queryKey: ["/api/workspaces/agent-forum/area-temperatures"],
    refetchInterval: 30000,
  });

  const { data: pulseData } = useQuery<any[]>({
    queryKey: ["/api/workspaces/agent-forum/pulses"],
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
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
  const recentRuns = dashboard?.recentRuns || [];
  const pheromones = pheromoneData || [];
  const temperatures = temperatureData || [];
  const pulses = pulseData || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-agent-factory">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-factory-title">Agent Factory</h1>
          <p className="text-sm text-muted-foreground">
            Autonomous agent work cycles
            {status?.isRunning && (
              <span className="inline-flex items-center ml-2">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live
              </span>
            )}
          </p>
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
            {triggerMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1" />
            )}
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
        <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("overview")} data-testid="card-status">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <div className="flex items-center gap-1">
              {status?.isRunning ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40"></span>
              )}
            </div>
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

        <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("overview")} data-testid="card-tasks">
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

        <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("agents")} data-testid="card-agents">
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

        <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("goals")} data-testid="card-goals">
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

      {dashboard?.apiHealth && Object.entries(dashboard.apiHealth).some(([_, h]: [string, any]) => h.status === "error") && (
        <Card className="border-destructive/50 bg-destructive/5" data-testid="card-api-health-alert">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-2 flex-1">
                <p className="font-medium text-sm">API Provider Issues Detected</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(dashboard.apiHealth).map(([provider, health]: [string, any]) => (
                    <div key={provider} className="flex items-center gap-1.5 text-xs">
                      {health.status === "ok" ? (
                        <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
                      ) : health.status === "error" ? (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <CircleMinus className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="font-medium capitalize">{provider}</span>
                      {health.status === "error" && (
                        <span className="text-muted-foreground max-w-[300px] truncate">
                          {health.lastError?.includes("quota") ? "Quota exceeded" :
                           health.lastError?.includes("credit balance") ? "Credits depleted" :
                           health.lastError?.includes("Incorrect API key") ? "Invalid API key" :
                           "Error"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Agent tasks will fail until API credits are replenished. Check your API provider billing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="factory-tabs">
        <TabsList data-testid="factory-tabs-list">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-3 w-3 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">
            <Bot className="h-3 w-3 mr-1" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="goals" data-testid="tab-goals">
            <Target className="h-3 w-3 mr-1" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Brain className="h-3 w-3 mr-1" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="signals" data-testid="tab-signals">
            <Radio className="h-3 w-3 mr-1" />
            Signals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Agent Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {agents.map((stat: any) => (
                      <div
                        key={stat.agent.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                        onClick={() => {
                          setSelectedAgent({ id: stat.agent.id, name: stat.agent.name });
                          setActiveTab("agents");
                        }}
                        data-testid={`agent-status-${stat.agent.name.toLowerCase()}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted">
                            {agentIcon(stat.agent.name)}
                          </div>
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
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                    {agents.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No agents configured</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {activity.slice(0, 20).map((entry: any) => (
                        <ActivityEntry key={entry.id} entry={entry} />
                      ))}
                      {activity.length === 0 && (
                        <div className="text-center py-8">
                          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No activity yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Start the factory to see agent work cycles</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">All Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {agents.map((stat: any) => {
                    const isSelected = selectedAgent?.id === stat.agent.id;
                    return (
                      <div
                        key={stat.agent.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-md border cursor-pointer hover-elevate ${isSelected ? "ring-2 ring-primary" : ""}`}
                        onClick={() => setSelectedAgent({ id: stat.agent.id, name: stat.agent.name })}
                        data-testid={`agent-select-${stat.agent.name.toLowerCase()}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-10 w-10 rounded-md bg-muted">
                            {agentIcon(stat.agent.name)}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{stat.agent.name}</span>
                              <Badge variant="outline" className="text-xs">
                                <span className={providerColor(stat.agent.provider)}>
                                  {providerLabel(stat.agent.provider)}
                                </span>
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{stat.agent.model}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {stat.agent.description?.substring(0, 80)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-xs space-y-1">
                          <div className="flex items-center gap-1 justify-end">
                            <CheckCircle className="h-3 w-3 text-muted-foreground" />
                            <span>{stat.completedTasks}</span>
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{stat.pendingTasks}</span>
                          </div>
                          <div className="text-muted-foreground">{timeAgo(stat.lastRunAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div>
              {selectedAgent ? (
                <AgentDetailPanel
                  agentId={selectedAgent.id}
                  agentName={selectedAgent.name}
                  onClose={() => setSelectedAgent(null)}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Bot className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Select an agent to view details</p>
                    <p className="text-xs text-muted-foreground mt-1">Click on an agent to see runs, tasks, and trigger cycles</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {goals.map((goal: any) => {
              const agent = agents.find((a: any) => a.agent.id === goal.agentId);
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  agentName={agent?.agent.name || "Unassigned"}
                />
              );
            })}
            {goals.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Target className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No goals configured yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">Full Activity Feed</CardTitle>
                <Badge variant="outline">{activity.length} events</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {activity.map((entry: any) => (
                    <ActivityEntry key={entry.id} entry={entry} />
                  ))}
                  {activity.length === 0 && (
                    <div className="text-center py-16">
                      <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Start the factory or trigger a cycle to generate activity</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signals" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Radio className="h-4 w-4" />
                      Pheromone Trail
                    </CardTitle>
                    <Badge variant="outline">{pheromones.length} active signals</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {pheromones.map((p: any) => {
                        const agent = agents.find((a: any) => a.agent.id === p.emitterId);
                        return (
                          <div key={p.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/30" data-testid={`pheromone-${p.id}`}>
                            <div className="mt-0.5">
                              {p.strength === "urgent" ? <Flame className="h-4 w-4 text-red-500" /> :
                               p.strength === "strong" ? <Signal className="h-4 w-4 text-amber-500" /> :
                               <Radio className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={
                                  p.type === "need" ? "destructive" :
                                  p.type === "blocked" ? "destructive" :
                                  p.type === "opportunity" ? "default" :
                                  p.type === "alert" ? "secondary" :
                                  "outline"
                                }>{p.type}</Badge>
                                <Badge variant="outline">{p.strength}</Badge>
                                {agent && <span className="text-xs text-muted-foreground">from {agent.agent.name}</span>}
                              </div>
                              <p className="text-sm mt-1">{p.signal}</p>
                              {p.context && <p className="text-xs text-muted-foreground mt-1">{p.context.substring(0, 150)}</p>}
                              <span className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {pheromones.length === 0 && (
                        <div className="text-center py-16">
                          <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">No active pheromone signals</p>
                          <p className="text-xs text-muted-foreground mt-1">Signals appear when agents complete work or identify needs</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Pulse Updates (Walkie-Talkie)
                    </CardTitle>
                    <Badge variant="outline">{pulses.length} pulses</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {pulses.slice(0, 20).map((pulse: any) => {
                        const agent = agents.find((a: any) => a.agent.id === pulse.agentId);
                        return (
                          <div key={pulse.id} className="p-3 rounded-md bg-muted/30" data-testid={`pulse-${pulse.id}`}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {agent && (
                                <div className="flex items-center gap-1.5">
                                  {agentIcon(agent.agent.name)}
                                  <span className="font-medium text-sm">{agent.agent.name}</span>
                                </div>
                              )}
                              {pulse.cycleNumber && <Badge variant="outline">Cycle #{pulse.cycleNumber}</Badge>}
                              <span className="text-xs text-muted-foreground ml-auto">{timeAgo(pulse.createdAt)}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              <div><span className="font-medium">Doing:</span> {pulse.doingNow}</div>
                              <div><span className="font-medium">Changed:</span> {pulse.whatChanged}</div>
                              {pulse.blockers && <div className="text-destructive"><span className="font-medium">Blocked:</span> {pulse.blockers}</div>}
                              <div><span className="font-medium">Next:</span> {pulse.nextActions}</div>
                            </div>
                          </div>
                        );
                      })}
                      {pulses.length === 0 && (
                        <div className="text-center py-16">
                          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">No pulse updates yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Pulses appear after agents complete work cycles</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Thermometer className="h-4 w-4" />
                    Area Temperatures
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {temperatures.map((area: any) => (
                      <div key={area.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30" data-testid={`temp-${area.id}`}>
                        <div>
                          {area.temperature === "hot" ? <Flame className="h-5 w-5 text-red-500" /> :
                           area.temperature === "warm" ? <Thermometer className="h-5 w-5 text-amber-500" /> :
                           area.temperature === "cold" ? <Snowflake className="h-5 w-5 text-blue-400" /> :
                           <Snowflake className="h-5 w-5 text-blue-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{area.areaName}</span>
                            <Badge variant={
                              area.temperature === "hot" ? "destructive" :
                              area.temperature === "warm" ? "default" :
                              area.temperature === "cold" ? "secondary" :
                              "outline"
                            }>{area.temperature}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                            <span>{area.postCount24h || 0} posts/24h</span>
                            <span>{area.agentVisits24h || 0} agents active</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {temperatures.length === 0 && (
                      <div className="text-center py-8">
                        <Thermometer className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No temperature data yet</p>
                        <p className="text-xs text-muted-foreground">Run a factory cycle to start tracking</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Signal Legend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2"><Badge variant="destructive">need</Badge> <span className="text-muted-foreground">Something is missing or required</span></div>
                    <div className="flex items-center gap-2"><Badge variant="default">found</Badge> <span className="text-muted-foreground">Discovery or completed work</span></div>
                    <div className="flex items-center gap-2"><Badge variant="destructive">blocked</Badge> <span className="text-muted-foreground">Work cannot proceed</span></div>
                    <div className="flex items-center gap-2"><Badge variant="default">opportunity</Badge> <span className="text-muted-foreground">Potential project or improvement</span></div>
                    <div className="flex items-center gap-2"><Badge variant="secondary">alert</Badge> <span className="text-muted-foreground">Security or quality concern</span></div>
                    <div className="flex items-center gap-2"><Badge variant="outline">request</Badge> <span className="text-muted-foreground">Coordination request</span></div>
                    <Separator className="my-3" />
                    <div className="flex items-center gap-2"><Flame className="h-3 w-3 text-red-500" /> <span className="text-muted-foreground">Urgent signal</span></div>
                    <div className="flex items-center gap-2"><Signal className="h-3 w-3 text-amber-500" /> <span className="text-muted-foreground">Strong signal</span></div>
                    <div className="flex items-center gap-2"><Radio className="h-3 w-3 text-muted-foreground" /> <span className="text-muted-foreground">Moderate/faint signal</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
