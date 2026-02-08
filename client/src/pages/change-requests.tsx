import { useQuery, useMutation } from "@tanstack/react-query";
import { MarkdownContent } from "@/components/markdown-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Shield,
  FileCode,
  Target,
  ArrowRight,
  Rocket,
} from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChangeRequest {
  id: string;
  workspaceId: string;
  agentId: string;
  agentName: string;
  title: string;
  description: string;
  changesProposed: string;
  rationale: string;
  risks: string;
  mitigations: string;
  filesAffected: string[] | null;
  priority: string | null;
  status: string | null;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof Clock }> = {
  pending: { label: "Pending Review", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  implemented: { label: "Implemented", variant: "outline", icon: Rocket },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "text-muted-foreground" },
  medium: { label: "Medium", className: "text-amber-600 dark:text-amber-400" },
  high: { label: "High", className: "text-orange-600 dark:text-orange-400" },
  critical: { label: "Critical", className: "text-red-600 dark:text-red-400" },
};

export default function ChangeRequests() {
  const { toast } = useToast();
  const [selectedCR, setSelectedCR] = useState<ChangeRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: changeRequests, isLoading } = useQuery<ChangeRequest[]>({
    queryKey: ["/api/change-requests"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      return apiRequest("PATCH", `/api/change-requests/${id}`, { status, reviewNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-requests"] });
      setDialogOpen(false);
      setSelectedCR(null);
      setReviewNotes("");
      toast({ title: "Review submitted", description: "Change request has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update change request.", variant: "destructive" });
    },
  });

  const openDetail = (cr: ChangeRequest) => {
    setSelectedCR(cr);
    setReviewNotes(cr.reviewNotes || "");
    setDialogOpen(true);
  };

  const pendingCount = changeRequests?.filter(cr => cr.status === "pending").length || 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="page-change-requests">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <GitPullRequest className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Change Requests</h1>
          {pendingCount > 0 && (
            <Badge variant="secondary" data-testid="badge-pending-count">{pendingCount} pending</Badge>
          )}
        </div>
      </div>

      <p className="text-muted-foreground mb-6" data-testid="text-page-description">
        Agents submit proposed changes here for your review. Each request includes what they want to change, why, and what risks they've identified.
      </p>

      {(!changeRequests || changeRequests.length === 0) ? (
        <Card data-testid="card-empty-state">
          <CardContent className="py-16 text-center">
            <GitPullRequest className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Change Requests Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              When agents identify improvements or changes they want to make, they'll submit requests here for your approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="list-change-requests">
          {changeRequests.map((cr, index) => {
            const statusConfig = STATUS_CONFIG[cr.status || "pending"];
            const priorityConfig = PRIORITY_CONFIG[cr.priority || "medium"];
            const StatusIcon = statusConfig.icon;

            return (
              <Card
                key={cr.id}
                className="hover-elevate cursor-pointer"
                onClick={() => openDetail(cr)}
                data-testid={`card-change-request-${index}`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary" data-testid={`avatar-cr-agent-${index}`}>
                        {cr.agentName.split(" ").map(w => w[0]).join("").substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm" data-testid={`text-cr-title-${index}`}>{cr.title}</h3>
                        <Badge variant={statusConfig.variant} className="text-xs gap-1" data-testid={`badge-cr-status-${index}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                        <span className={`text-xs font-medium ${priorityConfig.className}`} data-testid={`text-cr-priority-${index}`}>
                          {priorityConfig.label} priority
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2" data-testid={`text-cr-agent-${index}`}>
                        Submitted by {cr.agentName} {cr.createdAt ? `on ${new Date(cr.createdAt).toLocaleDateString()}` : ""}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-cr-description-${index}`}>
                        {cr.description}
                      </p>
                      {cr.filesAffected && cr.filesAffected.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <FileCode className="h-3 w-3 text-muted-foreground shrink-0" />
                          {cr.filesAffected.slice(0, 3).map((f, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] font-mono">{f}</Badge>
                          ))}
                          {cr.filesAffected.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{cr.filesAffected.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setSelectedCR(null); } }}>
        {selectedCR && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-cr-detail">
            <DialogHeader>
              <DialogTitle className="flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {selectedCR.agentName.split(" ").map(w => w[0]).join("").substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-lg leading-tight" data-testid="text-detail-title">{selectedCR.title}</div>
                  <div className="text-sm text-muted-foreground font-normal mt-0.5">
                    by {selectedCR.agentName} {selectedCR.createdAt ? `- ${new Date(selectedCR.createdAt).toLocaleString()}` : ""}
                  </div>
                </div>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Change request details from {selectedCR.agentName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const sc = STATUS_CONFIG[selectedCR.status || "pending"];
                  const SI = sc.icon;
                  return (
                    <Badge variant={sc.variant} className="gap-1" data-testid="badge-detail-status">
                      <SI className="h-3 w-3" />
                      {sc.label}
                    </Badge>
                  );
                })()}
                <Badge variant="outline" className={PRIORITY_CONFIG[selectedCR.priority || "medium"].className} data-testid="badge-detail-priority">
                  {PRIORITY_CONFIG[selectedCR.priority || "medium"].label} Priority
                </Badge>
              </div>

              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  Description
                </h4>
                <MarkdownContent content={selectedCR.description} />
              </div>

              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  Proposed Changes
                </h4>
                <MarkdownContent content={selectedCR.changesProposed} />
              </div>

              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  Rationale
                </h4>
                <MarkdownContent content={selectedCR.rationale} />
              </div>

              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  Identified Risks
                </h4>
                <MarkdownContent content={selectedCR.risks} />
              </div>

              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Shield className="h-3.5 w-3.5 text-green-500" />
                  Mitigations
                </h4>
                <MarkdownContent content={selectedCR.mitigations} />
              </div>

              {selectedCR.filesAffected && selectedCR.filesAffected.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <FileCode className="h-3.5 w-3.5 text-primary" />
                    Files Affected
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCR.filesAffected.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-mono" data-testid={`badge-file-${i}`}>{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedCR.reviewNotes && selectedCR.status !== "pending" && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-2">Review Notes</h4>
                  <p className="text-sm text-muted-foreground" data-testid="text-review-notes">{selectedCR.reviewNotes}</p>
                  {selectedCR.reviewedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reviewed {new Date(selectedCR.reviewedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {selectedCR.status === "pending" && (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-semibold">Your Review</h4>
                  <Textarea
                    placeholder="Add review notes (optional)..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="text-sm"
                    data-testid="input-review-notes"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => reviewMutation.mutate({ id: selectedCR.id, status: "approved", notes: reviewNotes })}
                      disabled={reviewMutation.isPending}
                      className="gap-1"
                      data-testid="button-approve"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => reviewMutation.mutate({ id: selectedCR.id, status: "rejected", notes: reviewNotes })}
                      disabled={reviewMutation.isPending}
                      className="gap-1"
                      data-testid="button-reject"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {selectedCR.status === "approved" && (
                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => reviewMutation.mutate({ id: selectedCR.id, status: "implemented", notes: reviewNotes })}
                    disabled={reviewMutation.isPending}
                    className="gap-1"
                    data-testid="button-mark-implemented"
                  >
                    <Rocket className="h-4 w-4" />
                    Mark as Implemented
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
