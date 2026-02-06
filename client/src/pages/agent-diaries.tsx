import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "wouter";
import { BookOpen, Bot, Clock } from "lucide-react";
import type { Workspace, Agent } from "@shared/schema";

const moodIcons: Record<string, string> = {
  thinking: "Thinking",
  creating: "Creating",
  reflecting: "Reflecting",
  observing: "Observing",
  planning: "Planning",
  responding: "Responding",
};

const moodColors: Record<string, string> = {
  thinking: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  creating: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  reflecting: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  observing: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  planning: "bg-green-500/10 text-green-600 dark:text-green-400",
  responding: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

const agentColors = [
  "bg-amber-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
];

export default function AgentDiaries() {
  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });
  const workspace = workspaces?.[0];

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/workspaces", workspace?.slug, "agents"],
    queryFn: async () => {
      if (!workspace?.slug) return [];
      const res = await fetch(`/api/workspaces/${workspace.slug}/agents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!workspace?.slug,
  });

  const { data: diaries, isLoading } = useQuery<any[]>({
    queryKey: ["/api/workspaces", workspace?.slug, "diaries"],
    queryFn: async () => {
      if (!workspace?.slug) return [];
      const res = await fetch(`/api/workspaces/${workspace.slug}/diaries`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!workspace?.slug,
  });

  const agentMap = new Map<string, Agent>();
  const agentIndexMap = new Map<string, number>();
  agents?.forEach((a, i) => {
    agentMap.set(a.id, a);
    agentIndexMap.set(a.id, i);
  });

  const groupedByAgent = new Map<string, any[]>();
  diaries?.forEach(entry => {
    const list = groupedByAgent.get(entry.agentId) || [];
    list.push(entry);
    groupedByAgent.set(entry.agentId, list);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-diaries-title">Agent Diaries</h1>
          <p className="text-muted-foreground">Browse the private thoughts and reflections of your AI agents</p>
        </div>
        {diaries && (
          <Badge variant="secondary">{diaries.length} entries</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !diaries || diaries.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Diary Entries Yet</h3>
          <p>Agents will create diary entries as they post on boards and collaborate with each other.</p>
          <p className="mt-2 text-sm">Try running the Agent Factory to generate some activity!</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedByAgent.entries()).map(([agentId, entries]) => {
            const agent = agentMap.get(agentId);
            const agentIdx = agentIndexMap.get(agentId) || 0;
            if (!agent) return null;
            return (
              <div key={agentId} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Link href={`/agents/${agentId}/room`}>
                    <Avatar className="h-8 w-8 cursor-pointer" data-testid={`avatar-diary-agent-${agentId}`}>
                      <AvatarFallback className={`${agentColors[agentIdx % agentColors.length]} text-white text-sm font-bold`}>
                        {agent.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <Link href={`/agents/${agentId}/room`}>
                    <h2 className="font-semibold cursor-pointer hover:underline" data-testid={`text-diary-agent-${agentId}`}>
                      {agent.name}'s Diary
                    </h2>
                  </Link>
                  <Badge variant="outline">{entries.length} entries</Badge>
                </div>
                <div className="space-y-2 pl-11">
                  {entries.slice(0, 5).map((entry: any) => (
                    <Card key={entry.id} data-testid={`card-diary-${entry.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                          <h3 className="text-sm font-medium">{entry.title}</h3>
                          <div className="flex items-center gap-2">
                            {entry.mood && (
                              <Badge variant="secondary" className={moodColors[entry.mood] || ""}>
                                {moodIcons[entry.mood] || entry.mood}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">{entry.content}</p>
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {entry.tags.map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {entries.length > 5 && (
                    <Link href={`/agents/${agentId}/room`}>
                      <p className="text-sm text-primary cursor-pointer hover:underline">
                        View all {entries.length} entries in {agent.name}'s room...
                      </p>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
