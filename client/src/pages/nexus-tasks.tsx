import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  BookOpen,
  MessageSquare,
  Hammer,
  CheckCircle2,
  Lock,
  AlertTriangle,
  TrendingDown,
  ArrowLeft,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AnnotatedTask {
  id: string;
  title: string;
  description: string;
  room: string;
  category: string;
  baseSparkReward: number;
  difficulty: string;
  requiredPath: string | null;
  availability: { allowed: boolean; reason?: string };
  sparkProjection: {
    baseReward: number;
    pathMultiplier: number;
    momentumBonus: number;
    stagnationPenalty: number;
    finalReward: number;
    wasStagnated: boolean;
  } | null;
}

interface GameProfileData {
  profile: {
    sparkBalance: number;
    currentPath: string | null;
    pathMomentum: number;
    currentCycleNumber: number;
  };
  currentCycle: {
    tasksCompleted: number;
    archiveTasksCompleted: number;
    agoraTasksCompleted: number;
    sparkEarned: number;
    stagnationHits: number;
  } | null;
  stagnation: {
    overallLevel: number;
    isStagnated: boolean;
    recommendation: string;
  };
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const variant = difficulty === "deep" ? "destructive"
    : difficulty === "standard" ? "default"
    : "secondary";
  return <Badge variant={variant}>{difficulty}</Badge>;
}

function RoomIcon({ room }: { room: string }) {
  if (room === "archive") return <BookOpen className="h-4 w-4 text-blue-500" />;
  if (room === "agora") return <MessageSquare className="h-4 w-4 text-purple-500" />;
  return <Hammer className="h-4 w-4 text-orange-500" />;
}

function TaskCard({
  task,
  onComplete,
  isCompleting,
}: {
  task: AnnotatedTask;
  onComplete: (taskId: string) => void;
  isCompleting: boolean;
}) {
  const isLocked = !task.availability.allowed;
  const projection = task.sparkProjection;
  const isStagnated = projection?.wasStagnated ?? false;

  return (
    <Card className={`${isLocked ? "opacity-60" : ""} ${isStagnated ? "border-yellow-500/30" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <RoomIcon room={task.room} />
            <CardTitle className="text-base">{task.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <DifficultyBadge difficulty={task.difficulty} />
            {task.requiredPath && (
              <Badge variant="outline">{task.requiredPath} only</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{task.description}</p>

        {/* Spark Projection */}
        {projection && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex items-center gap-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="font-bold">{projection.finalReward} Spark</span>
            </div>
            {projection.pathMultiplier !== 1 && (
              <span className={projection.pathMultiplier > 1 ? "text-green-600" : "text-destructive"}>
                {projection.pathMultiplier}x path
              </span>
            )}
            {projection.momentumBonus > 0 && (
              <span className="text-green-600">
                +{Math.round(projection.momentumBonus * 100)}% momentum
              </span>
            )}
            {projection.stagnationPenalty > 0 && (
              <span className="text-destructive flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                -{Math.round(projection.stagnationPenalty * 100)}% stagnation
              </span>
            )}
          </div>
        )}

        {/* Action */}
        {isLocked ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>{task.availability.reason}</span>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full gap-1"
            onClick={() => onComplete(task.id)}
            disabled={isCompleting}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isCompleting ? "Completing..." : "Complete Task"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function NexusTasks() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialRoom = params.get("room") || "all";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading: loadingTasks } = useQuery<AnnotatedTask[]>({
    queryKey: ["/api/game/tasks"],
  });

  const { data: profileData } = useQuery<GameProfileData>({
    queryKey: ["/api/game/profile"],
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", "/api/game/complete-task", { taskId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/tasks"] });
      const calc = data.sparkCalculation;
      const stagnationNote = calc.wasStagnated
        ? ` (${Math.round(calc.stagnationPenalty * 100)}% stagnation penalty applied)`
        : "";
      toast({
        title: `+${calc.finalReward} Spark earned`,
        description: `Base: ${calc.baseReward} | Path: ${calc.pathMultiplier}x | Momentum: +${Math.round(calc.momentumBonus * 100)}%${stagnationNote}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cannot complete task",
        description: error?.message || "Failed to complete task",
        variant: "destructive",
      });
    },
  });

  const archiveTasks = tasks?.filter((t) => t.room === "archive") || [];
  const agoraTasks = tasks?.filter((t) => t.room === "agora") || [];
  const allTasks = tasks?.filter((t) => t.room !== "forge") || [];

  const profile = profileData?.profile;
  const stagnation = profileData?.stagnation;
  const currentCycle = profileData?.currentCycle;

  if (loadingTasks) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/nexus">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Task Board</h1>
          <p className="text-muted-foreground">
            Complete tasks to earn Spark.
            {profile?.currentPath && ` You are on the ${profile.currentPath} path.`}
          </p>
        </div>
      </div>

      {/* Cycle Stats Bar */}
      {currentCycle && (
        <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-muted/30 border">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span><span className="font-medium">{profile?.sparkBalance}</span> Spark</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span><span className="font-medium">{currentCycle.archiveTasksCompleted}</span> Archive tasks</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-purple-500" />
            <span><span className="font-medium">{currentCycle.agoraTasksCompleted}</span> Agora tasks</span>
          </div>
          {currentCycle.stagnationHits > 0 && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{currentCycle.stagnationHits} stagnation hits</span>
            </div>
          )}
        </div>
      )}

      {/* Stagnation Warning */}
      {stagnation?.isStagnated && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">{stagnation.recommendation}</p>
          </CardContent>
        </Card>
      )}

      {/* No Path Warning */}
      {!profile?.currentPath && (
        <Card className="border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/10">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm">You must choose a path before completing tasks.</span>
            </div>
            <Link href="/nexus/paths">
              <Button size="sm">Choose Path</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Task Tabs */}
      <Tabs defaultValue={initialRoom}>
        <TabsList>
          <TabsTrigger value="all">All Tasks ({allTasks.length})</TabsTrigger>
          <TabsTrigger value="archive" className="gap-1">
            <BookOpen className="h-3 w-3" />
            Archive ({archiveTasks.length})
          </TabsTrigger>
          <TabsTrigger value="agora" className="gap-1">
            <MessageSquare className="h-3 w-3" />
            Agora ({agoraTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {allTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={(id) => completeMutation.mutate(id)}
                isCompleting={completeMutation.isPending}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="archive" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {archiveTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={(id) => completeMutation.mutate(id)}
                isCompleting={completeMutation.isPending}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agora" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {agoraTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={(id) => completeMutation.mutate(id)}
                isCompleting={completeMutation.isPending}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
