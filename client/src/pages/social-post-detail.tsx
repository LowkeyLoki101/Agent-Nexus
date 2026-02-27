import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, Clock, CheckCircle2, XCircle, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SocialPost } from "@shared/schema";

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  publishing: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  published: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const platformColors: Record<string, string> = {
  twitter: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  facebook: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  linkedin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
};

export default function SocialPostDetail() {
  const [, params] = useRoute("/social-posts/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: post, isLoading } = useQuery<SocialPost>({
    queryKey: [`/api/social-posts/${params?.id}`],
    enabled: !!params?.id,
  });

  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("POST", `/api/social-posts/${postId}/publish`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [`/api/social-posts/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({
        title: "Published!",
        description: "Post has been sent to selected platforms.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Publish failed",
        description: error.message || "Failed to publish post",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("DELETE", `/api/social-posts/${postId}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({ title: "Post deleted" });
      setLocation("/social-posts");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete post",
        variant: "destructive",
      });
    },
  });

  const parseResults = (raw: string | null): Record<string, any> | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="py-8 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/social-posts">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Post not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const results = parseResults(post.platformResults);
  const canPublish = post.status === "draft" || post.status === "scheduled" || post.status === "failed";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/social-posts">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Social Post</h1>
          <p className="text-muted-foreground text-sm">
            Created {post.createdAt ? new Date(post.createdAt).toLocaleString() : "recently"}
          </p>
        </div>
        <div className="flex gap-2">
          {canPublish && (
            <Button
              className="gap-2"
              onClick={() => publishMutation.mutate(post.id)}
              disabled={publishMutation.isPending}
              data-testid="button-publish"
            >
              <Send className="h-4 w-4" />
              {publishMutation.isPending ? "Publishing..." : "Publish Now"}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate(post.id)}
            disabled={deleteMutation.isPending}
            data-testid="button-delete"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${statusColors[post.status] || ""}`} variant="outline">
              {post.status}
            </Badge>
            {post.agentId && (
              <Badge variant="secondary" className="gap-1">
                <Bot className="h-3 w-3" />
                Agent automated
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Content</h3>
            <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap text-sm">
              {post.content}
            </div>
            <p className="text-xs text-muted-foreground">{post.content.length} characters</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Target Platforms</h3>
            <div className="flex flex-wrap gap-2">
              {post.platforms.map((p) => (
                <Badge
                  key={p}
                  className={`capitalize ${platformColors[p] || ""}`}
                  variant="outline"
                >
                  {p}
                </Badge>
              ))}
            </div>
          </div>

          {post.publishedAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Published at {new Date(post.publishedAt).toLocaleString()}
            </div>
          )}

          {results && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Platform Results</h3>
              <div className="space-y-2">
                {Object.entries(results).map(([platform, result]: [string, any]) => (
                  <div
                    key={platform}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      result.success
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                        : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium capitalize text-sm">{platform}</p>
                      {result.success && result.postId && (
                        <p className="text-xs text-muted-foreground">Post ID: {result.postId}</p>
                      )}
                      {result.success && result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View on {platform}
                        </a>
                      )}
                      {result.error && (
                        <p className="text-xs text-red-600 dark:text-red-400">{result.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
