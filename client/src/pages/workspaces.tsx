import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Building2, 
  Search,
  Users,
  Bot,
  Lock,
  Globe
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import type { Workspace } from "@shared/schema";

export default function Workspaces() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: workspaces, isLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const filteredWorkspaces = workspaces?.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-workspaces-title">
            Workspaces
          </h1>
          <p className="text-muted-foreground">
            Manage your team spaces and collaboration environments
          </p>
        </div>
        <Link href="/workspaces/new">
          <Button className="gap-2" data-testid="button-create-workspace">
            <Plus className="h-4 w-4" />
            Create Workspace
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-workspaces"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkspaces && filteredWorkspaces.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWorkspaces.map((workspace) => (
            <Link key={workspace.id} href={`/workspaces/${workspace.slug}`}>
              <Card className="h-full hover-elevate cursor-pointer transition-all" data-testid={`card-workspace-${workspace.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{workspace.name}</CardTitle>
                        <CardDescription className="truncate">/{workspace.slug}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={workspace.isPrivate ? "secondary" : "outline"} className="shrink-0">
                      {workspace.isPrivate ? (
                        <><Lock className="h-3 w-3 mr-1" /> Private</>
                      ) : (
                        <><Globe className="h-3 w-3 mr-1" /> Public</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {workspace.description || "No description provided"}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>- members</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Bot className="h-4 w-4" />
                      <span>- agents</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching workspaces" : "No workspaces yet"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery 
                  ? "Try adjusting your search query"
                  : "Create your first workspace to start collaborating with agents and team members"
                }
              </p>
              {!searchQuery && (
                <Link href="/workspaces/new">
                  <Button className="gap-2" data-testid="button-create-first-workspace">
                    <Plus className="h-4 w-4" />
                    Create your first workspace
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
