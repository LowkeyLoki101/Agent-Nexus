import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, CreditCard, Crown, Loader2, BarChart3, Activity, Zap, Eye, ArrowLeft, DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string | null;
  totalTokens?: number;
  totalCostCents?: number;
}

interface PlatformStats {
  totalUsers: number;
  activeUsers7d: number;
  totalTokens: number;
  totalCostCents: number;
  avgTokensPerUserPerDay: number;
}

interface UsageData {
  period: string;
  totalTokens: number;
  totalCostCents: number;
  feature?: string;
}

interface UserDetail {
  user: AdminUser;
  usage: { totalTokens: number; totalCostCents: number; byFeature: Record<string, { tokens: number; costCents: number }> };
  recentLogs: Array<{ id: number; model: string; feature: string; totalTokens: number; estimatedCostCents: number; createdAt: string }>;
  settings: { useOwnKey: boolean; monthlySpendLimitCents: number } | null;
}

const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const featureLabels: Record<string, string> = {
  chat: "Agent Chat",
  daemon: "Background Daemon",
  "daemon-wonder": "Daemon Wonder",
  "daemon-investigate": "Daemon Investigate",
  "daemon-reflect": "Daemon Reflect",
  "daemon-gift": "Gift Creation",
  "daemon-post": "Board Posts",
  "daemon-reply": "Board Replies",
  "daemon-briefing": "Briefings",
  "daemon-storefront": "Storefront AI",
  "command-chat": "Command Center",
  voice: "Voice Chat",
  image: "Image Generation",
  assembly: "Assembly Lines",
  court: "Court Evaluations",
};

