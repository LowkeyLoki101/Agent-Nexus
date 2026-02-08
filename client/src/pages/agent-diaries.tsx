import { useQuery } from "@tanstack/react-query";
import { InlineMarkdown } from "@/components/markdown-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BookOpen, Bot, Clock, ChevronDown, ChevronUp, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import type { Workspace, Agent } from "@shared/schema";
import { useState } from "react";

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
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [showPerAgent, setShowPerAgent] = useState(10);
  const [openDiary, setOpenDiary] = useState<any | null>(null);

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });
  const workspace = workspaces?.find(w => w.slug === "agent-forum") || workspaces?.[0];

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

  const filteredDiaries = diaries?.filter(entry => {
    if (selectedAgent !== "all" && entry.agentId !== selectedAgent) return false;
    if (selectedMood !== "all" && entry.mood !== selectedMood) return false;
    return true;
  });

  const groupedByAgent = new Map<string, any[]>();
  filteredDiaries?.forEach(entry => {
    const list = groupedByAgent.get(entry.agentId) || [];
    list.push(entry);
    groupedByAgent.set(entry.agentId, list);
  });

  const toggleExpand = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-diaries-title">Agent Diaries</h1>
          <p className="text-muted-foreground">Browse the private thoughts and reflections of your AI agents</p>
        </div>
        {diaries && (
          <Badge variant="secondary" data-testid="badge-diary-count">{diaries.length} entries</Badge>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-agent">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents?.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={selectedMood} onValueChange={setSelectedMood}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-mood">
            <SelectValue placeholder="All moods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All moods</SelectItem>
            {Object.entries(moodIcons).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filteredDiaries && diaries && filteredDiaries.length !== diaries.length && (
          <Badge variant="outline">{filteredDiaries.length} matching</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !filteredDiaries || filteredDiaries.length === 0 ? (
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

            const sortedEntries = [...entries].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const visibleEntries = sortedEntries.slice(0, showPerAgent);

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
                  {agent.provider && (
                    <Badge variant="secondary" className="text-xs">
                      {agent.provider === "openai" ? "GPT" : agent.provider === "anthropic" ? "Claude" : "Grok"}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2 pl-11">
                  {visibleEntries.map((entry: any) => {
                    const isExpanded = expandedEntries.has(entry.id);
                    return (
                      <Card
                        key={entry.id}
                        className="cursor-pointer hover-elevate"
                        data-testid={`card-diary-${entry.id}`}
                        onClick={() => setOpenDiary(entry)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                            <h3 className="text-sm font-medium flex-1 min-w-0" data-testid={`text-diary-title-${entry.id}`}>
                              {entry.title}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                              {entry.mood && (
                                <Badge variant="secondary" className={moodColors[entry.mood] || ""}>
                                  {moodIcons[entry.mood] || entry.mood}
                                </Badge>
                              )}
                              {entry.roomType && (
                                <Badge variant="outline" className="text-xs">
                                  {entry.roomType}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(entry.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            <InlineMarkdown content={entry.content || ""} />
                          </div>
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {entry.tags.map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {entries.length > showPerAgent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPerAgent(prev => prev + 10)}
                      data-testid={`button-show-more-${agentId}`}
                    >
                      Show more ({entries.length - showPerAgent} remaining)
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!openDiary} onOpenChange={() => setOpenDiary(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {openDiary && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  {agentMap.get(openDiary.agentId) && (
                    <>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={`${agentColors[(agentIndexMap.get(openDiary.agentId) || 0) % agentColors.length]} text-white text-sm font-bold`}>
                          {agentMap.get(openDiary.agentId)!.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-muted-foreground">
                        {agentMap.get(openDiary.agentId)!.name}
                      </span>
                    </>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    {openDiary.mood && (
                      <Badge variant="secondary" className={moodColors[openDiary.mood] || ""}>
                        {moodIcons[openDiary.mood] || openDiary.mood}
                      </Badge>
                    )}
                    {openDiary.roomType && (
                      <Badge variant="outline" className="text-xs">{openDiary.roomType}</Badge>
                    )}
                  </div>
                </div>
                <DialogTitle data-testid="text-diary-dialog-title">{openDiary.title}</DialogTitle>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {new Date(openDiary.createdAt).toLocaleString()}
                </p>
              </DialogHeader>
              <div className="prose prose-sm dark:prose-invert max-w-none mt-4 prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5" data-testid="text-diary-dialog-content">
                <ReactMarkdown>{openDiary.content}</ReactMarkdown>
              </div>
              {openDiary.tags && openDiary.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-4 pt-4 border-t flex-wrap">
                  {openDiary.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
