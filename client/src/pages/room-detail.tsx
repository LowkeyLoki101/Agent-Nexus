import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Bot,
  Users,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Pin,
  Send,
  Activity,
  TrendingUp,
  Hash,
  Zap,
  Wind,
  Flame,
  Sparkles,
  CloudLightning,
  Minus,
  CornerDownRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Room, Agent, AgentState, MessageBoardPost } from "@shared/schema";

// --- Type maps and helpers ---

const roomTypeConfig: Record<string, { label: string; color: string }> = {
  discussion: { label: "Discussion", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  workshop: { label: "Workshop", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  arena: { label: "Arena", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  lounge: { label: "Lounge", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  library: { label: "Library", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
  lab: { label: "Lab", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  stage: { label: "Stage", color: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
  council: { label: "Council", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
};

const atmosphereConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  calm: { label: "Calm", icon: <Wind className="h-3.5 w-3.5" />, color: "text-sky-500" },
  tense: { label: "Tense", icon: <Zap className="h-3.5 w-3.5" />, color: "text-orange-500" },
  creative: { label: "Creative", icon: <Sparkles className="h-3.5 w-3.5" />, color: "text-violet-500" },
  chaotic: { label: "Chaotic", icon: <CloudLightning className="h-3.5 w-3.5" />, color: "text-red-500" },
  neutral: { label: "Neutral", icon: <Minus className="h-3.5 w-3.5" />, color: "text-gray-500" },
};

const postTypeConfig: Record<string, { label: string; color: string }> = {
  discussion: { label: "Discussion", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  review: { label: "Review", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  announcement: { label: "Announcement", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" },
  opinion: { label: "Opinion", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
  reaction: { label: "Reaction", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300" },
  analysis: { label: "Analysis", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300" },
};

const POST_TYPES = ["discussion", "review", "announcement", "opinion", "reaction", "analysis"] as const;

function formatTimeAgo(date: string | Date | null | undefined): string {
  if (!date) return "just now";
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

// --- Sub-components ---

function PostCard({
  post,
  agents,
  depth = 0,
  replies,
  onVote,
}: {
  post: MessageBoardPost;
  agents: Agent[];
  depth?: number;
  replies: MessageBoardPost[];
  onVote: (postId: string, direction: "up" | "down") => void;
}) {
  const author = agents.find((a) => a.id === post.authorAgentId);
  const childReplies = replies.filter((r) => r.replyToId === post.id);
  const postTypeCfg = postTypeConfig[post.postType || "discussion"] || postTypeConfig.discussion;
  const score = (post.upvotes || 0) - (post.downvotes || 0);

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""}>
      <Card className={`${post.isPinned ? "border-yellow-400/50 dark:border-yellow-600/50 bg-yellow-50/30 dark:bg-yellow-950/10" : ""}`}>
        <CardContent className="pt-4 pb-3 px-4">
          {/* Post header */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {post.isPinned && (
                <Pin className="h-3.5 w-3.5 text-yellow-500 shrink-0 -rotate-45" />
              )}
              {depth > 0 && (
                <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <Link href={author ? `/agents/${author.id}` : "#"}>
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={author?.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-xs">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">
                    {author?.name || (post.authorUserId ? "Human User" : "Unknown")}
                  </span>
                </div>
              </Link>
              <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${postTypeCfg.color}`} variant="outline">
                {postTypeCfg.label}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatTimeAgo(post.createdAt)}
              </span>
            </div>
          </div>

          {/* Post title */}
          {post.title && (
            <h4 className="text-sm font-semibold mb-1">{post.title}</h4>
          )}

          {/* Post content */}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                  <Hash className="h-2.5 w-2.5 mr-0.5" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Voting */}
          <div className="flex items-center gap-1 mt-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-green-500 hover:bg-green-500/10"
              onClick={() => onVote(post.id, "up")}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <span className={`text-xs font-medium min-w-[2ch] text-center ${score > 0 ? "text-green-500" : score < 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {score}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-red-500 hover:bg-red-500/10"
              onClick={() => onVote(post.id, "down")}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Threaded replies */}
      {childReplies.length > 0 && (
        <div className="mt-2 space-y-2">
          {childReplies.map((reply) => (
            <PostCard
              key={reply.id}
              post={reply}
              agents={agents}
              depth={depth + 1}
              replies={replies}
              onVote={onVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function RoomDetail() {
  const { roomId } = useParams<{ roomId: string }>();
  const { toast } = useToast();

  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<string>("discussion");
  const [postTags, setPostTags] = useState("");

  // Fetch room data
  const { data: room, isLoading: loadingRoom } = useQuery<Room>({
    queryKey: [`/api/rooms/${roomId}`],
    enabled: !!roomId,
  });

  // Fetch posts for this room
  const { data: posts, isLoading: loadingPosts } = useQuery<MessageBoardPost[]>({
    queryKey: [`/api/rooms/${roomId}/posts`],
    enabled: !!roomId,
  });

  // Fetch agents in this room (via agent state)
  const { data: agentStates } = useQuery<AgentState[]>({
    queryKey: [`/api/rooms/${roomId}/agents`],
    enabled: !!roomId,
  });

  // Fetch all agents for name/avatar resolution
  const { data: allAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agents = allAgents || [];

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      postType: string;
      tags: string[];
    }) => {
      return apiRequest("POST", `/api/rooms/${roomId}/posts`, {
        roomId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rooms/${roomId}/posts`] });
      setPostTitle("");
      setPostContent("");
      setPostType("discussion");
      setPostTags("");
      toast({
        title: "Post created",
        description: "Your post has been added to the board.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post.",
        variant: "destructive",
      });
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ postId, direction }: { postId: string; direction: "up" | "down" }) => {
      const endpoint = direction === "up" ? "upvote" : "downvote";
      return apiRequest("POST", `/api/rooms/${roomId}/posts/${postId}/${endpoint}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rooms/${roomId}/posts`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Vote failed",
        description: error.message || "Could not register your vote.",
        variant: "destructive",
      });
    },
  });

  function handleVote(postId: string, direction: "up" | "down") {
    voteMutation.mutate({ postId, direction });
  }

  function handleSubmitPost() {
    if (!postContent.trim()) {
      toast({
        title: "Content required",
        description: "Please write something before posting.",
        variant: "destructive",
      });
      return;
    }

    const tags = postTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    createPostMutation.mutate({
      title: postTitle.trim(),
      content: postContent.trim(),
      postType,
      tags,
    });
  }

  // --- Derived data ---

  const sortedPosts = posts
    ? [...posts].sort((a, b) => {
        // Pinned posts first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then newest first
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
    : [];

  // Top-level posts (no replyToId)
  const topLevelPosts = sortedPosts.filter((p) => !p.replyToId);
  // All replies (for threading)
  const allReplies = sortedPosts.filter((p) => p.replyToId);

  // Room stats
  const presentAgentIds = agentStates?.map((s) => s.agentId) || [];
  const presentAgents = agents.filter((a) => presentAgentIds.includes(a.id));
  const currentOccupancy = presentAgents.length;

  // Most active agent: agent with the most posts in this room
  const postCountByAgent: Record<string, number> = {};
  (posts || []).forEach((p) => {
    if (p.authorAgentId) {
      postCountByAgent[p.authorAgentId] = (postCountByAgent[p.authorAgentId] || 0) + 1;
    }
  });
  const mostActiveAgentId = Object.entries(postCountByAgent).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0];
  const mostActiveAgent = agents.find((a) => a.id === mostActiveAgentId);

  // Popular topics: aggregate tags from posts
  const tagCounts: Record<string, number> = {};
  (posts || []).forEach((p) => {
    p.tags?.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const popularTopics = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  // --- Loading state ---

  if (loadingRoom) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Room not found</h2>
        <p className="text-muted-foreground mb-4">
          This room doesn't exist or you don't have access.
        </p>
        <Link href="/rooms">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rooms
          </Button>
        </Link>
      </div>
    );
  }

  const roomTypeCfg = roomTypeConfig[room.type] || roomTypeConfig.discussion;
  const atmosphereCfg = atmosphereConfig[room.atmosphere || "neutral"] || atmosphereConfig.neutral;

  return (
    <div className="space-y-6">
      {/* --- Header Section --- */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Link href="/rooms">
              <Button variant="ghost" size="icon" className="mt-1 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {room.name}
                </h1>
                <Badge className={`${roomTypeCfg.color}`} variant="outline">
                  {roomTypeCfg.label}
                </Badge>
                <div className={`flex items-center gap-1 ${atmosphereCfg.color}`}>
                  {atmosphereCfg.icon}
                  <span className="text-xs font-medium">{atmosphereCfg.label}</span>
                </div>
              </div>

              {room.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {room.description}
                </p>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                {/* Attractor Strength */}
                <div className="flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Attractor</span>
                  <Progress
                    value={room.attractorStrength || 50}
                    className="w-20 h-2"
                  />
                  <span className="text-xs font-medium">{room.attractorStrength || 50}%</span>
                </div>

                {/* Capacity */}
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {currentOccupancy} / {room.capacity || 20}
                  </span>
                </div>
              </div>

              {/* Topics */}
              {room.topics && room.topics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {room.topics.map((topic, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      <Hash className="h-2.5 w-2.5 mr-0.5" />
                      {topic}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Agents currently in this room */}
        {presentAgents.length > 0 && (
          <div className="flex items-center gap-3 ml-14">
            <span className="text-xs text-muted-foreground font-medium">Present:</span>
            <div className="flex items-center -space-x-2">
              {presentAgents.slice(0, 12).map((agent) => (
                <Link key={agent.id} href={`/agents/${agent.id}`}>
                  <Avatar className="h-7 w-7 border-2 border-background cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all hover:z-10">
                    <AvatarImage src={agent.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-[10px]">
                      <Bot className="h-3 w-3 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                </Link>
              ))}
              {presentAgents.length > 12 && (
                <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    +{presentAgents.length - 12}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* --- Main content grid --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Message Board (main section) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Post Creation Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" />
                New Post
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Post title (optional)"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
              />
              <Textarea
                placeholder="Write your thoughts, analysis, or reaction..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="min-h-[100px] resize-y"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={postType} onValueChange={setPostType}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Post type" />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {postTypeConfig[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Tags (comma-separated)"
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSubmitPost}
                  disabled={createPostMutation.isPending || !postContent.trim()}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {createPostMutation.isPending ? "Posting..." : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts list */}
          <div className="space-y-3">
            {loadingPosts ? (
              [1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))
            ) : topLevelPosts.length > 0 ? (
              topLevelPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  agents={agents}
                  replies={allReplies}
                  onVote={handleVote}
                />
              ))
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-sm font-medium mb-1">No posts yet</h3>
                    <p className="text-xs text-muted-foreground">
                      Be the first to start a conversation in this room.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar: Room Stats */}
        <div className="space-y-4">
          {/* Activity Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Room Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Recent Activity</p>
                <p className="text-2xl font-bold">{posts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">total posts</p>
              </div>

              <Separator />

              {/* Most Active Agent */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Most Active Agent</p>
                {mostActiveAgent ? (
                  <Link href={`/agents/${mostActiveAgent.id}`}>
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={mostActiveAgent.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-[10px]">
                          <Bot className="h-3 w-3 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium">{mostActiveAgent.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {postCountByAgent[mostActiveAgent.id]} posts
                        </p>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No activity yet</p>
                )}
              </div>

              <Separator />

              {/* Popular Topics */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Popular Topics</p>
                {popularTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {popularTopics.map(([tag, count]) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] gap-1">
                        <Hash className="h-2.5 w-2.5" />
                        {tag}
                        <span className="text-muted-foreground">({count})</span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No topics yet</p>
                )}
              </div>

              <Separator />

              {/* Room Atmosphere History */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Atmosphere</p>
                <div className="space-y-2">
                  {["calm", "tense", "creative", "chaotic", "neutral"].map((atmo) => {
                    const cfg = atmosphereConfig[atmo];
                    const isCurrent = (room.atmosphere || "neutral") === atmo;
                    return (
                      <div
                        key={atmo}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                          isCurrent
                            ? "bg-accent font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span className={cfg.color}>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">
                            current
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Present Agents list (sidebar version) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Present ({currentOccupancy})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {presentAgents.length > 0 ? (
                <div className="space-y-2">
                  {presentAgents.map((agent) => (
                    <Link key={agent.id} href={`/agents/${agent.id}`}>
                      <div className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent cursor-pointer transition-colors">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={agent.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-[10px]">
                            <Bot className="h-3 w-3 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate">{agent.name}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-auto shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">
                  No agents currently here
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
