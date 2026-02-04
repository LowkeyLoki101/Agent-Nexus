import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search,
  FileText,
  Filter,
  Download,
  Bot,
  User,
  Activity
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import type { AuditLog } from "@shared/schema";

const ACTION_COLORS: Record<string, string> = {
  workspace_created: "bg-green-500/10 text-green-600 dark:text-green-400",
  workspace_updated: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  member_added: "bg-green-500/10 text-green-600 dark:text-green-400",
  member_removed: "bg-red-500/10 text-red-600 dark:text-red-400",
  member_role_changed: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  agent_created: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  agent_updated: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  agent_deleted: "bg-red-500/10 text-red-600 dark:text-red-400",
  token_created: "bg-green-500/10 text-green-600 dark:text-green-400",
  token_revoked: "bg-red-500/10 text-red-600 dark:text-red-400",
  content_published: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  permission_changed: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  login: "bg-green-500/10 text-green-600 dark:text-green-400",
  logout: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityType?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(logs?.map((l) => l.action) || [])];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-audit-logs-title">
            Audit Logs
          </h1>
          <p className="text-muted-foreground">
            Comprehensive activity history across all workspaces
          </p>
        </div>
        <Button variant="outline" className="gap-2" data-testid="button-export-logs">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-logs"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-action-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((action) => (
              <SelectItem key={action} value={action}>
                {formatAction(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Timeline</CardTitle>
          <CardDescription>
            {filteredLogs?.length || 0} entries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 border-b last:border-0">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => (
                <div 
                  key={log.id} 
                  className="flex items-start gap-4 p-4 rounded-lg hover-elevate"
                  data-testid={`audit-log-${log.id}`}
                >
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {log.agentId ? (
                        <Bot className="h-5 w-5 text-primary" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    {index < filteredLogs.length - 1 && (
                      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-px h-8 bg-border" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{formatAction(log.action)}</span>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${ACTION_COLORS[log.action] || ''}`}
                          >
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {log.entityType && (
                            <>
                              <span>Entity: {log.entityType}</span>
                              <span>•</span>
                            </>
                          )}
                          {log.entityId && (
                            <>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {log.entityId.slice(0, 8)}...
                              </code>
                              <span>•</span>
                            </>
                          )}
                          <span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "Just now"}</span>
                        </div>
                        {log.metadata && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {log.metadata}
                          </p>
                        )}
                      </div>
                      <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        {log.ipAddress && (
                          <span className="bg-muted px-2 py-1 rounded">{log.ipAddress}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery || actionFilter !== "all" ? "No matching logs" : "No activity recorded"}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {searchQuery || actionFilter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Activity will appear here as you and your team use the platform"
                }
              </p>
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
