import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Share2, Send, Save } from "lucide-react";
import { Link } from "wouter";
import type { Workspace, Agent } from "@shared/schema";

const PLATFORMS = [
  { id: "twitter", label: "Twitter / X", color: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300" },
  { id: "facebook", label: "Facebook", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { id: "instagram", label: "Instagram", color: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
  { id: "linkedin", label: "LinkedIn", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
] as const;

export default function SocialPostNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [content, setContent] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [agentId, setAgentId] = useState<string>("");

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const workspaceAgents = agents?.filter((a) => a.workspaceId === workspaceId && a.isActive);

  const togglePlatform = (platformId: string) => {
    setPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const createMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      platforms: string[];
      workspaceId: string;
      status: string;
      agentId?: string | null;
    }) => {
      return apiRequest("POST", "/api/social-posts", data);
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({
        title: variables.status === "draft" ? "Draft saved" : "Post created",
        description:
          variables.status === "draft"
            ? "Your draft has been saved. You can publish it later."
            : "Your post has been created and is ready to publish.",
      });
      setLocation("/social-posts");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  const createAndPublishMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      platforms: string[];
      workspaceId: string;
      agentId?: string | null;
    }) => {
      // First create as draft, then immediately publish
      const res = await apiRequest("POST", "/api/social-posts", {
        ...data,
        status: "draft",
      });
      const post = await res.json();
      return apiRequest("POST", `/api/social-posts/${post.id}/publish`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-posts"] });
      toast({
        title: "Published!",
        description: "Your post has been published to the selected platforms.",
      });
      setLocation("/social-posts");
    },
    onError: (error: Error) => {
      toast({
        title: "Publish failed",
        description: error.message || "Failed to publish post",
        variant: "destructive",
      });
    },
  });

  const validate = (): boolean => {
    if (!content.trim()) {
      toast({ title: "Validation error", description: "Post content is required", variant: "destructive" });
      return false;
    }
    if (platforms.length === 0) {
      toast({ title: "Validation error", description: "Select at least one platform", variant: "destructive" });
      return false;
    }
    if (!workspaceId) {
      toast({ title: "Validation error", description: "Select a studio", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      content,
      platforms,
      workspaceId,
      status: "draft",
      agentId: agentId || null,
    });
  };

  const handlePublishNow = () => {
    if (!validate()) return;
    createAndPublishMutation.mutate({
      content,
      platforms,
      workspaceId,
      agentId: agentId || null,
    });
  };

  const isPending = createMutation.isPending || createAndPublishMutation.isPending;
  const charCount = content.length;
  const twitterLimit = platforms.includes("twitter") && charCount > 280;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/social-posts">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-new-social-post-title">
            New Social Post
          </h1>
          <p className="text-muted-foreground">
            Draft or publish a post across multiple platforms
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Share2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Compose Post</CardTitle>
              <CardDescription>
                Write once, publish everywhere. Agents can also automate this.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveDraft} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="workspace">Studio</Label>
              <Select value={workspaceId} onValueChange={(val) => { setWorkspaceId(val); setAgentId(""); }}>
                <SelectTrigger data-testid="select-workspace">
                  <SelectValue placeholder="Select a studio" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces?.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="grid grid-cols-2 gap-3">
                {PLATFORMS.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      platforms.includes(p.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={platforms.includes(p.id)}
                      onCheckedChange={() => togglePlatform(p.id)}
                      data-testid={`checkbox-${p.id}`}
                    />
                    <Badge className={`text-xs ${p.color}`} variant="outline">
                      {p.label}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">Post Content</Label>
                <span className={`text-xs ${twitterLimit ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  {charCount} chars
                  {twitterLimit && " (exceeds Twitter 280 limit)"}
                </span>
              </div>
              <Textarea
                id="content"
                placeholder="What's on your mind? Write your post here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="resize-none"
                data-testid="input-social-content"
              />
            </div>

            {workspaceId && workspaceAgents && workspaceAgents.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="agent">Assign Agent (optional)</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger data-testid="select-agent">
                    <SelectValue placeholder="No agent – manual post" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No agent – manual post</SelectItem>
                    {workspaceAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assigning an agent tracks which agent created or automated this post.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Link href="/social-posts">
                <Button type="button" variant="outline" data-testid="button-cancel">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                variant="secondary"
                disabled={isPending}
                className="gap-2"
                data-testid="button-save-draft"
              >
                <Save className="h-4 w-4" />
                {createMutation.isPending ? "Saving..." : "Save as Draft"}
              </Button>
              <Button
                type="button"
                onClick={handlePublishNow}
                disabled={isPending}
                className="gap-2"
                data-testid="button-publish-now"
              >
                <Send className="h-4 w-4" />
                {createAndPublishMutation.isPending ? "Publishing..." : "Publish Now"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
