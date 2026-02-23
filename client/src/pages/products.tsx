import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { Product, AssemblyLine, AssemblyLineStep, Workspace } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, CheckCircle2, Clock, Loader2, AlertCircle,
  Factory, Eye, Search, Play, PlayCircle, ChevronDown, ChevronUp,
  Zap, Copy, Download, FileText, FileType,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  queued: { label: "Queued", color: "text-gray-500", icon: Clock },
  in_progress: { label: "In Progress", color: "text-blue-500", icon: Loader2 },
  completed: { label: "Completed", color: "text-green-500", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-500", icon: AlertCircle },
};

function useDepartmentName() {
  const { data: workspaces } = useQuery<Workspace[]>({ queryKey: ["/api/workspaces"] });
  return (slug: string) => workspaces?.find(w => w.slug === slug)?.name || slug;
}

function StepsList({ assemblyLineId }: { assemblyLineId: string }) {
  const getDepartmentName = useDepartmentName();
  const { data: steps } = useQuery<AssemblyLineStep[]>({
    queryKey: ["/api/assembly-lines", assemblyLineId, "steps"],
    queryFn: () => fetch(`/api/assembly-lines/${assemblyLineId}/steps`, { credentials: "include" }).then(r => r.json()),
  });

  const executeMutation = useMutation({
    mutationFn: async (stepId: string) => apiRequest("POST", `/api/assembly-line-steps/${stepId}/execute`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assembly-lines", assemblyLineId, "steps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  if (!steps || steps.length === 0) return <p className="text-xs text-muted-foreground">No steps defined</p>;

  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <div className="space-y-2">
      {sorted.map(step => {
        const stepStatus = STATUS_CONFIG[step.status] || STATUS_CONFIG.queued;
        const StepIcon = stepStatus.icon;
        return (
          <div key={step.id} className="flex items-start gap-2 rounded-md bg-muted/30 p-2" data-testid={`step-${step.id}`}>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-mono text-muted-foreground w-4 text-right">{step.stepOrder}</span>
              <StepIcon className={`h-3.5 w-3.5 ${stepStatus.color} ${step.status === "in_progress" ? "animate-spin" : ""}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{getDepartmentName(step.departmentRoom)}</span>
                {step.toolName && <Badge variant="outline" className="text-[9px]">{step.toolName}</Badge>}
                <Badge variant="outline" className={`text-[9px] ${stepStatus.color}`}>{stepStatus.label}</Badge>
              </div>
              {step.instructions && <p className="text-[11px] text-muted-foreground mt-0.5">{step.instructions}</p>}
              {step.output && (
                <div className="mt-1.5 rounded bg-background border p-2 max-h-40 overflow-y-auto">
                  <p className="text-[10px] font-medium text-green-600 mb-1">Output:</p>
                  <p className="text-[11px] whitespace-pre-wrap">{step.output}</p>
                </div>
              )}
            </div>
            {(step.status === "pending" || step.status === "failed") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={() => executeMutation.mutate(step.id)}
                disabled={executeMutation.isPending}
                data-testid={`button-execute-step-${step.id}`}
              >
                {executeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Run
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function copyToClipboard(text: string, toast: any) {
  navigator.clipboard.writeText(text).then(() => {
    toast({ title: "Copied to clipboard", description: "Product output has been copied." });
  }).catch(() => {
    toast({ title: "Copy failed", variant: "destructive" });
  });
}

function saveAsText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveAsPdf(content: string, title: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(content, 170);
  let y = 35;
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 20, y);
    y += 5;
  }
  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}

function ProductCard({ product, assemblyLines }: { product: Product; assemblyLines: AssemblyLine[] }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const statusConfig = STATUS_CONFIG[product.status] || STATUS_CONFIG.queued;
  const StatusIcon = statusConfig.icon;
  const assemblyLine = assemblyLines.find(al => al.id === product.assemblyLineId);

  const runMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/products/${product.id}/run`),
    onSuccess: () => {
      toast({ title: "Pipeline started", description: `"${product.name}" is now being processed through the assembly line.` });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => {
      toast({ title: "Failed to start pipeline", variant: "destructive" });
    },
  });

  return (
    <Card className="hover:border-primary/30 transition-all" data-testid={`card-product-${product.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              product.status === "completed" ? "bg-green-500/10" : product.status === "in_progress" ? "bg-blue-500/10" : "bg-muted"
            }`}>
              <Package className={`h-5 w-5 ${statusConfig.color}`} />
            </div>
            <div>
              <CardTitle className="text-base" data-testid={`text-product-name-${product.id}`}>{product.name}</CardTitle>
              {product.description && <CardDescription className="text-xs mt-0.5">{product.description}</CardDescription>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(product.status === "queued" || product.status === "failed") && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending}
                data-testid={`button-run-product-${product.id}`}
              >
                {runMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                Run Pipeline
              </Button>
            )}
            <Badge variant={product.status === "completed" ? "default" : "outline"} className={`text-[10px] gap-1 ${statusConfig.color}`}>
              <StatusIcon className={`h-3 w-3 ${product.status === "in_progress" ? "animate-spin" : ""}`} />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {assemblyLine && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Factory className="h-3 w-3" />
            <span>Assembly Line: <span className="font-medium text-foreground">{assemblyLine.name}</span></span>
          </div>
        )}

        {product.inputRequest && (
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Input Request</p>
            <p className="text-xs">{product.inputRequest}</p>
          </div>
        )}

        {product.status === "completed" && product.finalOutput && (
          <div className="rounded-md bg-green-500/5 border border-green-500/20 p-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-green-600">Final Output</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] gap-1"
                  onClick={() => copyToClipboard(product.finalOutput!, toast)}
                  data-testid={`button-copy-output-${product.id}`}
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] gap-1"
                      data-testid={`button-save-output-${product.id}`}
                    >
                      <Download className="h-3 w-3" />
                      Save
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => saveAsText(product.finalOutput!, product.name)}
                      data-testid={`button-save-txt-${product.id}`}
                    >
                      <FileText className="h-3.5 w-3.5 mr-2" />
                      Save as .txt
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => saveAsPdf(product.finalOutput!, product.name)}
                      data-testid={`button-save-pdf-${product.id}`}
                    >
                      <FileType className="h-3.5 w-3.5 mr-2" />
                      Save as .pdf
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-[10px]"
                  onClick={() => setExpanded(!expanded)}
                  data-testid={`button-expand-output-${product.id}`}
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <p className="text-xs whitespace-pre-wrap">
              {expanded ? product.finalOutput : product.finalOutput.slice(0, 300) + (product.finalOutput.length > 300 ? "..." : "")}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t text-xs text-muted-foreground">
          <span>{product.createdAt ? new Date(product.createdAt).toLocaleDateString() : ""}</span>
          <div className="flex gap-1">
            {product.finalOutputUrl && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <a href={product.finalOutputUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-view-product-${product.id}`}>
                  <Eye className="h-3 w-3" /> View
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowSteps(!showSteps)}
              data-testid={`button-show-steps-${product.id}`}
            >
              <Zap className="h-3 w-3" />
              {showSteps ? "Hide Steps" : "Show Steps"}
            </Button>
          </div>
        </div>

        {showSteps && assemblyLine && (
          <div className="pt-2 border-t">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Pipeline Steps</p>
            <StepsList assemblyLineId={assemblyLine.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Products() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    refetchInterval: (query) => {
      const data = query.state.data as Product[] | undefined;
      return (data || []).some(p => p.status === "in_progress") ? 5000 : false;
    },
  });
  const { data: assemblyLines } = useQuery<AssemblyLine[]>({ queryKey: ["/api/assembly-lines"] });

  const runAllMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/products/run-all"),
    onSuccess: () => {
      toast({ title: "All pipelines started", description: "Queued products are now being processed through their assembly lines." });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => {
      toast({ title: "Failed to start pipelines", variant: "destructive" });
    },
  });

  const filtered = (products || []).filter(p => {
    if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const completedCount = (products || []).filter(p => p.status === "completed").length;
  const inProgressCount = (products || []).filter(p => p.status === "in_progress").length;
  const queuedCount = (products || []).filter(p => p.status === "queued").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-products-title">Products</h1>
          <p className="text-muted-foreground text-sm">
            Final outputs from your assembly lines — {completedCount} completed, {inProgressCount} in progress, {queuedCount} queued
          </p>
        </div>
        {queuedCount > 0 && (
          <Button
            onClick={() => runAllMutation.mutate()}
            disabled={runAllMutation.isPending}
            className="gap-2"
            data-testid="button-run-all-products"
          >
            {runAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run All Queued ({queuedCount})
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
            data-testid="input-search-products"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={statusFilter === null ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(null)} data-testid="button-filter-all-products">All</Button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() => setStatusFilter(statusFilter === key ? null : key)}
              data-testid={`button-filter-product-${key}`}
            >
              <cfg.icon className={`h-3 w-3 ${key === "in_progress" ? "" : ""}`} />
              {cfg.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[250px]" />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-medium text-lg" data-testid="text-no-products">No products yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create an assembly line and submit a request to produce your first product.
          </p>
        </Card>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} assemblyLines={assemblyLines || []} />
          ))}
        </div>
      )}
    </div>
  );
}
