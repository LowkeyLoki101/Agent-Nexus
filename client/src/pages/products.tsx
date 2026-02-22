import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Product, AssemblyLine } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, ArrowRight, CheckCircle2, Clock, Loader2, AlertCircle,
  Factory, Eye, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  queued: { label: "Queued", color: "text-gray-500", icon: Clock },
  in_progress: { label: "In Progress", color: "text-blue-500", icon: Loader2 },
  completed: { label: "Completed", color: "text-green-500", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-500", icon: AlertCircle },
};

function ProductCard({ product, assemblyLines }: { product: Product; assemblyLines: AssemblyLine[] }) {
  const statusConfig = STATUS_CONFIG[product.status] || STATUS_CONFIG.queued;
  const StatusIcon = statusConfig.icon;
  const assemblyLine = assemblyLines.find(al => al.id === product.assemblyLineId);

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
          <Badge variant={product.status === "completed" ? "default" : "outline"} className={`text-[10px] gap-1 ${statusConfig.color}`}>
            <StatusIcon className={`h-3 w-3 ${product.status === "in_progress" ? "animate-spin" : ""}`} />
            {statusConfig.label}
          </Badge>
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
            <p className="text-[10px] font-medium uppercase tracking-wider text-green-600 mb-1">Final Output</p>
            <p className="text-xs">{product.finalOutput.slice(0, 300)}{product.finalOutput.length > 300 ? "..." : ""}</p>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Products() {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: assemblyLines } = useQuery<AssemblyLine[]>({ queryKey: ["/api/assembly-lines"] });

  const filtered = (products || []).filter(p => {
    if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const completedCount = (products || []).filter(p => p.status === "completed").length;
  const inProgressCount = (products || []).filter(p => p.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-products-title">Products</h1>
          <p className="text-muted-foreground text-sm">
            Final outputs from your assembly lines — {completedCount} completed, {inProgressCount} in progress
          </p>
        </div>
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
