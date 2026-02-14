import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Hammer,
  Zap,
  Lock,
  Unlock,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ForgeTier {
  tier: string;
  canAccess: boolean;
  cost: number;
  buildsAllowed: number;
  shortfall: number;
}

interface ForgeSession {
  id: string;
  sessionTier: string;
  sparkCost: number;
  buildsUsed: number;
  buildsAllowed: number;
  enteredAt: string;
}

interface ForgeData {
  activeSession: ForgeSession | null;
  history: ForgeSession[];
  tiers: ForgeTier[];
  profile: {
    sparkBalance: number;
    currentPath: string | null;
    totalForgeEntries: number;
  };
}

interface GameProfileData {
  profile: {
    sparkBalance: number;
    currentPath: string | null;
  };
}

const tierDescriptions = {
  basic: {
    name: "Basic Session",
    description: "A focused session with enough resources for one build. Best for quick prototypes or small tools.",
    features: ["1 build slot", "Standard tools", "Basic materials"],
  },
  extended: {
    name: "Extended Session",
    description: "A productive session with room for iteration. Ideal for building interconnected components.",
    features: ["3 build slots", "Advanced tools", "Premium materials"],
  },
  master: {
    name: "Master Session",
    description: "Full access to the Forge. Unlimited builds, all tools, all materials. For ambitious projects.",
    features: ["Unlimited builds", "Master tools", "All materials", "Priority access"],
  },
} as const;

export default function NexusForge() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ForgeData>({
    queryKey: ["/api/game/forge"],
  });

  const { data: profileData } = useQuery<GameProfileData>({
    queryKey: ["/api/game/profile"],
  });

  const enterMutation = useMutation({
    mutationFn: async (tier: string) => {
      const res = await apiRequest("POST", "/api/game/enter-forge", { tier });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/forge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/profile"] });
      toast({
        title: "Entered The Forge",
        description: `${data.forgeSession.sessionTier} session started. ${data.accessCalc.buildsAllowed} builds available. ${data.accessCalc.cost} Spark spent.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cannot Enter Forge",
        description: error?.message || "Insufficient Spark",
        variant: "destructive",
      });
    },
  });

  const buildMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/game/forge-build", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/forge"] });
      toast({
        title: "Build Complete",
        description: `${data.buildsRemaining} builds remaining in this session.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Build Failed",
        description: error?.message || "No active session or build limit reached",
        variant: "destructive",
      });
    },
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/game/advance-cycle", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/forge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/tasks"] });
      toast({
        title: "Cycle Advanced",
        description: `Now on Cycle ${data.profile.currentCycleNumber}. Momentum: +${Math.min(data.profile.pathMomentum * 10, 50)}%.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to advance cycle.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  const profile = data?.profile || profileData?.profile;
  const activeSession = data?.activeSession;
  const tiers = data?.tiers || [];
  const history = data?.history || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/nexus">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">The Forge</h1>
          <p className="text-muted-foreground">
            Spend Spark to enter and build tools, agents, and features.
            {profile?.currentPath === "generalist" && " (Generalist: 1.5x entry cost)"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-yellow-500" />
          <span className="font-bold">{profile?.sparkBalance ?? 0}</span>
          <span className="text-muted-foreground text-sm">Spark</span>
        </div>
      </div>

      {/* Active Session */}
      {activeSession && (
        <Card className="border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Hammer className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Active Forge Session</CardTitle>
                  <CardDescription>
                    {activeSession.sessionTier.charAt(0).toUpperCase() + activeSession.sessionTier.slice(1)} tier -- {activeSession.sparkCost} Spark invested
                  </CardDescription>
                </div>
              </div>
              <Badge variant="default" className="bg-orange-600">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Builds used</span>
                <span className="font-medium">
                  {activeSession.buildsUsed} / {activeSession.buildsAllowed === 999 ? "Unlimited" : activeSession.buildsAllowed}
                </span>
              </div>
              {activeSession.buildsAllowed !== 999 && (
                <Progress
                  value={(activeSession.buildsUsed / activeSession.buildsAllowed) * 100}
                  className="h-2"
                />
              )}
            </div>

            <Button
              className="w-full gap-2"
              onClick={() => buildMutation.mutate()}
              disabled={buildMutation.isPending}
            >
              <Package className="h-4 w-4" />
              {buildMutation.isPending ? "Building..." : "Use a Build"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No Path Warning */}
      {!profile?.currentPath && (
        <Card className="border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/10">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm">Choose a path before entering the Forge.</span>
            </div>
            <Link href="/nexus/paths">
              <Button size="sm">Choose Path</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tier Selection */}
      {!activeSession && profile?.currentPath && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Choose a Session Tier</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {tiers.map((tierData) => {
              const key = tierData.tier as keyof typeof tierDescriptions;
              const desc = tierDescriptions[key];
              const canAfford = tierData.canAccess;

              return (
                <Card
                  key={tierData.tier}
                  className={`${canAfford ? "border-primary/30" : "opacity-60"}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{desc.name}</CardTitle>
                      {canAfford ? (
                        <Unlock className="h-4 w-4 text-green-600" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <CardDescription>{desc.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-lg">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      <span className="font-bold">{tierData.cost}</span>
                      <span className="text-sm text-muted-foreground">Spark</span>
                    </div>

                    <div className="space-y-1">
                      {desc.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {canAfford ? (
                      <Button
                        className="w-full gap-1"
                        onClick={() => enterMutation.mutate(tierData.tier)}
                        disabled={enterMutation.isPending}
                      >
                        <Hammer className="h-4 w-4" />
                        {enterMutation.isPending ? "Entering..." : "Enter Forge"}
                      </Button>
                    ) : (
                      <div className="text-center text-sm text-muted-foreground p-2">
                        Need {tierData.shortfall} more Spark
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Advance Cycle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advance to Next Cycle</CardTitle>
          <CardDescription>
            End your current cycle and start fresh. Your path momentum will increase, stagnation resets,
            and you keep your Spark balance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => advanceMutation.mutate()}
            disabled={advanceMutation.isPending || !profile?.currentPath}
          >
            <Clock className="h-4 w-4" />
            {advanceMutation.isPending ? "Advancing..." : "Advance Cycle"}
          </Button>
        </CardContent>
      </Card>

      {/* Session History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forge History</CardTitle>
            <CardDescription>Previous development sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Hammer className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium">
                        {session.sessionTier.charAt(0).toUpperCase() + session.sessionTier.slice(1)} Session
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.enteredAt ? new Date(session.enteredAt).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{session.buildsUsed} builds used</span>
                    <span className="text-muted-foreground">{session.sparkCost} Spark</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
