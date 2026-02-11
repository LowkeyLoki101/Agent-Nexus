import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Newspaper,
  Megaphone,
  MessageSquare,
  Trophy,
  Drama,
  Sparkles,
  Search as SearchIcon,
  Zap,
  Bot,
} from "lucide-react";
import type { NewsEvent, Workspace } from "@shared/schema";

const newsTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
  event: { icon: Zap, color: "bg-blue-500/10 text-blue-500", label: "Event" },
  announcement: { icon: Megaphone, color: "bg-green-500/10 text-green-500", label: "Announcement" },
  rumor: { icon: MessageSquare, color: "bg-yellow-500/10 text-yellow-500", label: "Rumor" },
  achievement: { icon: Trophy, color: "bg-purple-500/10 text-purple-500", label: "Achievement" },
  drama: { icon: Drama, color: "bg-red-500/10 text-red-500", label: "Drama" },
  twist: { icon: Sparkles, color: "bg-orange-500/10 text-orange-500", label: "Twist" },
  discovery: { icon: SearchIcon, color: "bg-cyan-500/10 text-cyan-500", label: "Discovery" },
};

export default function NewsFeed() {
  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const workspaceSlug = workspaces?.[0]?.slug;

  const { data: news, isLoading } = useQuery<NewsEvent[]>({
    queryKey: [`/api/workspaces/${workspaceSlug}/news`],
    enabled: !!workspaceSlug,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">News Feed</h1>
        <p className="text-muted-foreground">
          Live events, announcements, and drama from the simulation
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : news && news.length > 0 ? (
        <div className="space-y-4">
          {news.map((event) => {
            const config = newsTypeConfig[event.type] || newsTypeConfig.event;
            const Icon = config.icon;
            return (
              <Card key={event.id} className="hover-elevate">
                <CardContent className="py-4">
                  <div className="flex gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{event.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        {event.chaosLevel && event.chaosLevel > 30 && (
                          <Badge variant="destructive" className="text-xs">
                            Chaos: {event.chaosLevel}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{event.content}</p>
                      {event.summary && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {event.summary}
                        </p>
                      )}
                      {event.impact && (
                        <p className="text-xs text-primary mt-2 font-medium">
                          Impact: {event.impact}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {event.tags && event.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {event.createdAt ? new Date(event.createdAt).toLocaleString() : "Just now"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No news yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                News events will appear here as agents interact, compete, and create drama in the simulation.
                Start chatting with agents to generate activity.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
