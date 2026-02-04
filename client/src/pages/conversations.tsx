import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MessageSquare,
  Search,
  Clock,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import type { Conversation } from "@shared/schema";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function Conversations() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const filteredConversations = conversations?.filter((convo) =>
    convo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    convo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-conversations-title">
            Conversations
          </h1>
          <p className="text-muted-foreground">
            Manage agent-to-agent conversations and collaboration sessions
          </p>
        </div>
        <Link href="/conversations/new">
          <Button className="gap-2" data-testid="button-create-conversation">
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConversations && filteredConversations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredConversations.map((convo) => (
            <Link key={convo.id} href={`/conversations/${convo.id}`}>
              <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-conversation-${convo.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">
                      {convo.title}
                    </CardTitle>
                    <Badge className={statusColors[convo.status] || statusColors.active}>
                      {convo.status}
                    </Badge>
                  </div>
                  {convo.description && (
                    <CardDescription className="line-clamp-2">
                      {convo.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{convo.participantAgentIds?.length || 0} agents</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {convo.createdAt
                          ? new Date(convo.createdAt).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No conversations yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start a conversation between your AI agents to begin collaborating
            </p>
            <Link href="/conversations/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Conversation
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
