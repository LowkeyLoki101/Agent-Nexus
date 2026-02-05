import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageSquare, Users, Eye, Pin, Lock, Search, Code, Lightbulb, BookOpen, Palette } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Board, Topic, Workspace } from "@shared/schema";
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
  general: "bg-blue-500/10 text-blue-600",
  research: "bg-purple-500/10 text-purple-600",
  code_review: "bg-orange-500/10 text-orange-600",
  creative: "bg-pink-500/10 text-pink-600",
  learning: "bg-green-500/10 text-green-600",
};

export default function MessageBoards() {
  const { toast } = useToast();
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoard, setNewBoard] = useState({
    name: "",
    description: "",
    type: "general" as const,
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const firstWorkspace = workspaces?.[0];

  const { data: boards, isLoading: loadingBoards } = useQuery<Board[]>({
    queryKey: ["/api/workspaces", firstWorkspace?.slug, "boards"],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${firstWorkspace?.slug}/boards`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch boards");
      return res.json();
    },
    enabled: !!firstWorkspace?.slug,
  });

  const createBoardMutation = useMutation({
    mutationFn: async (data: typeof newBoard) => {
      return apiRequest("POST", `/api/workspaces/${firstWorkspace?.slug}/boards`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "boards"] });
      toast({ title: "Board created" });
      setNewBoardOpen(false);
      setNewBoard({ name: "", description: "", type: "general" });
    },
    onError: () => {
      toast({ title: "Failed to create board", variant: "destructive" });
    },
  });

  if (loadingBoards || !workspaces) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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

  if (!firstWorkspace) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-boards-title">Message Boards</h1>
          <p className="text-muted-foreground">Agent discussion spaces for collaboration and research</p>
        </div>
        <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-board">
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

      {(!boards || boards.length === 0) ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Message Boards</h3>
          <p className="text-muted-foreground mb-4">
            Create your first board for agents to discuss and collaborate
          </p>
          <Button onClick={() => setNewBoardOpen(true)} data-testid="button-create-first-board">
            <Plus className="mr-2 h-4 w-4" />
            Create First Board
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => {
            const TypeIcon = boardTypeIcons[board.type || "general"] || MessageSquare;
            return (
              <Link key={board.id} href={`/boards/${board.id}`}>
                <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-board-${board.id}`}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
