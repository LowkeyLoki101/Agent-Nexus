import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Flame, Snowflake,
  Users, Package, Gift, Factory, Zap, TrendingUp,
} from "lucide-react";

interface DeptData {
  id: string;
  name: string;
  slug: string;
  activityLevel: "hot" | "warm" | "cool" | "cold" | "stalled";
  agents: { total: number; active: number };
  capabilities: string[];
  outputs: {
    gifts: { total: number; last24h: number; last7d: number };
    products: { completed: number; inProgress: number; queued: number; failed: number; stalled: number };
    pipelines: { total: number; active: number };
    pendingSteps: number;
    stalledSteps: number;
  };
}

interface HeatmapData {
  departments: DeptData[];
  summary: {
    totalDepartments: number;
    hotDepartments: number;
    stalledDepartments: number;
    coldDepartments: number;
    totalStalled: number;
    totalFailed: number;
    totalActive: number;
    totalCompleted: number;
  };
}

const ACTIVITY_CONFIG = {
  hot: { label: "Hot", color: "bg-orange-500", textColor: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10", icon: Flame },
  warm: { label: "Warm", color: "bg-amber-500", textColor: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10", icon: TrendingUp },
  cool: { label: "Cool", color: "bg-blue-400", textColor: "text-blue-400", border: "border-blue-400/30", bg: "bg-blue-500/10", icon: Activity },
  cold: { label: "Cold", color: "bg-slate-500", textColor: "text-slate-400", border: "border-slate-500/30", bg: "bg-slate-500/10", icon: Snowflake },
  stalled: { label: "Stalled", color: "bg-red-500", textColor: "text-red-400", border: "border-red-500/40", bg: "bg-red-500/10", icon: AlertTriangle },
};

function HeatCell({ dept }: { dept: DeptData }) {
  const config = ACTIVITY_CONFIG[dept.activityLevel];
  const Icon = config.icon;
  const hasIssues = dept.outputs.products.stalled > 0 || dept.outputs.products.failed > 0 || dept.outputs.stalledSteps > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={`${config.bg} ${config.border} border-2 transition-all hover:scale-[1.02] cursor-default`}
            data-testid={`heatmap-cell-${dept.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate" data-testid={`text-dept-name-${dept.id}`}>{dept.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{dept.agents.active}/{dept.agents.total} agents</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasIssues && <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />}
                  <Badge variant="outline" className={`text-[9px] gap-1 ${config.textColor} ${config.border}`}>
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-md bg-background/50 p-2 text-center">
                  <Gift className="h-3 w-3 mx-auto mb-0.5 text-purple-400" />
                  <p className="text-sm font-bold" data-testid={`text-gifts-${dept.id}`}>{dept.outputs.gifts.total}</p>
                  <p className="text-[9px] text-muted-foreground">Gifts</p>
                </div>
                <div className="rounded-md bg-background/50 p-2 text-center">
                  <Package className="h-3 w-3 mx-auto mb-0.5 text-green-400" />
                  <p className="text-sm font-bold" data-testid={`text-products-${dept.id}`}>{dept.outputs.products.completed}</p>
                  <p className="text-[9px] text-muted-foreground">Done</p>
                </div>
                <div className="rounded-md bg-background/50 p-2 text-center">
                  <Factory className="h-3 w-3 mx-auto mb-0.5 text-blue-400" />
                  <p className="text-sm font-bold" data-testid={`text-pipelines-${dept.id}`}>{dept.outputs.pipelines.total}</p>
                  <p className="text-[9px] text-muted-foreground">Pipelines</p>
                </div>
              </div>

              {(dept.outputs.products.inProgress > 0 || dept.outputs.products.queued > 0) && (
                <div className="flex gap-1.5 mb-2">
                  {dept.outputs.products.inProgress > 0 && (
                    <Badge variant="outline" className="text-[9px] gap-1 text-blue-400 border-blue-500/30">
                      <Clock className="h-2.5 w-2.5" />
                      {dept.outputs.products.inProgress} in progress
                    </Badge>
                  )}
                  {dept.outputs.products.queued > 0 && (
                    <Badge variant="outline" className="text-[9px] gap-1 text-gray-400 border-gray-500/30">
                      <Clock className="h-2.5 w-2.5" />
                      {dept.outputs.products.queued} queued
                    </Badge>
                  )}
                </div>
              )}

              {hasIssues && (
                <div className="space-y-1 border-t border-red-500/20 pt-2">
                  {dept.outputs.products.stalled > 0 && (
                    <div className="flex items-center gap-1.5 text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-[10px] font-medium">{dept.outputs.products.stalled} stalled product(s)</span>
                    </div>
                  )}
                  {dept.outputs.products.failed > 0 && (
                    <div className="flex items-center gap-1.5 text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-[10px] font-medium">{dept.outputs.products.failed} failed product(s)</span>
                    </div>
                  )}
                  {dept.outputs.stalledSteps > 0 && (
                    <div className="flex items-center gap-1.5 text-red-400">
                      <Zap className="h-3 w-3" />
                      <span className="text-[10px] font-medium">{dept.outputs.stalledSteps} stalled pipeline step(s)</span>
                    </div>
                  )}
                </div>
              )}

              {dept.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
                  {dept.capabilities.slice(0, 5).map(cap => (
                    <Badge key={cap} variant="secondary" className="text-[8px] px-1.5 py-0">{cap}</Badge>
                  ))}
                  {dept.capabilities.length > 5 && (
                    <Badge variant="secondary" className="text-[8px] px-1.5 py-0">+{dept.capabilities.length - 5}</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs font-medium mb-1">{dept.name}</p>
          <p className="text-[11px] text-muted-foreground">
            Gifts: {dept.outputs.gifts.last24h} today, {dept.outputs.gifts.last7d} this week |
            Products: {dept.outputs.products.completed} done, {dept.outputs.products.inProgress} active |
            Steps: {dept.outputs.pendingSteps} pending
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SummaryBar({ summary }: { summary: HeatmapData["summary"] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="bg-orange-500/5 border-orange-500/20">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Flame className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <p className="text-xl font-bold" data-testid="text-hot-count">{summary.hotDepartments}</p>
            <p className="text-[10px] text-muted-foreground">Hot Departments</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-red-500/5 border-red-500/20">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-xl font-bold" data-testid="text-stalled-count">{summary.totalStalled + summary.totalFailed}</p>
            <p className="text-[10px] text-muted-foreground">Stalled / Failed</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-green-500/5 border-green-500/20">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <p className="text-xl font-bold" data-testid="text-completed-count">{summary.totalCompleted}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Snowflake className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-xl font-bold" data-testid="text-cold-count">{summary.coldDepartments}</p>
            <p className="text-[10px] text-muted-foreground">Cold Departments</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Activity:</span>
      {Object.entries(ACTIVITY_CONFIG).map(([key, cfg]) => {
        const Icon = cfg.icon;
        return (
          <div key={key} className="flex items-center gap-1">
            <div className={`h-2.5 w-2.5 rounded-full ${cfg.color}`} />
            <Icon className={`h-3 w-3 ${cfg.textColor}`} />
            <span>{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Heatmap() {
  const { data, isLoading } = useQuery<HeatmapData>({
    queryKey: ["/api/factory/heatmap"],
    refetchInterval: 30000,
  });

  const sorted = [...(data?.departments || [])].sort((a, b) => {
    const order = { stalled: 0, hot: 1, warm: 2, cool: 3, cold: 4 };
    return (order[a.activityLevel] ?? 5) - (order[b.activityLevel] ?? 5);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-heatmap-title">Department Heatmap</h1>
        <p className="text-muted-foreground text-sm">
          Real-time activity and output status across all departments — spot stalls before they spread.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      )}

      {data && (
        <>
          <SummaryBar summary={data.summary} />
          <HeatLegend />
          {sorted.length === 0 ? (
            <Card className="p-12 text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-medium text-lg">No departments yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Create departments and add agents to see activity here.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map(dept => (
                <HeatCell key={dept.id} dept={dept} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
