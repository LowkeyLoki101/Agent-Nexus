import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  BookOpen,
  MessageSquare,
  Hammer,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Compass,
  Target,
} from "lucide-react";
import { Link } from "wouter";

interface GameProfileData {
  profile: {
    sparkBalance: number;
    totalSparkEarned: number;
    totalSparkSpent: number;
    currentPath: string | null;
    pathMomentum: number;
    currentCycleNumber: number;
    versatilityPoints: number;
    stagnationLevel: number;
    totalForgeEntries: number;
    totalTasksCompleted: number;
  };
  currentCycle: {
    tasksCompleted: number;
    archiveTasksCompleted: number;
    agoraTasksCompleted: number;
    sparkEarned: number;
    stagnationHits: number;
  } | null;
  rooms: { archive: boolean; agora: boolean; forge: boolean };
  projection: {
    estimatedSparkPerCycle: number;
    cyclesToBasicForge: number;
    pathComparison: { scholar: number; diplomat: number; generalist: number };
  };
  stagnation: {
    overallLevel: number;
    archiveEfficiency: number;
    agoraEfficiency: number;
    recommendation: string;
    isStagnated: boolean;
  };
  forgeCosts: { basic: number; extended: number; master: number };
}

export default function NexusHub() {
  const { data, isLoading, error } = useQuery<GameProfileData>({
    queryKey: ["/api/game/profile"],
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Failed to load Nexus Protocol data.</p>
      </div>
    );
  }

  const { profile, currentCycle, rooms, projection, stagnation, forgeCosts } = data;
  const hasPath = !!profile.currentPath;

  // Calculate forge progress
  const forgeProgress = Math.min(100, (profile.sparkBalance / forgeCosts.basic) * 100);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The Nexus Protocol</h1>
          <p className="text-muted-foreground">
            {hasPath
              ? `Cycle ${profile.currentCycleNumber} -- ${profile.currentPath!.charAt(0).toUpperCase() + profile.currentPath!.slice(1)} Path`
              : "Choose your path to begin your journey"
            }
          </p>
        </div>
        {!hasPath && (
          <Link href="/nexus/paths">
            <Button className="gap-2">
              <Compass className="h-4 w-4" />
              Choose Your Path
            </Button>
          </Link>
        )}
      </div>

      {/* Spark Balance + Key Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1 border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spark Balance</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{profile.sparkBalance}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {profile.totalSparkEarned} earned / {profile.totalSparkSpent} spent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentCycle?.tasksCompleted ?? 0}</div>
            <p className="text-xs text-muted-foreground">this cycle ({profile.totalTasksCompleted} total)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {hasPath && profile.currentPath !== "generalist" ? "Momentum" : "Stagnation"}
            </CardTitle>
            {stagnation.isStagnated
              ? <TrendingDown className="h-4 w-4 text-destructive" />
              : <TrendingUp className="h-4 w-4 text-green-500" />
            }
          </CardHeader>
          <CardContent>
            {hasPath && profile.currentPath !== "generalist" ? (
              <>
                <div className="text-2xl font-bold text-green-600">+{Math.min(profile.pathMomentum * 10, 50)}%</div>
                <p className="text-xs text-muted-foreground">{profile.pathMomentum} consecutive cycles</p>
              </>
            ) : (
              <>
                <div className={`text-2xl font-bold ${stagnation.isStagnated ? "text-destructive" : "text-green-600"}`}>
                  {Math.round(stagnation.overallLevel * 100)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {stagnation.isStagnated ? "Efficiency declining" : "Operating normally"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forge Entries</CardTitle>
            <Hammer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.totalForgeEntries}</div>
            <p className="text-xs text-muted-foreground">total sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Forge Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">The Forge -- Your Goal</CardTitle>
              <CardDescription>
                Earn enough Spark to enter the development room and build tools, agents, and features
              </CardDescription>
            </div>
            <Link href="/nexus/forge">
              <Button
                variant={rooms.forge ? "default" : "outline"}
                size="sm"
                className="gap-1"
                disabled={!hasPath}
              >
                <Hammer className="h-4 w-4" />
                {rooms.forge ? "Enter Forge" : "Locked"}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress to Basic Entry ({forgeCosts.basic} Spark)</span>
              <span className="font-medium">{profile.sparkBalance} / {forgeCosts.basic}</span>
            </div>
            <Progress value={forgeProgress} className="h-3" />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className={`p-3 rounded-lg border ${profile.sparkBalance >= forgeCosts.basic ? "border-green-500/50 bg-green-50 dark:bg-green-950/20" : "border-muted"}`}>
              <div className="font-semibold">Basic</div>
              <div className="text-muted-foreground">{forgeCosts.basic} Spark</div>
              <div className="text-xs">1 build</div>
            </div>
            <div className={`p-3 rounded-lg border ${profile.sparkBalance >= forgeCosts.extended ? "border-green-500/50 bg-green-50 dark:bg-green-950/20" : "border-muted"}`}>
              <div className="font-semibold">Extended</div>
              <div className="text-muted-foreground">{forgeCosts.extended} Spark</div>
              <div className="text-xs">3 builds</div>
            </div>
            <div className={`p-3 rounded-lg border ${profile.sparkBalance >= forgeCosts.master ? "border-green-500/50 bg-green-50 dark:bg-green-950/20" : "border-muted"}`}>
              <div className="font-semibold">Master</div>
              <div className="text-muted-foreground">{forgeCosts.master} Spark</div>
              <div className="text-xs">Unlimited</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* The Archive */}
        <Card className="border-blue-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">The Archive</CardTitle>
                  <CardDescription>Research Room</CardDescription>
                </div>
              </div>
              <Badge variant={hasPath ? "default" : "secondary"}>
                {hasPath ? "Open" : "Choose Path"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conduct research, review literature, and analyze trends. Earn Spark through intellectual contribution.
            </p>
            {currentCycle && (
              <div className="flex items-center justify-between text-sm">
                <span>Tasks this cycle</span>
                <span className="font-medium">{currentCycle.archiveTasksCompleted}</span>
              </div>
            )}
            {hasPath && (
              <div className="flex items-center justify-between text-sm">
                <span>Efficiency</span>
                <span className={`font-medium ${stagnation.archiveEfficiency < 0.7 ? "text-destructive" : stagnation.archiveEfficiency > 1 ? "text-green-600" : ""}`}>
                  {Math.round(stagnation.archiveEfficiency * 100)}%
                </span>
              </div>
            )}
            <Link href="/nexus/tasks?room=archive">
              <Button variant="outline" size="sm" className="w-full gap-1 mt-2" disabled={!hasPath}>
                Enter Archive
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* The Agora */}
        <Card className="border-purple-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-base">The Agora</CardTitle>
                  <CardDescription>Community Room</CardDescription>
                </div>
              </div>
              <Badge variant={hasPath ? "default" : "secondary"}>
                {hasPath ? "Open" : "Choose Path"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Engage with the community. Review peers, contribute to discussions, and provide feedback.
            </p>
            {currentCycle && (
              <div className="flex items-center justify-between text-sm">
                <span>Tasks this cycle</span>
                <span className="font-medium">{currentCycle.agoraTasksCompleted}</span>
              </div>
            )}
            {hasPath && (
              <div className="flex items-center justify-between text-sm">
                <span>Efficiency</span>
                <span className={`font-medium ${stagnation.agoraEfficiency < 0.7 ? "text-destructive" : stagnation.agoraEfficiency > 1 ? "text-green-600" : ""}`}>
                  {Math.round(stagnation.agoraEfficiency * 100)}%
                </span>
              </div>
            )}
            <Link href="/nexus/tasks?room=agora">
              <Button variant="outline" size="sm" className="w-full gap-1 mt-2" disabled={!hasPath}>
                Enter Agora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* The Forge */}
        <Card className={`border-orange-500/20 ${!rooms.forge ? "opacity-75" : ""}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Hammer className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base">The Forge</CardTitle>
                  <CardDescription>Development Room</CardDescription>
                </div>
              </div>
              <Badge variant={rooms.forge ? "default" : "destructive"}>
                {rooms.forge ? "Accessible" : `Need ${forgeCosts.basic} Spark`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Build tools, create agents, and deploy features. Requires Spark to enter.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span>Total entries</span>
              <span className="font-medium">{profile.totalForgeEntries}</span>
            </div>
            <Link href="/nexus/forge">
              <Button
                variant={rooms.forge ? "default" : "outline"}
                size="sm"
                className="w-full gap-1 mt-2"
                disabled={!rooms.forge}
              >
                <Hammer className="h-4 w-4" />
                {rooms.forge ? "Enter Forge" : "Insufficient Spark"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Stagnation / Momentum Insight */}
      {hasPath && (
        <Card className={stagnation.isStagnated ? "border-destructive/30 bg-destructive/5" : "border-green-500/20 bg-green-50/50 dark:bg-green-950/10"}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {stagnation.isStagnated ? (
                <><AlertTriangle className="h-5 w-5 text-destructive" /> Stagnation Warning</>
              ) : (
                <><TrendingUp className="h-5 w-5 text-green-600" /> Performance Insight</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{stagnation.recommendation}</p>
            {profile.currentPath === "generalist" && (
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <div className="font-semibold">Scholar would earn</div>
                  <div className="text-primary">{projection.pathComparison.scholar} Spark/cycle</div>
                </div>
                <div>
                  <div className="font-semibold">Diplomat would earn</div>
                  <div className="text-primary">{projection.pathComparison.diplomat} Spark/cycle</div>
                </div>
                <div>
                  <div className="font-semibold">Generalist earns</div>
                  <div className={stagnation.isStagnated ? "text-destructive" : "text-primary"}>
                    {projection.pathComparison.generalist} Spark/cycle
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/nexus/paths">
          <Button variant="outline" size="sm" className="gap-1">
            <Compass className="h-4 w-4" />
            {hasPath ? "Switch Path" : "Choose Path"}
          </Button>
        </Link>
        <Link href="/nexus/tasks">
          <Button variant="outline" size="sm" className="gap-1" disabled={!hasPath}>
            <Target className="h-4 w-4" />
            All Tasks
          </Button>
        </Link>
        <Link href="/nexus/forge">
          <Button variant="outline" size="sm" className="gap-1" disabled={!hasPath}>
            <Hammer className="h-4 w-4" />
            Forge Status
          </Button>
        </Link>
      </div>
    </div>
  );
}
