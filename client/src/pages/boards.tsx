import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  MessageCircle,
  Plus,
  Pin,
  Lock,
  Send,
  ArrowLeft,
  Clock,
  Bot,
  User,
  Search,
} from "lucide-react";
import { useState } from "react";
import type { Workspace } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TopicWithWorkspace = {
  id: string;
  workspaceId: string;
  title: string;
  body: string | null;
  authorId: string;
  authorAgentId: string | null;
  isPinned: boolean;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  workspaceName?: string;
};

type Message = {
  id: string;
  topicId: string;
  content: string;
  authorId: string;
  authorAgentId: string | null;
  createdAt: string;
};

function TopicThread({ topic, agents, onBack }: { topic: TopicWithWorkspace; agents: any[]; onBack: () => void }) {
  const [newMessage, setNewMessage] = useState("");
  const { toast } = useToast();

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/topics", topic.id, "messages"],
    queryFn: () => fetch(`/api/topics/${topic.id}/messages`, { credentials: "include" }).then(r => r.json()),
  });

  const postMessage = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/topics/${topic.id}/messages`, { content: newMessage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topic.id, "messages"] });
      setNewMessage("");
    },
    onError: (e: any) => toast({ title: "Failed to post message", description: e.message, variant: "destructive" }),
  });

  const getAuthorName = (msg: Message) => {
    if (msg.authorAgentId) {
      const agent = agents?.find((a: any) => a.id === msg.authorAgentId);
      return agent?.name || "Unknown Agent";
    }
    return "Operator";
  };

  const getTopicAuthorName = () => {
    if (topic.authorAgentId) {
      const agent = agents?.find((a: any) => a.id === topic.authorAgentId);
      return agent?.name || "Unknown Agent";
    }
    return "Operator";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    postMessage.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-topics">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold truncate" data-testid="text-topic-title">{topic.title}</h2>
            {topic.isPinned && <Pin className="h-4 w-4 text-primary shrink-0" />}
            {topic.isClosed && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {topic.authorAgentId ? <Bot className="h-3 w-3 text-amber-500" /> : <User className="h-3 w-3" />}
            <span className="font-medium" data-testid="text-topic-author">{getTopicAuthorName()}</span>
            {topic.workspaceName && (
              <>
                <span className="text-muted-foreground/50">in</span>
                <span>{topic.workspaceName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {topic.body && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{topic.body}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{new Date(topic.createdAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
        ) : messages && messages.length > 0 ? (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-3 group" data-testid={`message-${msg.id}`}>
              <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                <AvatarFallback className={msg.authorAgentId ? "bg-primary/10 text-primary" : "bg-muted"}>
                  {msg.authorAgentId ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{getAuthorName(msg)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No messages yet. Start the discussion!</p>
        )}
      </div>

      {!topic.isClosed && (
        <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t" data-testid="form-post-message">
          <Textarea
            placeholder="Write a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[60px] flex-1"
            data-testid="input-message-content"
          />
          <Button type="submit" size="sm" disabled={!newMessage.trim() || postMessage.isPending} className="self-end" data-testid="button-send-message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

export default function Boards() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<TopicWithWorkspace | null>(null);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicBody, setNewTopicBody] = useState("");
  const [newTopicWorkspace, setNewTopicWorkspace] = useState("");
  const { toast } = useToast();

  const { data: topics, isLoading: topicsLoading } = useQuery<TopicWithWorkspace[]>({
    queryKey: ["/api/topics"],
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: agents } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  const createTopic = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/workspaces/${newTopicWorkspace}/topics`, {
        title: newTopicTitle,
        body: newTopicBody || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      setShowNewTopic(false);
      setNewTopicTitle("");
      setNewTopicBody("");
      setNewTopicWorkspace("");
      toast({ title: "Topic created" });
    },
    onError: (e: any) => toast({ title: "Failed to create topic", description: e.message, variant: "destructive" }),
  });

  const filteredTopics = topics?.filter(t =>
    !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.body?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (selectedTopic) {
    return (
      <div className="max-w-3xl mx-auto">
        <TopicThread topic={selectedTopic} agents={agents || []} onBack={() => setSelectedTopic(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-boards-title">Message Boards</h1>
            <p className="text-sm text-muted-foreground">Discussion topics across all departments</p>
          </div>
        </div>
        <Dialog open={showNewTopic} onOpenChange={setShowNewTopic}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-new-topic">
              <Plus className="h-4 w-4" /> New Topic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Discussion Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Department</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={newTopicWorkspace}
                  onChange={(e) => setNewTopicWorkspace(e.target.value)}
                  data-testid="select-topic-workspace"
                >
                  <option value="">Select department...</option>
                  {workspaces?.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Title</label>
                <Input
                  placeholder="Discussion topic title..."
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  data-testid="input-topic-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
                <Textarea
                  placeholder="Add context or details..."
                  value={newTopicBody}
                  onChange={(e) => setNewTopicBody(e.target.value)}
                  data-testid="input-topic-body"
                />
              </div>
              <Button
                className="w-full"
                disabled={!newTopicTitle.trim() || !newTopicWorkspace || createTopic.isPending}
                onClick={() => createTopic.mutate()}
                data-testid="button-submit-topic"
              >
                Create Topic
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-topics"
        />
      </div>

      {topicsLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : filteredTopics.length > 0 ? (
        <div className="space-y-2">
          {filteredTopics.map((topic) => (
            <Card
              key={topic.id}
              className="hover-elevate cursor-pointer transition-colors"
              onClick={() => setSelectedTopic(topic)}
              data-testid={`card-topic-${topic.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{topic.title}</span>
                      {topic.isPinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                      {topic.isClosed && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                    {topic.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{topic.body}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {topic.authorAgentId ? <Bot className="h-3 w-3 text-amber-500" /> : <User className="h-3 w-3" />}
                        <span data-testid={`text-topic-author-${topic.id}`}>
                          {topic.authorAgentId
                            ? agents?.find((a: any) => a.id === topic.authorAgentId)?.name || "Agent"
                            : "Operator"}
                        </span>
                      </div>
                      {topic.workspaceName && (
                        <Badge variant="secondary" className="text-[10px]">{topic.workspaceName}</Badge>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(topic.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
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
              <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching topics" : "No discussion topics yet"}
              </h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                {searchQuery ? "Try adjusting your search" : "Create a topic to start a conversation across departments"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}