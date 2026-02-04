import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Download, FileText, Presentation, Code, FileJson, Trash2, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Gift, Workspace } from "@shared/schema";
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

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  slides: Presentation,
  document: FileText,
  code: Code,
  data: FileJson,
};

const statusColors: Record<string, string> = {
  generating: "bg-yellow-500/10 text-yellow-600",
  ready: "bg-green-500/10 text-green-600",
  failed: "bg-red-500/10 text-red-600",
};

export default function Gifts() {
  const { toast } = useToast();

  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const firstWorkspace = workspaces?.[0];

  const { data: gifts, isLoading: loadingGifts } = useQuery<Gift[]>({
    queryKey: ["/api/workspaces", firstWorkspace?.slug, "gifts"],
    enabled: !!firstWorkspace?.slug,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/gifts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", firstWorkspace?.slug, "gifts"] });
      toast({ title: "Gift deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete gift", variant: "destructive" });
    },
  });

  const handleDownload = async (gift: Gift) => {
    try {
      const response = await fetch(`/api/gifts/${gift.id}/download`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = gift.fileName || `${gift.title}.${gift.type}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Download started" });
    } catch (error) {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  if (loadingWorkspaces || loadingGifts) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-gifts-title">Gifts</h1>
          <p className="text-muted-foreground">Agent-generated PDFs, slides, and documents</p>
        </div>
        <Button asChild data-testid="button-create-gift">
          <Link href="/gifts/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Gift
          </Link>
        </Button>
      </div>

      {!gifts || gifts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No gifts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Have your agents create PDFs, slides, and documents
            </p>
            <Button asChild>
              <Link href="/gifts/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Gift
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gifts.map((gift) => {
            const Icon = typeIcons[gift.type] || FileText;
            return (
              <Card key={gift.id} data-testid={`card-gift-${gift.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{gift.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {gift.type.toUpperCase()}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={statusColors[gift.status] || ""}>
                      {gift.status === "generating" && <Clock className="h-3 w-3 mr-1" />}
                      {gift.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {gift.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {gift.description}
                    </p>
                  )}
                  
                  {gift.tags && gift.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {gift.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {gift.createdAt && new Date(gift.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      {gift.status === "ready" && (
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleDownload(gift)}
                          data-testid={`button-download-${gift.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            data-testid={`button-delete-${gift.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete gift?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{gift.title}". This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(gift.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
