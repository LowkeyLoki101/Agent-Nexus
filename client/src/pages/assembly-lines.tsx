import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { AssemblyLine, AssemblyLineStep, Agent, Product } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Factory, ArrowRight, CheckCircle2, Clock, Loader2,
  AlertCircle, Play, Pause, Trash2, Settings, Bot, Wrench, X,
  ChevronDown, ChevronRight, Package,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const DEPARTMENT_ROOMS = [
  { id: "research-lab", name: "Research Lab" },
  { id: "code-workshop", name: "Code Workshop" },
  { id: "design-studio", name: "Design Studio" },
  { id: "strategy-room", name: "Strategy Room" },
  { id: "comms-center", name: "Comms Center" },
  { id: "break-room", name: "Break Room" },
];

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-gray-500" },
  in_progress: { label: "Running", color: "text-blue-500" },
  completed: { label: "Done", color: "text-green-500" },
  failed: { label: "Failed", color: "text-red-500" },
  skipped: { label: "Skipped", color: "text-gray-400" },
};

const LINE_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  paused: { label: "Paused", variant: "outline" },
  completed: { label: "Completed", variant: "default" },
};

function CreateAssemblyLineDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/assembly-lines", { name, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assembly-lines"] });
      setOpen(false);
      setName("");
      setDescription("");
      toast({ title: "Assembly line created" });
    },
    onError: () => { toast({ title: "Failed to create assembly line", variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-assembly-line">
          <Plus className="h-4 w-4" />
          New Assembly Line
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-create-assembly-line">
        <DialogHeader>
          <DialogTitle>Create Assembly Line</DialogTitle>
          <DialogDescription>
            Define a multi-department pipeline that combines work from different rooms to produce a final product.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Landing Page Redesign Pipeline" data-testid="input-line-name" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what this assembly line produces..." data-testid="input-line-description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} data-testid="button-confirm-create-line">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStepDialog({ assemblyLineId, stepCount }: { assemblyLineId: string; stepCount: number }) {
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState("");
  const [toolName, setToolName] = useState("");
  const [instructions, setInstructions] = useState("");
  const { toast } = useToast();
  const { data: agents } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const [agentId, setAgentId] = useState("");

  const createStep = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/assembly-lines/${assemblyLineId}/steps`, {
        stepOrder: stepCount + 1,
        departmentRoom: room,
        toolName: toolName || undefined,
        assignedAgentId: agentId || undefined,
        instructions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assembly-lines", assemblyLineId, "steps"] });
      setOpen(false);
      setRoom(""); setToolName(""); setInstructions(""); setAgentId("");
      toast({ title: "Step added" });
    },
    onError: () => { toast({ title: "Failed to add step", variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs" data-testid={`button-add-step-${assemblyLineId}`}>
          <Plus className="h-3 w-3" /> Add Step
        </Button>
      </DialogTrigger>
      <DialogContent data-testid={`dialog-add-step-${assemblyLineId}`}>
        <DialogHeader>
          <DialogTitle>Add Pipeline Step</DialogTitle>
          <DialogDescription>Add a new step to the assembly line. Steps run in order through departments.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Department Room</label>
            <Select value={room} onValueChange={setRoom}>
              <SelectTrigger data-testid="select-step-room"><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENT_ROOMS.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Tool Name (optional)</label>
            <Input value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="e.g., Web Scraper, Code Generator" data-testid="input-step-tool" />
          </div>
          <div>
            <label className="text-sm font-medium">Assign Agent (optional)</label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger data-testid="select-step-agent"><SelectValue placeholder="Auto-assign" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-assign</SelectItem>
                {(agents || []).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Instructions</label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What should happen at this step?" data-testid="input-step-instructions" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => createStep.mutate()} disabled={!room || createStep.isPending} data-testid="button-confirm-add-step">
            {createStep.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateProductDialog({ assemblyLineId, assemblyLineName }: { assemblyLineId: string; assemblyLineName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [inputRequest, setInputRequest] = useState("");
  const { toast } = useToast();

  const createProduct = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/products", { assemblyLineId, name, inputRequest, description: `Produced by ${assemblyLineName}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setOpen(false);
      setName(""); setInputRequest("");
      toast({ title: "Product request submitted" });
    },
    onError: () => { toast({ title: "Failed to create product request", variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs" data-testid={`button-produce-${assemblyLineId}`}>
          <Package className="h-3 w-3" /> Produce
        </Button>
      </DialogTrigger>
      <DialogContent data-testid={`dialog-produce-${assemblyLineId}`}>
        <DialogHeader>
          <DialogTitle>Submit Production Request</DialogTitle>
          <DialogDescription>Submit an input to the "{assemblyLineName}" assembly line to produce a product.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Product Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., New Landing Page v2" data-testid="input-product-name" />
          </div>
          <div>
            <label className="text-sm font-medium">Input Request</label>
            <Textarea value={inputRequest} onChange={(e) => setInputRequest(e.target.value)} placeholder="Describe what you want the assembly line to produce..." rows={4} data-testid="input-product-request" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => createProduct.mutate()} disabled={!name.trim() || createProduct.isPending} data-testid="button-confirm-produce">
            {createProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssemblyLineCard({ line }: { line: AssemblyLine }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const statusConfig = LINE_STATUS_CONFIG[line.status] || LINE_STATUS_CONFIG.draft;

  const { data: steps } = useQuery<AssemblyLineStep[]>({
    queryKey: ["/api/assembly-lines", line.id, "steps"],
    queryFn: () => fetch(`/api/assembly-lines/${line.id}/steps`, { credentials: "include" }).then(r => r.json()),
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/assembly-lines/${line.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assembly-lines"] });
      toast({ title: "Assembly line deleted" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/assembly-lines/${line.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assembly-lines"] });
    },
  });

  return (
    <Card className="hover:border-primary/30 transition-all" data-testid={`card-assembly-line-${line.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Factory className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2" data-testid={`text-line-name-${line.id}`}>
                {line.name}
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              {line.description && <CardDescription className="text-xs mt-0.5">{line.description}</CardDescription>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig.variant} className="text-[10px]">{statusConfig.label}</Badge>
            <CreateProductDialog assemblyLineId={line.id} assemblyLineName={line.name} />
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pipeline Steps</p>
            <div className="flex gap-1">
              <AddStepDialog assemblyLineId={line.id} stepCount={(steps || []).length} />
              {line.status === "draft" && (
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => updateStatus.mutate("active")} data-testid={`button-activate-${line.id}`}>
                  <Play className="h-3 w-3" /> Activate
                </Button>
              )}
              {line.status === "active" && (
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => updateStatus.mutate("paused")} data-testid={`button-pause-${line.id}`}>
                  <Pause className="h-3 w-3" /> Pause
                </Button>
              )}
            </div>
          </div>

          {(!steps || steps.length === 0) && (
            <div className="text-center py-6 border rounded-lg border-dashed">
              <Settings className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No steps yet. Add steps to define the pipeline.</p>
            </div>
          )}

          {steps && steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((step, idx) => {
                const stepStatus = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending;
                return (
                  <div key={step.id} className="flex items-center gap-2" data-testid={`step-${step.id}`}>
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                      step.status === "completed" ? "bg-green-500/10 border-green-500 text-green-500" :
                      step.status === "in_progress" ? "bg-blue-500/10 border-blue-500 text-blue-500" :
                      "bg-muted border-muted-foreground/20 text-muted-foreground"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0 rounded-lg border p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium">{DEPARTMENT_ROOMS.find(d => d.id === step.departmentRoom)?.name || step.departmentRoom}</span>
                          {step.toolName && <Badge variant="outline" className="text-[10px] gap-0.5"><Wrench className="h-2 w-2" />{step.toolName}</Badge>}
                        </div>
                        <span className={`text-[10px] ${stepStatus.color}`}>{stepStatus.label}</span>
                      </div>
                      {step.instructions && <p className="text-[10px] text-muted-foreground mt-1 truncate">{step.instructions}</p>}
                      {step.output && <p className="text-[10px] text-green-600 mt-1 truncate">Output: {step.output}</p>}
                    </div>
                    {idx < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="ghost" size="sm" className="text-xs text-destructive gap-1" onClick={() => deleteMutation.mutate()} data-testid={`button-delete-line-${line.id}`}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function AssemblyLines() {
  const { data: lines, isLoading } = useQuery<AssemblyLine[]>({ queryKey: ["/api/assembly-lines"] });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-assembly-lines-title">Assembly Lines</h1>
          <p className="text-muted-foreground text-sm">
            Multi-department pipelines that combine work to produce final products
          </p>
        </div>
        <CreateAssemblyLineDialog />
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[120px]" />)}
        </div>
      )}

      {!isLoading && (!lines || lines.length === 0) && (
        <Card className="p-12 text-center">
          <Factory className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-medium text-lg" data-testid="text-no-assembly-lines">No assembly lines yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Create an assembly line to define a multi-step pipeline. Each step uses a department room and tool to transform input into a final product.
          </p>
        </Card>
      )}

      {!isLoading && lines && lines.length > 0 && (
        <div className="space-y-4">
          {lines.map(line => (
            <AssemblyLineCard key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  );
}
