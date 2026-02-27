import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Clock,
  MoreHorizontal,
  Send,
  Share2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useState } from "react";
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

export default function SocialPosts() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: posts, isLoading } = useQuery<SocialPost[]>({
    queryKey: ["/api/social-posts"],
  });

  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("POST", `/api/social-posts/${postId}/publish`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({
        title: "Post published",
        description: "Your post has been sent to the selected platforms.",
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
      toast({
        title: "Post deleted",
        description: "The social post has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete post",
        variant: "destructive",
      });
    },
  });

  const filteredPosts = posts?.filter((post) =>
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parseResults = (raw: string | null): Record<string, any> | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-social-posts-title">
            Social Media
          </h1>
          <p className="text-muted-foreground">
            Draft, schedule, and publish posts across all your social platforms
          </p>
        </div>
        <Link href="/social-posts/new">
          <Button className="gap-2" data-testid="button-create-social-post">
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-social-posts"
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
      ) : filteredPosts && filteredPosts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => {
            const results = parseResults(post.platformResults);
            return (
              <Card key={post.id} className="hover-elevate h-full" data-testid={`card-social-post-${post.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${statusColors[post.status] || ""}`} variant="outline">
                          {post.status}
                        </Badge>
                        {post.agentId && (
                          <Badge variant="secondary" className="text-xs">
                            agent
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(post.status === "draft" || post.status === "scheduled" || post.status === "failed") && (
                          <DropdownMenuItem
                            onClick={() => publishMutation.mutate(post.id)}
                            disabled={publishMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Publish Now
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>
                          <Link href={`/social-posts/${post.id}`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(post.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground line-clamp-4 whitespace-pre-wrap">
                    {post.content}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {post.platforms.map((p) => (
                      <Badge
                        key={p}
                        className={`text-xs capitalize ${platformColors[p] || ""}`}
                        variant="outline"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                  {results && post.status === "published" && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {Object.entries(results).map(([platform, result]: [string, any]) => (
                        <div key={platform} className="flex items-center gap-1">
                          <span className={result.success ? "text-green-600" : "text-red-500"}>
                            {result.success ? "OK" : "ERR"}
                          </span>
                          <span className="capitalize">{platform}</span>
                          {result.error && (
                            <span className="truncate">– {result.error}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-2 border-t text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>
                        {post.publishedAt
                          ? `Published ${new Date(post.publishedAt).toLocaleDateString()}`
                          : post.createdAt
                            ? new Date(post.createdAt).toLocaleDateString()
                            : "recently"}
                      </span>
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
              <Share2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching posts" : "No social posts yet"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first social post to start publishing across Twitter, Facebook, Instagram, and LinkedIn"
                }
              </p>
              {!searchQuery && (
                <Link href="/social-posts/new">
                  <Button className="gap-2" data-testid="button-create-first-social-post">
                    <Plus className="h-4 w-4" />
                    Create your first post
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
