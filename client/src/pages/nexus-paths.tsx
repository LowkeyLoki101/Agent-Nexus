import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  BookOpen,
  MessageSquare,
  Shuffle,
  Zap,
  ArrowRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface GameProfileData {
  profile: {
    sparkBalance: number;
    currentPath: string | null;
    pathMomentum: number;
    versatilityPoints: number;
  };
  projection: {
    pathComparison: { scholar: number; diplomat: number; generalist: number };
  };
}

const pathDetails = {
  scholar: {
    name: "Scholar",
    icon: BookOpen,
    color: "blue",
    description: "The path of deep knowledge. Focus your energy on research and analysis.",
    advantages: [
      "2x Spark from Archive (research) tasks",
      "Focus momentum builds each cycle (+10%, up to +50%)",
      "Access to exclusive research-only tasks",
      "Standard Forge entry cost",
    ],
    tradeoffs: [
      "0.5x Spark from Agora (community) tasks",
      "Switching paths costs 20% of your Spark balance",
      "Momentum resets if you switch",
    ],
    room: "The Archive",
    roomDesc: "Research, analyze, review literature",
  },
  diplomat: {
    name: "Diplomat",
    icon: MessageSquare,
    color: "purple",
    description: "The path of connection. Build community through engagement and feedback.",
    advantages: [
      "2x Spark from Agora (community) tasks",
      "Focus momentum builds each cycle (+10%, up to +50%)",
      "Access to exclusive community-only tasks",
      "Standard Forge entry cost",
    ],
    tradeoffs: [
      "0.5x Spark from Archive (research) tasks",
      "Switching paths costs 20% of your Spark balance",
      "Momentum resets if you switch",
    ],
    room: "The Agora",
    roomDesc: "Discuss, review, mentor, feedback",
  },
  generalist: {
    name: "Generalist",
    icon: Shuffle,
    color: "gray",
    description: "The path of breadth. Do everything, but beware of spreading too thin.",
    advantages: [
      "1x Spark from all task types equally",
      "No task restrictions - access everything",
      "Gain Versatility points over time",
      "Maximum flexibility",
    ],
    tradeoffs: [
      "Diminishing returns after 3 tasks per room per cycle",
      "Heavy stagnation after 6+ tasks per room",
      "Cross-room penalty after 8+ total tasks per cycle",
      "1.5x Forge entry cost",
    ],
    room: "All Rooms",
    roomDesc: "Everything, but with stagnation risk",
  },
} as const;

export default function NexusPaths() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const { data, isLoading } = useQuery<GameProfileData>({
    queryKey: ["/api/game/profile"],
  });

  const chooseMutation = useMutation({
    mutationFn: async (path: string) => {
      const res = await apiRequest("POST", "/api/game/choose-path", { path });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/profile"] });
      const penalty = data.switchResult?.sparkPenalty || 0;
      if (penalty > 0) {
        toast({
          title: "Path Switched",
          description: `You switched paths. ${penalty} Spark was spent as a transition cost. Momentum reset.`,
        });
      } else {
        toast({
          title: "Path Chosen",
          description: `You are now on the ${data.profile.currentPath} path. Begin completing tasks to earn Spark.`,
        });
      }
      navigate("/nexus");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to choose path.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const projection = data?.projection;
  const currentPath = profile?.currentPath;
  const isSwitching = !!currentPath;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isSwitching ? "Switch Your Path" : "Choose Your Path"}
        </h1>
        <p className="text-muted-foreground">
          {isSwitching
            ? `You are currently on the ${currentPath} path with ${profile?.pathMomentum || 0} momentum. Switching costs 20% of your Spark.`
            : "Your path determines how you earn Spark. Each path has unique strengths and trade-offs."}
        </p>
      </div>

      {/* Switch Warning */}
      {isSwitching && profile && profile.sparkBalance > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="text-sm">
              <span className="font-medium">Path Switch Cost:</span> Switching will cost you{" "}
              <span className="font-bold">{Math.floor(profile.sparkBalance * 0.2)} Spark</span>{" "}
              (20% of your {profile.sparkBalance} balance) and reset your momentum from{" "}
              <span className="font-bold">+{Math.min(profile.pathMomentum * 10, 50)}%</span> to 0%.
              You will gain <span className="font-bold">{Math.max(1, profile.pathMomentum)} Versatility</span> points.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Path Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {(Object.entries(pathDetails) as [keyof typeof pathDetails, typeof pathDetails[keyof typeof pathDetails]][]).map(([key, path]) => {
          const isCurrentPath = currentPath === key;
          const isSelected = selectedPath === key;
          const Icon = path.icon;
          const projectedEarnings = projection?.pathComparison[key] || 0;

          const borderClass = key === "scholar" ? "border-blue-500/40"
            : key === "diplomat" ? "border-purple-500/40"
            : "border-gray-500/40";

          const bgClass = key === "scholar" ? "bg-blue-500/10"
            : key === "diplomat" ? "bg-purple-500/10"
            : "bg-gray-500/10";

          const iconColor = key === "scholar" ? "text-blue-500"
            : key === "diplomat" ? "text-purple-500"
            : "text-gray-500";

          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all ${
                isSelected ? `ring-2 ring-primary ${borderClass}` : isCurrentPath ? borderClass : ""
              } ${isCurrentPath ? bgClass : ""}`}
              onClick={() => !isCurrentPath && setSelectedPath(key)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-lg ${bgClass} flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 ${iconColor}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{path.name}</CardTitle>
                      <CardDescription>{path.room}</CardDescription>
                    </div>
                  </div>
                  {isCurrentPath && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{path.description}</p>

                {/* Projected earnings */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">~{projectedEarnings} Spark/cycle</span>
                </div>

                {/* Advantages */}
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase text-muted-foreground tracking-wider">Advantages</div>
                  {path.advantages.map((adv, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{adv}</span>
                    </div>
                  ))}
                </div>

                {/* Trade-offs */}
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase text-muted-foreground tracking-wider">Trade-offs</div>
                  {path.tradeoffs.map((tradeoff, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <span>{tradeoff}</span>
                    </div>
                  ))}
                </div>

                {/* Stagnation indicator for generalist */}
                {key === "generalist" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-sm">
                    <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                    <span>Stagnation risk: doing everything leads to diminishing returns</span>
                  </div>
                )}

                {/* Momentum indicator for specialists */}
                {key !== "generalist" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                    <span>Focus momentum: rewards increase the longer you stay committed</span>
                  </div>
                )}

                {/* Action button */}
                {isCurrentPath ? (
                  <Button variant="secondary" size="sm" className="w-full" disabled>
                    Currently Active
                  </Button>
                ) : (
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="w-full gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPath(key);
                    }}
                  >
                    {isSelected ? "Selected" : "Select"}
                    {isSelected && <CheckCircle2 className="h-4 w-4" />}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirm */}
      {selectedPath && selectedPath !== currentPath && (
        <Card className="border-primary/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <ArrowRight className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">
                  {isSwitching ? "Switch" : "Commit"} to the{" "}
                  {pathDetails[selectedPath as keyof typeof pathDetails].name} path?
                </p>
                <p className="text-sm text-muted-foreground">
                  {isSwitching
                    ? "This will apply the switch penalty and reset your momentum."
                    : "You can switch later, but it costs 20% of your Spark balance."}
                </p>
              </div>
            </div>
            <Button
              className="gap-1"
              onClick={() => chooseMutation.mutate(selectedPath)}
              disabled={chooseMutation.isPending}
            >
              {chooseMutation.isPending ? "Choosing..." : "Confirm Path"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
