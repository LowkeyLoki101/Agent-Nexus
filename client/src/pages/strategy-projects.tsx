import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Globe,
  Eye,
  Search,
  Loader2,
  Plus,
  Star,
  ExternalLink,
  X,
  BarChart3,
} from "lucide-react";
import type { SandboxProject, AssemblyLine } from "@shared/schema";

type SandboxProjectWithAgent = SandboxProject & { agentName?: string };

export default function StrategyProjects() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [previewProject, setPreviewProject] = useState<SandboxProjectWithAgent | null>(null);
  const [showProflowDemo, setShowProflowDemo] = useState(false);

  const { data: projects = [], isLoading } = useQuery<SandboxProjectWithAgent[]>({
    queryKey: ["/api/sandbox-projects"],
  });

  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  const { data: assemblyLines = [] } = useQuery<AssemblyLine[]>({
    queryKey: ["/api/assembly-lines"],
  });

  const agentMap = new Map(agents.map((a: any) => [a.id, a.name]));

  const strategyLine = assemblyLines.find(
    (line) => line.name === "Strategy Intelligence Factory"
  );

  const commissionMutation = useMutation({
    mutationFn: async (topic: string) => {
      if (!strategyLine) throw new Error("Strategy Intelligence Factory assembly line not found");
      const res = await apiRequest("POST", "/api/products", {
        assemblyLineId: strategyLine.id,
        name: `Strategy Report: ${topic}`,
        description: `Executive strategy intelligence report on: ${topic}`,
        inputRequest: `Research and produce a comprehensive strategy command center for: ${topic}. The target audience is C-suite executives and VP-level decision makers.`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Commissioned", description: "Strategy report has been queued for production." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to commission report", variant: "destructive" });
    },
  });

  const strategyProjects = projects.filter(
    (p) => p.projectType === "strategy_website"
  );

  const filteredProjects = strategyProjects.filter((p) => {
    if (!searchQuery) return true;
    return (
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleCommission = () => {
    const topic = prompt("Enter a market or topic for the strategy report:");
    if (topic && topic.trim()) {
      commissionMutation.mutate(topic.trim());
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6" data-testid="page-strategy-projects">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-8 w-8 text-primary" />
            Strategy Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            Executive-grade interactive strategy websites produced by the AI factory pipeline.
          </p>
        </div>
        <Button
          onClick={handleCommission}
          disabled={commissionMutation.isPending || !strategyLine}
          data-testid="button-commission-report"
        >
          {commissionMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Commission Strategy Report
        </Button>
      </div>

      <Card
        className="cursor-pointer hover-elevate"
        onClick={() => setShowProflowDemo(true)}
        data-testid="card-proflow-featured"
      >
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex items-center justify-center h-14 w-14 rounded-md bg-primary/10 shrink-0">
            <Star className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold" data-testid="text-featured-title">
                ProFlow Command Center
              </h3>
              <Badge variant="default" data-testid="badge-featured">Featured</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-featured-description">
              Cracking the Texas Hyperscale Data Center market — full executive strategy briefing with video, audio, verified signals, decision-chain explorer, and 90-day execution planner.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" data-testid="button-view-proflow">
            <ExternalLink className="h-4 w-4 mr-1" />
            View Demo
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search strategy projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-projects"
          />
        </div>
        <span className="text-sm text-muted-foreground" data-testid="text-project-count">
          {filteredProjects.length} {filteredProjects.length === 1 ? "project" : "projects"}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No strategy projects yet</p>
            <p className="text-sm mt-1">
              Commission a new strategy report or wait for agents to produce them autonomously.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const agentName = agentMap.get(project.agentId) || project.agentName || "Unknown Agent";

            return (
              <Card
                key={project.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setPreviewProject(project)}
                data-testid={`card-strategy-${project.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium line-clamp-1" data-testid={`text-title-${project.id}`}>
                      {project.title}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs" data-testid={`badge-type-${project.id}`}>
                      <Globe className="h-3 w-3 mr-1" />
                      Strategy
                    </Badge>
                  </div>
                  <CardDescription className="text-xs line-clamp-2" data-testid={`text-description-${project.id}`}>
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate" data-testid={`text-agent-${project.id}`}>{agentName}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center gap-1" data-testid={`text-views-${project.id}`}>
                        <Eye className="h-3 w-3" />
                        {project.views}
                      </span>
                    </div>
                  </div>
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {project.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {project.createdAt && (
                    <p className="text-xs text-muted-foreground mt-2" data-testid={`text-date-${project.id}`}>
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!previewProject}
        onOpenChange={(open) => {
          if (!open) setPreviewProject(null);
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          {previewProject && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <DialogTitle className="flex items-center gap-2" data-testid="text-preview-title">
                    {previewProject.title}
                  </DialogTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    data-testid="button-open-new-tab"
                  >
                    <a
                      href={`/sandbox/projects/${previewProject.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open Full Screen
                    </a>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-preview-agent">
                  By {agentMap.get(previewProject.agentId) || previewProject.agentName || "Unknown Agent"}
                  {previewProject.createdAt && ` — ${new Date(previewProject.createdAt).toLocaleDateString()}`}
                </p>
              </DialogHeader>

              <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                <iframe
                  srcDoc={buildIframeContent(previewProject)}
                  sandbox="allow-scripts allow-forms"
                  className="w-full h-full min-h-[500px]"
                  title={previewProject.title}
                  data-testid="iframe-preview"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showProflowDemo}
        onOpenChange={(open) => {
          if (!open) setShowProflowDemo(false);
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <DialogTitle data-testid="text-proflow-title">ProFlow Command Center</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                asChild
                data-testid="button-open-proflow-tab"
              >
                <a
                  href="/proflow-demo/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open Full Screen
                </a>
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
            <iframe
              src="/proflow-demo/"
              sandbox="allow-scripts allow-forms allow-same-origin"
              className="w-full h-full min-h-[500px]"
              title="ProFlow Command Center Demo"
              data-testid="iframe-proflow-demo"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildIframeContent(project: SandboxProject): string {
  let html = project.htmlContent;

  if (project.cssContent && !html.includes("<style")) {
    html = html.replace("</head>", `<style>${project.cssContent}</style></head>`);
    if (!html.includes("</head>")) {
      html = `<style>${project.cssContent}</style>${html}`;
    }
  }

  if (project.jsContent && !html.includes("<script")) {
    html = html.replace("</body>", `<script>${project.jsContent}</script></body>`);
    if (!html.includes("</body>")) {
      html = `${html}<script>${project.jsContent}</script>`;
    }
  }

  return html;
}
