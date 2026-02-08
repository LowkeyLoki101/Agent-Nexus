import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import OrganizationMap from "@/components/organization-map";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Bot, 
  Users, 
  Key, 
  Building2,
  ArrowRight,
  Activity,
  Zap,
  TrendingUp,
  BarChart3,
  Clock,
  Download,
  Upload,
  FileUp,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import type { Workspace, Agent, AuditLog } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface TokenUsageSummary {
  totalTokens: number;
  totalRequests: number;
  byProvider: Record<string, number>;
  byAgent: Record<string, number>;
}

interface TokenBucket {
  bucket: string;
  totalTokens: number;
  requests: number;
  avgTokens: number;
}

interface TokenBudgetRemaining {
  allocation: number;
  used: number;
  remaining: number;
  cadence: string;
}

type Granularity = "minute" | "hour" | "day" | "week" | "month";

interface ImportResult {
  message: string;
  results: Record<string, { imported: number; skipped: number; errors: number }>;
  totalImported: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [granularity, setGranularity] = useState<Granularity>("hour");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ exportedAt: string; version: string; tableCounts: Record<string, number> } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/export", { credentials: "include" });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cb-creatives-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.tables || typeof data.tables !== "object") {
          toast({ title: "Invalid file", description: "This doesn't look like a valid export file.", variant: "destructive" });
          setImportFile(null);
          return;
        }
        setImportPreview({
          exportedAt: data.exportedAt || "Unknown",
          version: data.version || "Unknown",
          tableCounts: data.tableCounts || Object.fromEntries(
            Object.entries(data.tables).map(([k, v]) => [k, (v as any[]).length])
          ),
        });
        setImportDialogOpen(true);
      } catch {
        toast({ title: "Invalid file", description: "Could not parse the JSON file.", variant: "destructive" });
        setImportFile(null);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportConfirm = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tables: data.tables }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Import failed");
      }
      const result: ImportResult = await response.json();
      setImportResult(result);
      queryClient.invalidateQueries();
      toast({ title: "Import complete", description: `${result.totalImported} records imported successfully.` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message || "Something went wrong during import.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: recentAgents, isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents/recent"],
  });

  const { data: recentLogs, isLoading: loadingLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs/recent"],
  });

  const { data: tokenSummary, isLoading: loadingTokenSummary } = useQuery<TokenUsageSummary>({
    queryKey: ["/api/token-usage/summary"],
  });

  const { data: tokenBuckets, isLoading: loadingBuckets } = useQuery<TokenBucket[]>({
    queryKey: [`/api/token-usage/buckets?granularity=${granularity}&limit=30`],
  });

  const { data: tokenBudget } = useQuery<TokenBudgetRemaining | null>({
    queryKey: ["/api/token-budget"],
  });

  const stats = {
    workspaces: workspaces?.length || 0,
    agents: recentAgents?.length || 0,
  };

  function formatTokenCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function formatBucketLabel(bucket: string): string {
    const d = new Date(bucket);
    if (granularity === "minute" || granularity === "hour") {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (granularity === "day") {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    if (granularity === "week") {
      return `Wk ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    }
    return d.toLocaleDateString([], { month: "short", year: "2-digit" });
  }

  const chartData = (tokenBuckets || []).map(b => ({
    ...b,
    label: formatBucketLabel(b.bucket),
  }));

  const avgPerRequest = tokenSummary && tokenSummary.totalRequests > 0
    ? Math.round(tokenSummary.totalTokens / tokenSummary.totalRequests)
    : 0;

  const budgetPercent = tokenBudget
    ? Math.round((tokenBudget.used / tokenBudget.allocation) * 100)
    : null;

  return (
    <div className="space-y-8 relative">
      <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at 30% 0%, hsl(45 90% 52% / 0.04) 0%, transparent 70%)' }} />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">
            Welcome back, {user?.firstName || "there"}
          </h1>
          <p className="text-muted-foreground">
            Manage your studios, agents, and creative collaboration
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-import-file"
          />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} data-testid="button-import-data">
            <Upload className="h-4 w-4" />
            Import Data
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting} data-testid="button-export-data">
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export Data"}
          </Button>
          <Link href="/workspaces/new">
            <Button className="gap-2" data-testid="button-new-workspace">
              <Plus className="h-4 w-4" />
              New Studio
            </Button>
          </Link>
        </div>
      </div>

      <OrganizationMap />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Studios</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingWorkspaces ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-workspace-count">{stats.workspaces}</div>
            )}
            <p className="text-xs text-muted-foreground">Active studios</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingAgents ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-agent-count">{stats.agents}</div>
            )}
            <p className="text-xs text-muted-foreground">Registered agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingTokenSummary ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-tokens-total">
                {formatTokenCount(tokenSummary?.totalTokens || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {tokenSummary?.totalRequests || 0} API requests
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per Request</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingTokenSummary ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-tokens-avg">
                {formatTokenCount(avgPerRequest)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">tokens per call</p>
          </CardContent>
        </Card>
      </div>

      {tokenBudget && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">Token Budget</CardTitle>
              <CardDescription>
                {tokenBudget.cadence.charAt(0).toUpperCase() + tokenBudget.cadence.slice(1)} allocation
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-2">
              <div className="flex-1">
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(budgetPercent || 0, 100)}%`,
                      backgroundColor: (budgetPercent || 0) > 90 ? 'hsl(0 84% 60%)' : (budgetPercent || 0) > 70 ? 'hsl(38 92% 50%)' : 'hsl(var(--primary))',
                    }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium" data-testid="text-budget-percent">{budgetPercent}%</span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{formatTokenCount(tokenBudget.used)} used</span>
              <span>{formatTokenCount(tokenBudget.remaining)} remaining of {formatTokenCount(tokenBudget.allocation)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Token Usage Over Time</CardTitle>
              <CardDescription>Track AI API consumption across your agents</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              {(["minute", "hour", "day", "week", "month"] as Granularity[]).map((g) => (
                <Button
                  key={g}
                  variant={granularity === g ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGranularity(g)}
                  data-testid={`button-granularity-${g}`}
                >
                  {g === "minute" ? "Min" : g === "hour" ? "Hr" : g === "day" ? "Day" : g === "week" ? "Wk" : "Mo"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBuckets ? (
            <div className="h-64 flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-64" data-testid="chart-token-usage">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => formatTokenCount(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string) => [
                      formatTokenCount(value),
                      name === "totalTokens" ? "Total Tokens" : name === "requests" ? "Requests" : "Avg/Request",
                    ]}
                  />
                  <Area type="monotone" dataKey="totalTokens" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="totalTokens" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-4" />
              <p>No token usage data yet</p>
              <p className="text-xs mt-1">Start the Agent Factory to begin tracking</p>
            </div>
          )}
        </CardContent>
      </Card>

      {tokenSummary && (tokenSummary.totalTokens > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by Provider</CardTitle>
              <CardDescription>Token distribution across AI providers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(tokenSummary.byProvider).sort((a, b) => b[1] - a[1]).map(([provider, tokens]) => (
                  <div key={provider} className="flex items-center justify-between gap-4" data-testid={`provider-usage-${provider}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline">{provider}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(tokens / tokenSummary.totalTokens) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">{formatTokenCount(tokens)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by Agent</CardTitle>
              <CardDescription>Token consumption per agent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(tokenSummary.byAgent).sort((a, b) => b[1] - a[1]).map(([name, tokens]) => (
                  <div key={name} className="flex items-center justify-between gap-4" data-testid={`agent-usage-${name}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          <Bot className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(tokens / tokenSummary.totalTokens) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">{formatTokenCount(tokens)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Your Studios</CardTitle>
                <CardDescription>Creative spaces where you collaborate</CardDescription>
              </div>
              <Link href="/workspaces">
                <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-all-workspaces">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loadingWorkspaces ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : workspaces && workspaces.length > 0 ? (
              <div className="space-y-3">
                {workspaces.slice(0, 5).map((workspace) => (
                  <Link key={workspace.id} href={`/workspaces/${workspace.slug}`}>
                    <div className="flex items-center gap-4 p-3 rounded-lg hover-elevate cursor-pointer" data-testid={`card-workspace-${workspace.id}`}>
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{workspace.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {workspace.description || "No description"}
                        </p>
                      </div>
                      <Badge variant={workspace.isPrivate ? "secondary" : "outline"}>
                        {workspace.isPrivate ? "Private" : "Public"}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No studios yet</p>
                <Link href="/workspaces/new">
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-create-first-workspace">
                    <Plus className="h-4 w-4" />
                    Create your first studio
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest actions in your studios</CardDescription>
              </div>
              <Link href="/audit-logs">
                <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-all-logs">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentLogs && recentLogs.length > 0 ? (
              <div className="space-y-3">
                {recentLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center gap-4 p-2" data-testid={`log-entry-${log.id}`}>
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {formatAction(log.action)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : "Just now"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Your Agents</CardTitle>
              <CardDescription>Autonomous agents you manage</CardDescription>
            </div>
            <Link href="/agents">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-all-agents">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAgents ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : recentAgents && recentAgents.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentAgents.slice(0, 6).map((agent) => (
                <div key={agent.id} className="p-4 border rounded-lg hover-elevate" data-testid={`card-agent-${agent.id}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar>
                      <AvatarImage src={agent.avatar || undefined} />
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <div className="flex items-center gap-2">
                        {agent.isVerified && (
                          <Badge variant="outline" className="text-xs">Verified</Badge>
                        )}
                        <span className={`h-2 w-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description || "No description"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No agents registered yet</p>
              <Link href="/agents/new">
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-register-agent">
                  <Plus className="h-4 w-4" />
                  Register your first agent
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!importing) { setImportDialogOpen(open); if (!open) { setImportResult(null); setImportFile(null); setImportPreview(null); } } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              {importResult ? "Import Results" : "Import Data"}
            </DialogTitle>
            <DialogDescription>
              {importResult
                ? "Here's a summary of what was imported."
                : "Review the data before importing. Existing records will be kept — only new records are added."}
            </DialogDescription>
          </DialogHeader>

          {!importResult && importPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Exported on</span>
                  <p className="font-medium">{new Date(importPreview.exportedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Format version</span>
                  <p className="font-medium">{importPreview.version}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Data summary</p>
                <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-1">
                  {Object.entries(importPreview.tableCounts)
                    .filter(([, count]) => count > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([table, count]) => (
                      <div key={table} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{table.replace(/_/g, " ")}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Total: {Object.values(importPreview.tableCounts).reduce((s, n) => s + n, 0)} records across {Object.values(importPreview.tableCounts).filter(n => n > 0).length} tables
                </p>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{importResult.totalImported} records imported</span>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border p-3 space-y-1">
                {Object.entries(importResult.results)
                  .filter(([, r]) => r.imported > 0 || r.skipped > 0 || r.errors > 0)
                  .map(([table, r]) => (
                    <div key={table} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{table.replace(/_/g, " ")}</span>
                      <div className="flex items-center gap-2">
                        {r.imported > 0 && <Badge variant="secondary">{r.imported} new</Badge>}
                        {r.skipped > 0 && <Badge variant="outline">{r.skipped} existing</Badge>}
                        {r.errors > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {r.errors}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <DialogFooter>
            {importResult ? (
              <Button onClick={() => { setImportDialogOpen(false); setImportResult(null); setImportFile(null); setImportPreview(null); }} data-testid="button-import-done">
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportFile(null); setImportPreview(null); }} disabled={importing} data-testid="button-import-cancel">
                  Cancel
                </Button>
                <Button onClick={handleImportConfirm} disabled={importing} className="gap-2" data-testid="button-import-confirm">
                  <Upload className="h-4 w-4" />
                  {importing ? "Importing..." : "Import"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
