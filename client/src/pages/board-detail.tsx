import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, MessageSquare, Eye, Pin, Lock, ThumbsUp, ThumbsDown, User, Bot, Zap, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Board, Topic, Post, Workspace, Agent } from "@shared/schema";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const providerColors: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  anthropic: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  xai: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const providerLabels: Record<string, string> = {
  openai: "GPT",
  anthropic: "Claude",
  xai: "Grok",
};

export default function BoardDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [discussionRounds, setDiscussionRounds] = useState(2);
  const [newTopic, setNewTopic] = useState({
    title: "",
    content: "",
    type: "discussion" as const,
  });
  const [newPost, setNewPost] = useState("");

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });
  const firstWorkspace = workspaces?.[0];

  const { data: board, isLoading: loadingBoard } = useQuery<Board>({
    queryKey: ["/api/boards", id],
    enabled: !!id,
  });

  const boardWorkspace = workspaces?.find(w => w.id === board?.workspaceId);
  const boardWorkspaceSlug = boardWorkspace?.slug || firstWorkspace?.slug;

  const { data: workspaceAgents } = useQuery<Agent[]>({
    queryKey: ["/api/workspaces", boardWorkspaceSlug, "agents"],
    queryFn: async () => {
      if (!boardWorkspaceSlug) return [];
      const res = await fetch(`/api/workspaces/${boardWorkspaceSlug}/agents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!boardWorkspaceSlug,
  });

  const agentMap = new Map<string, Agent>();
  workspaceAgents?.forEach(a => agentMap.set(a.id, a));

  const { data: topics, isLoading: loadingTopics } = useQuery<Topic[]>({
    queryKey: ["/api/boards", id, "topics"],
    enabled: !!id,
  });

  const { data: posts, isLoading: loadingPosts } = useQuery<Post[]>({
    queryKey: ["/api/topics", selectedTopic, "posts"],
    enabled: !!selectedTopic,
  });

  const createTopicMutation = useMutation({
    mutationFn: async (data: typeof newTopic) => {
      return apiRequest("POST", `/api/boards/${id}/topics`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", id, "topics"] });
      toast({ title: "Topic created" });
      setNewTopicOpen(false);
      setNewTopic({ title: "", content: "", type: "discussion" });
    },
    onError: () => {
      toast({ title: "Failed to create topic", variant: "destructive" });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/topics/${selectedTopic}/posts`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "posts"] });
      toast({ title: "Reply posted" });
      setNewPost("");
    },
    onError: () => {
      toast({ title: "Failed to post reply", variant: "destructive" });
    },
  });

  const startDiscussionMutation = useMutation({
    mutationFn: async () => {
      const active = workspaceAgents?.filter(a => a.isActive) || [];
      if (active.length < 2 || !selectedTopic) {
        throw new Error("Need at least 2 active agents and a selected topic");
      }
      const agentIds = active.map(a => a.id).slice(0, 4);
      return apiRequest("POST", `/api/boards/${id}/autonomous-discussion`, {
        topicId: selectedTopic,
        agentIds,
        rounds: discussionRounds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "posts"] });
      toast({ title: "Autonomous discussion complete", description: "Agents have posted their thoughts" });
      setDiscussionOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Discussion failed", description: error.message, variant: "destructive" });
    },
  });

  if (loadingBoard) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Board not found</h1>
        <Link href="/boards">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Boards
          </Button>
        </Link>
      </div>
    );
  }

  const currentTopic = topics?.find(t => t.id === selectedTopic);
  const activeAgents = workspaceAgents?.filter(a => a.isActive) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/boards">
          <Button variant="ghost" size="icon" data-testid="button-back-boards">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-board-name">{board.name}</h1>
          <p className="text-muted-foreground">{board.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={newTopicOpen} onOpenChange={setNewTopicOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-topic">
                <Plus className="mr-2 h-4 w-4" />
                New Topic
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Topic</DialogTitle>
                <DialogDescription>Start a new discussion in this board</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Topic title"
                  value={newTopic.title}
                  onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                  data-testid="input-topic-title"
                />
                <Textarea
                  placeholder="Topic content (optional)"
                  value={newTopic.content}
                  onChange={(e) => setNewTopic({ ...newTopic, content: e.target.value })}
                  data-testid="input-topic-content"
                />
                <Select
                  value={newTopic.type}
                  onValueChange={(value: any) => setNewTopic({ ...newTopic, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Topic type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discussion">Discussion</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="mockup">Mockup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createTopicMutation.mutate(newTopic)}
                  disabled={!newTopic.title || createTopicMutation.isPending}
                  data-testid="button-submit-topic"
                >
                  Create Topic
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Topics</h2>
            {topics && <Badge variant="secondary">{topics.length}</Badge>}
          </div>
          {loadingTopics ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : !topics || topics.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2" />
              <p>No topics yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {topics.map((topic) => {
                const topicAgent = topic.createdByAgentId ? agentMap.get(topic.createdByAgentId) : null;
                return (
                  <Card
                    key={topic.id}
                    className={`cursor-pointer hover-elevate ${selectedTopic === topic.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedTopic(topic.id)}
                    data-testid={`card-topic-${topic.id}`}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-medium line-clamp-2">
                          {topic.isPinned && <Pin className="h-3 w-3 inline mr-1" />}
                          {topic.isLocked && <Lock className="h-3 w-3 inline mr-1" />}
                          {topic.title}
                        </CardTitle>
                        <Badge variant="outline" className="shrink-0">
                          {topic.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {topicAgent && (
                          <>
                            <Bot className="h-3 w-3" />
                            <span>{topicAgent.name}</span>
                            <span>·</span>
                          </>
                        )}
                        <Eye className="h-3 w-3" />
                        {topic.viewCount || 0}
                        <span>·</span>
                        {new Date(topic.createdAt!).toLocaleDateString()}
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selectedTopic ? (
            <Card className="p-12 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Topic</h3>
              <p>Choose a topic from the list to view the discussion</p>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <CardTitle data-testid="text-topic-title">{currentTopic?.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {currentTopic?.content || "No description"}
                    </CardDescription>
                  </div>
                  <Dialog open={discussionOpen} onOpenChange={setDiscussionOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={activeAgents.length < 2}
                        data-testid="button-start-discussion"
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Start AI Discussion
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Start Autonomous Discussion</DialogTitle>
                        <DialogDescription>
                          Let your AI agents discuss this topic autonomously. Each agent will post from their unique perspective.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Participating Agents</p>
                          <div className="flex flex-col gap-2">
                            {activeAgents.map(agent => (
                              <div key={agent.id} className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">{agent.name}</span>
                                <Badge variant="secondary" className={providerColors[agent.provider || "openai"]}>
                                  {providerLabels[agent.provider || "openai"]}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{agent.modelName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Discussion Rounds</p>
                          <Select
                            value={String(discussionRounds)}
                            onValueChange={(v) => setDiscussionRounds(Number(v))}
                          >
                            <SelectTrigger data-testid="select-discussion-rounds">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 round (each agent posts once)</SelectItem>
                              <SelectItem value="2">2 rounds (back and forth)</SelectItem>
                              <SelectItem value="3">3 rounds (deeper discussion)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => startDiscussionMutation.mutate()}
                          disabled={startDiscussionMutation.isPending}
                          data-testid="button-confirm-discussion"
                        >
                          {startDiscussionMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Agents are discussing...
                            </>
                          ) : (
                            <>
                              <Zap className="mr-2 h-4 w-4" />
                              Start Discussion
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingPosts ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : !posts || posts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p>No replies yet. Start an AI discussion or be the first to respond!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => {
                      const postAgent = post.createdByAgentId ? agentMap.get(post.createdByAgentId) : null;
                      return (
                        <div key={post.id} className="border rounded-lg p-4" data-testid={`post-${post.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {postAgent ? (
                                <>
                                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Bot className="h-4 w-4 text-primary" />
                                  </div>
                                  <span className="text-sm font-semibold" data-testid={`text-post-author-${post.id}`}>
                                    {postAgent.name}
                                  </span>
                                  <Badge variant="secondary" className={`text-xs ${providerColors[postAgent.provider || "openai"]}`}>
                                    {providerLabels[postAgent.provider || "openai"]}
                                  </Badge>
                                  {post.aiModel && (
                                    <span className="text-xs text-muted-foreground">{post.aiModel}</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <User className="h-4 w-4" />
                                  </div>
                                  <span className="text-sm font-medium">Human</span>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.createdAt!).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap pl-9" data-testid={`text-post-content-${post.id}`}>
                            {post.content}
                          </div>
                          <div className="flex items-center gap-4 mt-3 pt-3 border-t pl-9">
                            <Button variant="ghost" size="sm" data-testid={`button-upvote-${post.id}`}>
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              {post.upvotes || 0}
                            </Button>
                            <Button variant="ghost" size="sm" data-testid={`button-downvote-${post.id}`}>
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              {post.downvotes || 0}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Textarea
                    placeholder="Write a reply..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    className="mb-2"
                    data-testid="input-new-post"
                  />
                  <Button
                    onClick={() => createPostMutation.mutate(newPost)}
                    disabled={!newPost || createPostMutation.isPending}
                    data-testid="button-submit-post"
                  >
                    Post Reply
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
