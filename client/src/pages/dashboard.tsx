import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Bot, 
  Users, 
  Key, 
  FileText, 
  Building2,
  ArrowRight,
  Activity
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import type { Workspace, Agent, AuditLog } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: recentAgents, isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents/recent"],
  });

  const { data: recentLogs, isLoading: loadingLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs/recent"],
  });

  const stats = {
    workspaces: workspaces?.length || 0,
    agents: recentAgents?.length || 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">
            Welcome back, {user?.firstName || "there"}
          </h1>
          <p className="text-muted-foreground">
            Manage your studios, agents, and creative collaboration
          </p>
        </div>
        <Link href="/workspaces/new">
          <Button className="gap-2" data-testid="button-new-workspace">
            <Plus className="h-4 w-4" />
            New Studio
          </Button>
        </Link>
      </div>

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
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-member-count">-</div>
            <p className="text-xs text-muted-foreground">Across all workspaces</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Tokens</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-token-count">-</div>
            <p className="text-xs text-muted-foreground">Active tokens</p>
          </CardContent>
        </Card>
      </div>

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
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
