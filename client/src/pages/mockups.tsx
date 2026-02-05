import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Palette, Eye, Code, Trash2, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mockup, Workspace } from "@shared/schema";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusColors: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-600",
  published: "bg-green-500/10 text-green-600",
  archived: "bg-gray-500/10 text-gray-600",
};

export default function Mockups() {
  const { toast } = useToast();
  const [newMockupOpen, setNewMockupOpen] = useState(false);
  const [previewMockup, setPreviewMockup] = useState<Mockup | null>(null);
  const [newMockup, setNewMockup] = useState({
    title: "",
    description: "",
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #E5A824; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; }
    .button { display: inline-block; padding: 12px 24px; background: #E5A824; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to CB | CREATIVES</h1>
    <p>This is a mockup created by an autonomous agent. Edit the HTML, CSS, and JavaScript to design landing pages, flyers, and other creative content.</p>
    <a href="#" class="button">Get Started</a>
  </div>
</body>
</html>`,
    css: "",
    javascript: "",
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });
  const firstWorkspace = workspaces?.[0];

  const { data: mockups, isLoading } = useQuery<Mockup[]>({
    queryKey: ["/api/workspaces", firstWorkspace?.slug, "mockups"],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${firstWorkspace?.slug}/mockups`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch mockups");
      return res.json();
    },
    enabled: !!firstWorkspace?.slug,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newMockup) => {
      return apiRequest("POST", `/api/workspaces/${firstWorkspace?.slug}/mockups`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "mockups"] });
      toast({ title: "Mockup created" });
      setNewMockupOpen(false);
      setNewMockup({
        title: "",
        description: "",
        html: newMockup.html,
        css: "",
        javascript: "",
      });
    },
    onError: () => {
      toast({ title: "Failed to create mockup", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/mockups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "mockups"] });
      toast({ title: "Mockup deleted" });
    },
  });

  if (isLoading || !workspaces) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!firstWorkspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-mockups-title">Design Mockups</h1>
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Palette className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Studio Available</h3>
          <p className="text-muted-foreground mb-4">
            Create a studio first to start creating mockups
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
          <h1 className="text-2xl font-bold" data-testid="text-mockups-title">Design Mockups</h1>
          <p className="text-muted-foreground">HTML mockups and landing page designs created by agents</p>
        </div>
        <Dialog open={newMockupOpen} onOpenChange={setNewMockupOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-mockup">
              <Plus className="mr-2 h-4 w-4" />
              New Mockup
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Mockup</DialogTitle>
              <DialogDescription>
                Create an HTML mockup for landing pages, flyers, or other designs
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Mockup title"
                value={newMockup.title}
                onChange={(e) => setNewMockup({ ...newMockup, title: e.target.value })}
                data-testid="input-mockup-title"
              />
              <Textarea
                placeholder="Description"
                value={newMockup.description}
                onChange={(e) => setNewMockup({ ...newMockup, description: e.target.value })}
                data-testid="input-mockup-description"
              />
              <div>
                <label className="text-sm font-medium mb-2 block">HTML</label>
                <Textarea
                  placeholder="<!DOCTYPE html>..."
                  value={newMockup.html}
                  onChange={(e) => setNewMockup({ ...newMockup, html: e.target.value })}
                  className="font-mono text-sm min-h-[300px]"
                  data-testid="input-mockup-html"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate(newMockup)}
                disabled={!newMockup.title || !newMockup.html || createMutation.isPending}
                data-testid="button-submit-mockup"
              >
                Create Mockup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(!mockups || mockups.length === 0) ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Palette className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Mockups Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first HTML mockup for landing pages and designs
          </p>
          <Button onClick={() => setNewMockupOpen(true)} data-testid="button-create-first-mockup">
            <Plus className="mr-2 h-4 w-4" />
            Create First Mockup
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockups.map((mockup) => (
            <Card key={mockup.id} className="group" data-testid={`card-mockup-${mockup.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className={statusColors[mockup.status || "draft"]}>
                    {mockup.status || "draft"}
                  </Badge>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewMockup(mockup)}
                      data-testid={`button-preview-${mockup.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-${mockup.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Mockup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{mockup.title}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(mockup.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardTitle className="mt-2">{mockup.title}</CardTitle>
                <CardDescription>{mockup.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white h-32">
                  <iframe
                    srcDoc={mockup.html}
                    className="w-full h-full pointer-events-none"
                    sandbox=""
                    title={mockup.title}
                  />
                </div>
                <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Code className="h-4 w-4" />
                    HTML
                  </div>
                  <span>{new Date(mockup.createdAt!).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewMockup} onOpenChange={() => setPreviewMockup(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewMockup?.title}</DialogTitle>
            <DialogDescription>{previewMockup?.description}</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white min-h-[500px]">
            {previewMockup && (
              <iframe
                srcDoc={previewMockup.html}
                className="w-full h-[500px]"
                sandbox="allow-scripts"
                title={previewMockup.title}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewMockup(null)}>
              Close
            </Button>
            {previewMockup && (
              <Link href={`/mockups/${previewMockup.id}`}>
                <Button>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Editor
                </Button>
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
