import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Code, CheckCircle2, XCircle, Clock, MessageSquare, ThumbsUp, ThumbsDown, Bot } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CodeReview, ReviewComment, Workspace } from "@shared/schema";
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

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  needs_revision: MessageSquare,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  needs_revision: "bg-orange-500/10 text-orange-600",
};

export default function CodeReviews() {
  const { toast } = useToast();
  const [newReviewOpen, setNewReviewOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [newReview, setNewReview] = useState({
    title: "",
    description: "",
    code: "",
    language: "javascript",
    githubUrl: "",
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });
  const firstWorkspace = workspaces?.find(w => w.slug === "agent-forum") || workspaces?.[0];

  const { data: reviews, isLoading } = useQuery<CodeReview[]>({
    queryKey: ["/api/workspaces", firstWorkspace?.slug, "code-reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${firstWorkspace?.slug}/code-reviews`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch code reviews");
      return res.json();
    },
    enabled: !!firstWorkspace?.slug,
  });

  const { data: comments } = useQuery<ReviewComment[]>({
    queryKey: ["/api/code-reviews", selectedReview, "comments"],
    enabled: !!selectedReview,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newReview) => {
      return apiRequest("POST", `/api/workspaces/${firstWorkspace?.slug}/code-reviews`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "code-reviews"] });
      toast({ title: "Code review created" });
      setNewReviewOpen(false);
      setNewReview({ title: "", description: "", code: "", language: "javascript", githubUrl: "" });
    },
    onError: () => {
      toast({ title: "Failed to create code review", variant: "destructive" });
    },
  });

  if (isLoading || !workspaces) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!firstWorkspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-reviews-title">Code Reviews</h1>
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Code className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Studio Available</h3>
          <p className="text-muted-foreground mb-4">
            Create a studio first to start submitting code reviews
          </p>
          <Link href="/workspaces/new">
            <Button data-testid="button-create-workspace">
              <Plus className="mr-2 h-4 w-4" />
              Create Studio
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const currentReview = reviews?.find(r => r.id === selectedReview);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-reviews-title">Code Reviews</h1>
          <p className="text-muted-foreground">Multi-model peer review system for code quality</p>
        </div>
        <Dialog open={newReviewOpen} onOpenChange={setNewReviewOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-review">
              <Plus className="mr-2 h-4 w-4" />
              New Review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Code for Review</DialogTitle>
              <DialogDescription>
                Submit code for multi-model AI review and peer feedback
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Review title"
                value={newReview.title}
                onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                data-testid="input-review-title"
              />
              <Textarea
                placeholder="Description"
                value={newReview.description}
                onChange={(e) => setNewReview({ ...newReview, description: e.target.value })}
                data-testid="input-review-description"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={newReview.language}
                  onValueChange={(value) => setNewReview({ ...newReview, language: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="rust">Rust</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="cpp">C++</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="GitHub URL (optional)"
                  value={newReview.githubUrl}
                  onChange={(e) => setNewReview({ ...newReview, githubUrl: e.target.value })}
                  data-testid="input-review-github"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Code</label>
                <Textarea
                  placeholder="Paste your code here..."
                  value={newReview.code}
                  onChange={(e) => setNewReview({ ...newReview, code: e.target.value })}
                  className="font-mono text-sm min-h-[300px]"
                  data-testid="input-review-code"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate(newReview)}
                disabled={!newReview.title || !newReview.code || createMutation.isPending}
                data-testid="button-submit-review"
              >
                Submit for Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(!reviews || reviews.length === 0) ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Code className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Code Reviews</h3>
          <p className="text-muted-foreground mb-4">
            Submit code for multi-model AI review and peer feedback
          </p>
          <Button onClick={() => setNewReviewOpen(true)} data-testid="button-create-first-review">
            <Plus className="mr-2 h-4 w-4" />
            Submit First Review
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="font-semibold">Reviews</h2>
            {reviews.map((review) => {
              const StatusIcon = statusIcons[review.status || "pending"];
              return (
                <Card
                  key={review.id}
                  className={`cursor-pointer hover-elevate ${selectedReview === review.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedReview(review.id)}
                  data-testid={`card-review-${review.id}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge className={statusColors[review.status || "pending"]}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {review.status || "pending"}
                      </Badge>
                      {review.language && (
                        <Badge variant="outline">{review.language}</Badge>
                      )}
                    </div>
                    <CardTitle className="mt-2">{review.title}</CardTitle>
                    <CardDescription>{review.description || "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-4 w-4 text-green-500" />
                        {review.approvalCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsDown className="h-4 w-4 text-red-500" />
                        {review.rejectionCount || 0}
                      </span>
                      <span>
                        {new Date(review.createdAt!).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div>
            {!selectedReview ? (
              <Card className="p-12 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                <Code className="h-12 w-12 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Review</h3>
                <p>Choose a review to see the code and comments</p>
              </Card>
            ) : currentReview && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{currentReview.title}</CardTitle>
                  <CardDescription>{currentReview.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Code</h3>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-[300px] overflow-y-auto">
                      {currentReview.code}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Review Comments</h3>
                    {!comments || comments.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4 border rounded-lg">
                        <p>No review comments yet</p>
                        <p className="text-xs">Agents will automatically review this code</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {comments.map((comment) => (
                          <div key={comment.id} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Bot className="h-4 w-4 text-primary" />
                              {comment.aiModel && (
                                <Badge variant="secondary" className="text-xs">
                                  {comment.aiModel}
                                </Badge>
                              )}
                              {comment.isApproval ? (
                                <Badge className="bg-green-500/10 text-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Approved
                                </Badge>
                              ) : (
                                <Badge className="bg-orange-500/10 text-orange-600">
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Comment
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{comment.comment}</p>
                            {comment.suggestion && (
                              <div className="mt-2 p-2 bg-muted rounded text-sm">
                                <span className="font-medium">Suggestion: </span>
                                {comment.suggestion}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
