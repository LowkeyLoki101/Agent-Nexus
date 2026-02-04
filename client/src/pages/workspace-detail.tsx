import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  Bot, 
  Key, 
  FileText,
  Plus,
  Settings,
  Lock,
  Globe,
  Shield,
  MoreHorizontal,
  UserPlus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Workspace, Agent, WorkspaceMember, ApiToken, AuditLog } from "@shared/schema";

export default function WorkspaceDetail() {
  const [, params] = useRoute("/workspaces/:slug");
  const slug = params?.slug;

  const { data: workspace, isLoading: loadingWorkspace } = useQuery<Workspace>({
    queryKey: ["/api/workspaces", slug],
    enabled: !!slug,
  });

  const { data: members, isLoading: loadingMembers } = useQuery<WorkspaceMember[]>({
    queryKey: ["/api/workspaces", slug, "members"],
    enabled: !!slug,
  });

  const { data: agents, isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ["/api/workspaces", slug, "agents"],
    enabled: !!slug,
  });

  const { data: tokens, isLoading: loadingTokens } = useQuery<ApiToken[]>({
    queryKey: ["/api/workspaces", slug, "tokens"],
    enabled: !!slug,
  });

  const { data: logs, isLoading: loadingLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/workspaces", slug, "audit-logs"],
    enabled: !!slug,
  });

  if (loadingWorkspace) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Workspace not found</h2>
        <p className="text-muted-foreground mb-4">The workspace you're looking for doesn't exist or you don't have access.</p>
        <Link href="/workspaces">
          <Button variant="outline">Back to Workspaces</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/workspaces">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-workspace-name">
                {workspace.name}
              </h1>
              <Badge variant={workspace.isPrivate ? "secondary" : "outline"}>
                {workspace.isPrivate ? (
                  <><Lock className="h-3 w-3 mr-1" /> Private</>
                ) : (
                  <><Globe className="h-3 w-3 mr-1" /> Public</>
                )}
              </Badge>
            </div>
            <p className="text-muted-foreground">{workspace.description || "No description"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" data-testid="button-workspace-settings">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="members" className="gap-2" data-testid="tab-members">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-2" data-testid="tab-agents">
            <Bot className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-2" data-testid="tab-tokens">
            <Key className="h-4 w-4" />
            API Tokens
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2" data-testid="tab-audit">
            <FileText className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>People with access to this workspace</CardDescription>
                </div>
                <Button className="gap-2" data-testid="button-invite-member">
                  <UserPlus className="h-4 w-4" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : members && members.length > 0 ? (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover-elevate" data-testid={`member-${member.id}`}>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {member.entityType === "agent" ? (
                              <Bot className="h-4 w-4" />
                            ) : (
                              <Users className="h-4 w-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">User {member.userId.slice(0, 8)}...</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {member.role}
                            </Badge>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {member.entityType}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Change Role</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No members yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Registered Agents</CardTitle>
                  <CardDescription>Autonomous agents in this workspace</CardDescription>
                </div>
                <Link href={`/workspaces/${slug}/agents/new`}>
                  <Button className="gap-2" data-testid="button-register-agent">
                    <Plus className="h-4 w-4" />
                    Register Agent
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2].map((i) => (
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
              ) : agents && agents.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {agents.map((agent) => (
                    <div key={agent.id} className="p-4 border rounded-lg hover-elevate" data-testid={`agent-${agent.id}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
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
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Shield className="h-3 w-3" /> Verified
                                </Badge>
                              )}
                              <span className={`h-2 w-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>Manage Tokens</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {agent.description || "No description"}
                      </p>
                      {agent.capabilities && agent.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {agent.capabilities.slice(0, 3).map((cap, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {cap}
                            </Badge>
                          ))}
                          {agent.capabilities.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{agent.capabilities.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No agents registered</p>
                  <Link href={`/workspaces/${slug}/agents/new`}>
                    <Button variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Register your first agent
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Tokens</CardTitle>
                  <CardDescription>Manage access tokens for this workspace</CardDescription>
                </div>
                <Button className="gap-2" data-testid="button-create-token">
                  <Plus className="h-4 w-4" />
                  Create Token
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTokens ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : tokens && tokens.length > 0 ? (
                <div className="space-y-3">
                  {tokens.map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`token-${token.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                          <Key className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{token.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {token.tokenPrefix}...
                            </code>
                            <Badge variant={token.status === "active" ? "outline" : "secondary"} className="text-xs capitalize">
                              {token.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Used {token.usageCount} times
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Revoke</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No API tokens created</p>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create your first token
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Activity history for this workspace</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-1">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-4 p-3 hover-elevate rounded-lg" data-testid={`audit-log-${log.id}`}>
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {log.action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "Just now"}</span>
                          {log.entityType && (
                            <>
                              <span>•</span>
                              <span>{log.entityType}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No activity recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
