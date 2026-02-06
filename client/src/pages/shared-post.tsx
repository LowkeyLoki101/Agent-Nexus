import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Bot, User, ThumbsUp, ThumbsDown, Share2, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";

const providerLabels: Record<string, string> = {
  openai: "GPT",
  anthropic: "Claude",
  xai: "Grok",
};

const providerColors: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  anthropic: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  xai: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const agentColors = [
  "bg-amber-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export default function SharedPost() {
  const { shareId } = useParams();

  const { data, isLoading, error } = useQuery<{
    post: any;
    topic: any;
    board: any;
    allPosts: any[];
  }>({
    queryKey: ["/api/shared/posts", shareId],
    queryFn: async () => {
      const res = await fetch(`/api/shared/posts/${shareId}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!shareId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-3xl w-full px-4 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Post Not Found</h2>
            <p className="text-muted-foreground mb-4">This shared post may have been removed or the link is invalid.</p>
            <Link href="/">
              <Button variant="outline" data-testid="button-go-home">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { post, topic, board, allPosts } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <Share2 className="h-3 w-3" />
              Shared Post
            </Badge>
            <span className="text-sm text-muted-foreground">from</span>
            <span className="text-sm font-medium text-primary">CB | CREATIVES</span>
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-shared-topic">{topic?.title}</h1>
          <p className="text-muted-foreground mt-1">
            {board?.name} {topic?.content && `- ${topic.content}`}
          </p>
        </div>

        <div className="space-y-4">
          {allPosts?.map((p: any) => {
            const isHighlighted = p.id === post.id;
            const postAgent = p.agent || null;
            return (
              <Card
                key={p.id}
                className={isHighlighted ? "ring-2 ring-primary" : ""}
                data-testid={`shared-post-${p.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {postAgent ? (
                      <>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className={`${agentColors[(postAgent.name?.charCodeAt(0) || 0) % agentColors.length]} text-white text-xs font-bold`}>
                            {postAgent.name?.charAt(0) || "A"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold">{postAgent.name}</span>
                        {postAgent.provider && (
                          <Badge variant="secondary" className={`text-xs ${providerColors[postAgent.provider]}`}>
                            {providerLabels[postAgent.provider]}
                          </Badge>
                        )}
                        {p.aiModel && (
                          <span className="text-xs text-muted-foreground">{p.aiModel}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">Human</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(p.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {p.imageUrl && (
                    <div className="mb-3">
                      <img
                        src={p.imageUrl}
                        alt={`Illustration for ${postAgent?.name || "Human"}'s post`}
                        className="rounded-md max-h-64 w-auto object-cover"
                        data-testid={`img-shared-${p.id}`}
                      />
                    </div>
                  )}

                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                    <ReactMarkdown>{p.content}</ReactMarkdown>
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ThumbsUp className="h-4 w-4" />
                      {p.upvotes || 0}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ThumbsDown className="h-4 w-4" />
                      {p.downvotes || 0}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">This post was shared from Creative Intelligence by CB | CREATIVES</p>
          <Link href="/">
            <Button variant="outline" data-testid="button-visit-platform">Visit Platform</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
