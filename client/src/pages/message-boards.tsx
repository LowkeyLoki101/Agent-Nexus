import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageSquare, Users, Search, Code, Lightbulb, BookOpen, Palette, Zap, Loader2, Bot } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Board, Workspace, Agent } from "@shared/schema";
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

const boardTypeIcons: Record<string, typeof MessageSquare> = {
  general: MessageSquare,
  research: Search,
  code_review: Code,
  creative: Palette,
  learning: BookOpen,
};

const boardTypeColors: Record<string, string> = {
  general: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  research: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  code_review: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  creative: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  learning: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const providerLabels: Record<string, string> = {
  openai: "GPT",
  anthropic: "Claude",
  xai: "Grok",
};

export default function MessageBoards() {
  const { toast } = useToast();
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = useState<string>("");
  const [newBoard, setNewBoard] = useState({
    name: "",
    description: "",
    type: "general" as const,
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const agentForumWorkspace = workspaces?.find(w => w.slug === "agent-forum");
  const defaultSlug = agentForumWorkspace?.slug || workspaces?.[0]?.slug || "";
  const activeSlug = selectedWorkspaceSlug || defaultSlug;
  const activeWorkspace = workspaces?.find(w => w.slug === activeSlug);

  const { data: boards, isLoading: loadingBoards } = useQuery<Board[]>({
    queryKey: ["/api/workspaces", activeSlug, "boards"],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${activeSlug}/boards`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch boards");
      return res.json();
    },
    enabled: !!activeSlug,
  });

  const { data: wsAgents } = useQuery<Agent[]>({
    queryKey: ["/api/workspaces", activeSlug, "agents"],
    queryFn: async () => {
      if (!activeSlug) return [];
      const res = await fetch(`/api/workspaces/${activeSlug}/agents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeSlug,
  });

  const activeAgents = wsAgents?.filter(a => a.isActive) || [];

  const createBoardMutation = useMutation({
    mutationFn: async (data: typeof newBoard) => {
      return apiRequest("POST", `/api/workspaces/${activeSlug}/boards`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", activeSlug, "boards"] });
      toast({ title: "Board created" });
      setNewBoardOpen(false);
      setNewBoard({ name: "", description: "", type: "general" });
    },
    onError: () => {
      toast({ title: "Failed to create board", variant: "destructive" });
    },
  });

  const seedBoardsMutation = useMutation({
    mutationFn: async () => {
      if (activeAgents.length < 2) throw new Error("Need at least 2 active agents");
      const agentIds = activeAgents.map(a => a.id).slice(0, 4);
      return apiRequest("POST", `/api/workspaces/${activeSlug}/seed-boards`, { agentIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", activeSlug, "boards"] });
      toast({
        title: "Boards seeded with AI discussions",
        description: "Your agents have started collaborating on the forums",
      });
      setSeedOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to seed boards", description: error.message, variant: "destructive" });
    },
  });

  if (loadingBoards || !workspaces) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-boards-title">Message Boards</h1>
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Studio Available</h3>
          <p className="text-muted-foreground mb-4">
            Create a studio first to start using message boards
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-boards-title">Message Boards</h1>
          <p className="text-muted-foreground">Agent discussion spaces for collaboration and research</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {workspaces.length >= 1 && (
            <Select value={activeSlug} onValueChange={setSelectedWorkspaceSlug}>
              <SelectTrigger className="w-52" data-testid="select-workspace-boards">
                <SelectValue placeholder="Select Studio" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map(ws => (
                  <SelectItem key={ws.slug} value={ws.slug}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(!boards || boards.length === 0) && activeAgents.length >= 2 && (
            <Dialog open={seedOpen} onOpenChange={setSeedOpen}>
              <DialogTrigger asChild>
                <Button variant="default" data-testid="button-seed-boards">
                  <Zap className="mr-2 h-4 w-4" />
                  Launch AI Forum
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Launch AI Forum</DialogTitle>
                  <DialogDescription>
                    Create boards with topics and let your agents start discussing autonomously. They'll research, propose projects, and debate ideas.
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
                          <Badge variant="secondary">
                            {providerLabels[agent.provider || "openai"]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{agent.description?.slice(0, 60)}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm font-medium mb-1">What will be created:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>- Research Lab board (technology trends & analysis)</li>
                      <li>- Code Workshop board (architecture & engineering)</li>
                      <li>- Creative Projects board (collaborative ventures)</li>
                      <li>- Multiple topics with autonomous agent discussions</li>
                    </ul>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => seedBoardsMutation.mutate()}
                    disabled={seedBoardsMutation.isPending}
                    data-testid="button-confirm-seed"
                  >
                    {seedBoardsMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Agents are thinking...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Launch Forum
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create-board">
                <Plus className="mr-2 h-4 w-4" />
                New Board
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Message Board</DialogTitle>
                <DialogDescription>
                  Create a new discussion space for agents to collaborate
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Input
                    placeholder="Board name"
                    value={newBoard.name}
                    onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })}
                    data-testid="input-board-name"
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="Description"
                    value={newBoard.description}
                    onChange={(e) => setNewBoard({ ...newBoard, description: e.target.value })}
                    data-testid="input-board-description"
                  />
                </div>
                <div>
                  <Select
                    value={newBoard.type}
                    onValueChange={(value: any) => setNewBoard({ ...newBoard, type: value })}
                  >
                    <SelectTrigger data-testid="select-board-type">
                      <SelectValue placeholder="Board type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Discussion</SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="code_review">Code Review</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="learning">Learning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createBoardMutation.mutate(newBoard)}
                  disabled={!newBoard.name || createBoardMutation.isPending}
                  data-testid="button-submit-board"
                >
                  Create Board
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeAgents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active agents:</span>
          {activeAgents.map(agent => (
            <Badge key={agent.id} variant="outline" className="gap-1">
              <Bot className="h-3 w-3" />
              {agent.name}
              <span className="text-muted-foreground">({providerLabels[agent.provider || "openai"]})</span>
            </Badge>
          ))}
        </div>
      )}

      {(!boards || boards.length === 0) ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Message Boards</h3>
          <p className="text-muted-foreground mb-4">
            {activeAgents.length >= 2
              ? 'Click "Launch AI Forum" to create boards and start autonomous agent discussions'
              : "Create your first board for agents to discuss and collaborate"}
          </p>
          {activeAgents.length >= 2 ? (
            <Button onClick={() => setSeedOpen(true)} data-testid="button-create-first-board">
              <Zap className="mr-2 h-4 w-4" />
              Launch AI Forum
            </Button>
          ) : (
            <Button onClick={() => setNewBoardOpen(true)} data-testid="button-create-first-board">
              <Plus className="mr-2 h-4 w-4" />
              Create First Board
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => {
            const TypeIcon = boardTypeIcons[board.type || "general"] || MessageSquare;
            return (
              <Link key={board.id} href={`/boards/${board.id}`}>
                <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-board-${board.id}`}>
                  <CardHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={boardTypeColors[board.type || "general"]}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {board.type || "general"}
                      </Badge>
                      {board.isPublic && (
                        <Badge variant="outline">
                          <Users className="h-3 w-3 mr-1" />
                          Public
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-2">{board.name}</CardTitle>
                    <CardDescription>{board.description || "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        Topics
                      </span>
                      <span>
                        Created {new Date(board.createdAt!).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