function OverviewTab({ stats }: { stats?: PlatformStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold" data-testid="stat-total-users">{stats?.totalUsers ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Activity className="h-5 w-5 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold" data-testid="stat-active-users">{stats?.activeUsers7d ?? 0}</p>
            <p className="text-xs text-muted-foreground">Active (7d)</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Zap className="h-5 w-5 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold" data-testid="stat-total-tokens">{(stats?.totalTokens ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Tokens</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold" data-testid="stat-total-cost">{formatCost(stats?.totalCostCents ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Total Cost</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold" data-testid="stat-avg-tokens-day">{(stats?.avgTokensPerUserPerDay ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Avg Tokens/User/Day</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab({ users, onSelectUser, onUpdateUser, updatingUser }: {
  users?: AdminUser[];
  onSelectUser: (id: string) => void;
  onUpdateUser: (id: string, updates: { isAdmin?: boolean; subscriptionStatus?: string }) => void;
  updatingUser: string | null;
}) {
  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/30",
    none: "bg-muted text-muted-foreground",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/30",
    past_due: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">User Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tokens Used</TableHead>
              <TableHead>Est. Cost</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map(user => (
              <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" data-testid={`user-row-${user.id}`}>
                <TableCell onClick={() => onSelectUser(user.id)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {user.firstName || ""} {user.lastName || ""}
                    </span>
                    {user.isAdmin && (
                      <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                        <Crown className="h-2.5 w-2.5 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground" onClick={() => onSelectUser(user.id)}>{user.email || "—"}</TableCell>
                <TableCell className="text-sm font-mono" onClick={() => onSelectUser(user.id)} data-testid={`user-tokens-${user.id}`}>
                  {(user.totalTokens ?? 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm font-mono" onClick={() => onSelectUser(user.id)} data-testid={`user-cost-${user.id}`}>
                  {formatCost(user.totalCostCents ?? 0)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[user.subscriptionStatus || "none"] || statusColors.none}`}>
                    {user.subscriptionStatus || "none"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={user.isAdmin ? "admin" : "user"}
                    onValueChange={(val) => onUpdateUser(user.id, { isAdmin: val === "admin" })}
                    disabled={updatingUser === user.id}
                  >
                    <SelectTrigger className="w-24 h-8 text-xs" data-testid={`select-role-${user.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => onSelectUser(user.id)} data-testid={`button-view-user-${user.id}`}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UserDetailPanel({ userId, onBack, onImpersonate }: {
  userId: string;
  onBack: () => void;
  onImpersonate: (userId: string) => void;
}) {
  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ["/api/admin/users", userId],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!detail) return null;

  const { user, usage, recentLogs, settings } = detail;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-users">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold" data-testid="text-user-detail-name">{user.firstName} {user.lastName}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onImpersonate(userId)} data-testid="button-impersonate-user">
          <Eye className="h-4 w-4 mr-1" /> Impersonate
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xl font-bold" data-testid="detail-tokens">{(usage?.totalTokens ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Tokens This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xl font-bold" data-testid="detail-cost">{formatCost(usage?.totalCostCents ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Est. Cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xl font-bold" data-testid="detail-own-key">{settings?.useOwnKey ? "Yes" : "No"}</p>
            <p className="text-xs text-muted-foreground">Own API Key</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xl font-bold" data-testid="detail-spend-limit">{formatCost(settings?.monthlySpendLimitCents ?? 5000)}</p>
            <p className="text-xs text-muted-foreground">Spend Limit</p>
          </CardContent>
        </Card>
      </div>

      {usage?.byFeature && Object.keys(usage.byFeature).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Usage by Feature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(usage.byFeature)
                .sort(([, a], [, b]) => b.tokens - a.tokens)
                .map(([feature, data]) => {
                  const maxTokens = Math.max(...Object.values(usage.byFeature).map(d => d.tokens));
                  const pct = maxTokens > 0 ? (data.tokens / maxTokens) * 100 : 0;
                  return (
                    <div key={feature} className="space-y-1" data-testid={`detail-feature-${feature}`}>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{featureLabels[feature] || feature}</span>
                        <span className="font-mono">{data.tokens.toLocaleString()} ({formatCost(data.costCents)})</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {recentLogs && recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs">Feature</TableHead>
                    <TableHead className="text-xs">Model</TableHead>
                    <TableHead className="text-xs">Tokens</TableHead>
                    <TableHead className="text-xs">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.slice(0, 20).map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{featureLabels[log.feature] || log.feature}</TableCell>
                      <TableCell className="text-xs font-mono">{log.model}</TableCell>
                      <TableCell className="text-xs font-mono">{log.totalTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-mono">{formatCost(log.estimatedCostCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UsageAnalyticsTab() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const { data: usageData, isLoading } = useQuery<UsageData[]>({
    queryKey: ["/api/admin/token-usage", period],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={period} onValueChange={(v: "day" | "week" | "month") => setPeriod(v)}>
          <SelectTrigger className="w-32" data-testid="select-usage-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Token Usage Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : usageData && usageData.length > 0 ? (
            <div className="space-y-2">
              {usageData.map((entry, i) => {
                const maxTokens = Math.max(...usageData.map(d => d.totalTokens));
                const pct = maxTokens > 0 ? (entry.totalTokens / maxTokens) * 100 : 0;
                return (
                  <div key={i} className="space-y-1" data-testid={`usage-bar-${i}`}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{entry.period}</span>
                      <span className="font-mono">{entry.totalTokens.toLocaleString()} tokens ({formatCost(entry.totalCostCents)})</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No usage data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: profile } = useQuery<any>({ queryKey: ["/api/user/profile"] });
  const { data: adminUsers, isLoading } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });
  const { data: stats } = useQuery<PlatformStats>({ queryKey: ["/api/admin/stats"] });
  const { data: impersonation } = useQuery<any>({ queryKey: ["/api/admin/impersonation-status"] });

  if (!profile?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="page-admin-forbidden">
        <Card className="w-full max-w-md border-red-500/20">
          <CardContent className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto mb-4 text-red-500/50" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground">Admin privileges are required to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpdateUser = async (userId: string, updates: { isAdmin?: boolean; subscriptionStatus?: string }) => {
    setUpdatingUser(userId);
    try {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, updates);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated", description: "Changes saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update user.", variant: "destructive" });
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      await apiRequest("POST", `/api/admin/impersonate/${userId}`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonation-status"] });
      toast({ title: "Impersonating user", description: "You are now viewing the platform as this user." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to impersonate user.", variant: "destructive" });
    }
  };

  const handleStopImpersonate = async () => {
    try {
      await apiRequest("POST", "/api/admin/stop-impersonate", {});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/impersonation-status"] });
      toast({ title: "Stopped impersonating" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to stop impersonation.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6" data-testid="page-admin">
      {impersonation?.impersonating && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20" data-testid="banner-impersonation">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
              Viewing as {impersonation.targetUser?.firstName} {impersonation.targetUser?.lastName}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleStopImpersonate} data-testid="button-stop-impersonate">
            <ArrowLeft className="h-3 w-3 mr-1" /> Return to Admin
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">Manage users, monitor usage, and control the platform</p>
        </div>
      </div>

      {selectedUserId ? (
        <UserDetailPanel
          userId={selectedUserId}
          onBack={() => setSelectedUserId(null)}
          onImpersonate={handleImpersonate}
        />
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList data-testid="admin-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage">Usage Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab stats={stats} />
          </TabsContent>

          <TabsContent value="users">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <UsersTab
                users={adminUsers}
                onSelectUser={setSelectedUserId}
                onUpdateUser={handleUpdateUser}
                updatingUser={updatingUser}
              />
            )}
          </TabsContent>

          <TabsContent value="usage">
            <UsageAnalyticsTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
