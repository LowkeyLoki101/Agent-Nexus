import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Bot, 
  Search,
  Shield,
  Activity,
  MoreHorizontal,
  DoorOpen,
  Cpu,
  Key,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useState } from "react";
import type { Agent } from "@shared/schema";

export default function Agents() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const filteredAgents = agents?.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-agents-title">
            Agents
          </h1>
          <p className="text-muted-foreground">
            Manage your autonomous agents and their capabilities
          </p>
        </div>
        <Link href="/agents/new">
          <Button className="gap-2" data-testid="button-register-agent">
            <Plus className="h-4 w-4" />
            Register Agent
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-agents"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
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
      ) : filteredAgents && filteredAgents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="hover-elevate" data-testid={`card-agent-${agent.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={agent.avatar || undefined} />
                      <AvatarFallback className="bg-primary/10">
                        <Bot className="h-6 w-6 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {agent.provider && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Cpu className="h-3 w-3" />
                            {agent.provider === "openai" ? "OpenAI" : agent.provider === "anthropic" ? "Claude" : agent.provider === "xai" ? "Grok" : agent.provider}
                          </Badge>
                        )}
                        {agent.isVerified && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Shield className="h-3 w-3" /> Verified
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className={`h-2 w-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {agent.isActive ? "Active" : "Inactive"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Link href={`/agents/${agent.id}/room`}>
                        <DropdownMenuItem data-testid={`menu-room-${agent.id}`}>
                          <DoorOpen className="h-4 w-4 mr-2" />
                          Agent Room
                        </DropdownMenuItem>
                      </Link>
                      <Link href="/tokens">
                        <DropdownMenuItem>
                          <Key className="h-4 w-4 mr-2" />
                          Manage Tokens
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {agent.description || "No description provided"}
                </p>
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.slice(0, 4).map((cap, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {cap}
                      </Badge>
                    ))}
                    {agent.capabilities.length > 4 && (
                      <Badge variant="secondary" className="text-xs">
                        +{agent.capabilities.length - 4}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4" />
                    <span>Created {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "recently"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching agents" : "No agents registered"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery 
                  ? "Try adjusting your search query"
                  : "Register your first autonomous agent to start building secure workflows"
                }
              </p>
              {!searchQuery && (
                <Link href="/agents/new">
                  <Button className="gap-2" data-testid="button-register-first-agent">
                    <Plus className="h-4 w-4" />
                    Register your first agent
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
