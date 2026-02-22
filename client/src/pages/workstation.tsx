import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { AgentNote, AgentFileDraft, Agent } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StickyNote, FileCode, ClipboardCheck, Plus, Trash2, Check, X, Bot, FolderOpen, Loader2 } from "lucide-react";

const DRAFT_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  ready_for_review: { label: "Ready for Review", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function NotesTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [agentId, setAgentId] = useState("");
  const [relatedPath, setRelatedPath] = useState("");

  const { data: notes, isLoading } = useQuery<AgentNote[]>({ queryKey: ["/api/agent-notes"] });
  const { data: agents } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  const createNote = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/agent-notes", {
        title,
        content,
        agentId,
        relatedPath: relatedPath || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notes"] });
      toast({ title: "Note created" });
      setShowForm(false);
      setTitle("");
      setContent("");
      setAgentId("");
      setRelatedPath("");
    },
    onError: () => {
      toast({ title: "Failed to create note", variant: "destructive" });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/agent-notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notes"] });
      toast({ title: "Note deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Agent scratch pad notes</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)} data-testid="button-new-note">
          <Plus className="h-4 w-4 mr-1" />
          New Note
        </Button>
      </div>

      {showForm && (
        <Card data-testid="card-note-form">
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="Note title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-note-title"
            />
            <textarea
              placeholder="Note content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[100px] rounded-md border bg-transparent px-3 py-2 text-sm"
              data-testid="input-note-content"
            />
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              data-testid="input-note-agent"
            >
              <option value="">Select agent...</option>
              {(agents || []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <Input
              placeholder="Related file path (optional)"
              value={relatedPath}
              onChange={(e) => setRelatedPath(e.target.value)}
              data-testid="input-note-path"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createNote.mutate()}
                disabled={!title || !content || !agentId || createNote.isPending}
                data-testid="button-save-note"
              >
                {createNote.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Note
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} data-testid="button-cancel-note">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      {!isLoading && (!notes || notes.length === 0) && (
        <Card className="p-12 text-center">
          <StickyNote className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-notes">No notes yet</p>
        </Card>
      )}

      {notes && notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => {
            const agent = (agents || []).find((a) => a.id === note.agentId);
            return (
              <Card key={note.id} data-testid={`card-note-${note.id}`}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm" data-testid={`text-note-title-${note.id}`}>{note.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{note.content}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteNote.mutate(note.id)}
                      disabled={deleteNote.isPending}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {agent && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        <span>{agent.name}</span>
                      </div>
                    )}
                    {note.relatedPath && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FolderOpen className="h-3 w-3" />
                        <span>{note.relatedPath}</span>
                      </div>
                    )}
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

function DraftsTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");

  const { data: drafts, isLoading } = useQuery<AgentFileDraft[]>({ queryKey: ["/api/agent-drafts"] });
  const { data: agents } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  const createDraft = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/agent-drafts", {
        filePath,
        content,
        description: description || undefined,
        agentId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-drafts"] });
      toast({ title: "Draft created" });
      setShowForm(false);
      setFilePath("");
      setContent("");
      setDescription("");
      setAgentId("");
    },
    onError: () => {
      toast({ title: "Failed to create draft", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">File drafts from agents</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)} data-testid="button-new-draft">
          <Plus className="h-4 w-4 mr-1" />
          New Draft
        </Button>
      </div>

      {showForm && (
        <Card data-testid="card-draft-form">
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="File path (e.g., src/index.ts)"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              data-testid="input-draft-path"
            />
            <textarea
              placeholder="File content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[150px] rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
              data-testid="input-draft-content"
            />
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-draft-description"
            />
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              data-testid="input-draft-agent"
            >
              <option value="">Select agent...</option>
              {(agents || []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createDraft.mutate()}
                disabled={!filePath || !content || !agentId || createDraft.isPending}
                data-testid="button-save-draft"
              >
                {createDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Draft
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} data-testid="button-cancel-draft">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      {!isLoading && (!drafts || drafts.length === 0) && (
        <Card className="p-12 text-center">
          <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-drafts">No drafts yet</p>
        </Card>
      )}

      {drafts && drafts.length > 0 && (
        <div className="space-y-3">
          {drafts.map((draft) => {
            const agent = (agents || []).find((a) => a.id === draft.agentId);
            const statusConfig = DRAFT_STATUS_CONFIG[draft.status] || DRAFT_STATUS_CONFIG.draft;
            const isExpanded = expandedId === draft.id;

            return (
              <Card key={draft.id} data-testid={`card-draft-${draft.id}`}>
                <CardContent className="pt-4 space-y-2">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                    data-testid={`button-expand-draft-${draft.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-mono text-sm font-medium" data-testid={`text-draft-path-${draft.id}`}>
                            {draft.filePath}
                          </span>
                        </div>
                        {draft.description && (
                          <p className="text-xs text-muted-foreground mt-1">{draft.description}</p>
                        )}
                      </div>
                      <Badge variant={statusConfig.variant} className="shrink-0 text-xs">
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-wrap">
                    {agent && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        <span>{agent.name}</span>
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <pre
                      className="rounded-md bg-zinc-950 text-zinc-100 p-4 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap break-words mt-2"
                      data-testid={`code-draft-${draft.id}`}
                    >
                      {draft.content}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewQueueTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const { data: drafts, isLoading } = useQuery<AgentFileDraft[]>({
    queryKey: ["/api/agent-drafts", "ready_for_review"],
    queryFn: async () => {
      const res = await fetch("/api/agent-drafts?status=ready_for_review", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const { data: agents } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });

  const reviewDraft = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      return apiRequest("PATCH", `/api/agent-drafts/${id}`, {
        status,
        reviewerId: user?.id || "unknown",
        reviewNotes: reviewNotes[id] || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-drafts"] });
      toast({ title: "Draft reviewed" });
    },
    onError: () => {
      toast({ title: "Failed to review draft", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Drafts pending review</p>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}

      {!isLoading && (!drafts || drafts.length === 0) && (
        <Card className="p-12 text-center">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-reviews">No drafts pending review</p>
        </Card>
      )}

      {drafts && drafts.length > 0 && (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const agent = (agents || []).find((a) => a.id === draft.agentId);

            return (
              <Card key={draft.id} data-testid={`card-review-${draft.id}`}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-medium" data-testid={`text-review-path-${draft.id}`}>
                          {draft.filePath}
                        </span>
                      </div>
                      {draft.description && (
                        <p className="text-xs text-muted-foreground mt-1">{draft.description}</p>
                      )}
                    </div>
                    {agent && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Bot className="h-3 w-3" />
                        <span>{agent.name}</span>
                      </div>
                    )}
                  </div>

                  <pre
                    className="rounded-md bg-zinc-950 text-zinc-100 p-4 text-xs font-mono overflow-auto max-h-[300px] whitespace-pre-wrap break-words"
                    data-testid={`code-review-${draft.id}`}
                  >
                    {draft.content}
                  </pre>

                  <Input
                    placeholder="Review notes (optional)"
                    value={reviewNotes[draft.id] || ""}
                    onChange={(e) =>
                      setReviewNotes((prev) => ({ ...prev, [draft.id]: e.target.value }))
                    }
                    data-testid={`input-review-notes-${draft.id}`}
                  />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => reviewDraft.mutate({ id: draft.id, status: "approved" })}
                      disabled={reviewDraft.isPending}
                      data-testid={`button-approve-${draft.id}`}
                    >
                      {reviewDraft.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => reviewDraft.mutate({ id: draft.id, status: "rejected" })}
                      disabled={reviewDraft.isPending}
                      data-testid={`button-reject-${draft.id}`}
                    >
                      {reviewDraft.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      Reject
                    </Button>
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

export default function Workstation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-workstation-title">Workstation</h1>
        <p className="text-muted-foreground text-sm">Agent scratch pad and file draft editor with review workflow</p>
      </div>

      <Tabs defaultValue="notes">
        <TabsList data-testid="tabs-workstation">
          <TabsTrigger value="notes" className="gap-1.5" data-testid="tab-notes">
            <StickyNote className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-1.5" data-testid="tab-drafts">
            <FileCode className="h-4 w-4" />
            Drafts
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5" data-testid="tab-review">
            <ClipboardCheck className="h-4 w-4" />
            Review Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <NotesTab />
        </TabsContent>
        <TabsContent value="drafts">
          <DraftsTab />
        </TabsContent>
        <TabsContent value="review">
          <ReviewQueueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
