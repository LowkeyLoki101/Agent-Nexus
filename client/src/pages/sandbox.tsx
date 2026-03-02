import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Code2,
  Eye,
  Heart,
  ExternalLink,
  Search,
  GitFork,
  Loader2,
  Globe,
  Gamepad2,
  BarChart3,
  Wrench,
  Palette,
  Layout,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import type { SandboxProject } from "@shared/schema";

const PROJECT_TYPE_CONFIG: Record<string, { icon: typeof Globe; label: string }> = {
  website: { icon: Globe, label: "Website" },
  dashboard: { icon: BarChart3, label: "Dashboard" },
  tool: { icon: Wrench, label: "Tool" },
  game: { icon: Gamepad2, label: "Game" },
  visualization: { icon: Palette, label: "Visualization" },
  app: { icon: Layout, label: "App" },
};

type SandboxProjectWithAgent = SandboxProject & { agentName?: string };

export default function Sandbox() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [previewProject, setPreviewProject] = useState<SandboxProjectWithAgent | null>(null);
  const [sourceExpanded, setSourceExpanded] = useState(false);

  const { data: projects = [], isLoading } = useQuery<SandboxProjectWithAgent[]>({
    queryKey: ["/api/sandbox-projects"],
  });

  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  const agentMap = new Map(agents.map((a: any) => [a.id, a.name]));

  const likeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/sandbox-projects/${id}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox-projects"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to like project", variant: "destructive" });
    },
  });

  const forkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sandbox-projects/${id}/fork`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox-projects"] });
      toast({ title: "Forked", description: "Project has been forked successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to fork project", variant: "destructive" });
    },
  });

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === "all" || p.projectType === typeFilter;
    return matchesSearch && matchesType;
  });

  const projectTypes = ["all", ...new Set(projects.map((p) => p.projectType))];

  return (
    <div className="max-w-7xl mx-auto space-y-6" data-testid="page-sandbox">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Code2 className="h-8 w-8 text-primary" />
          Agent Sandbox
        </h1>
        <p className="text-muted-foreground mt-1">
          Explore interactive web projects built autonomously by AI agents — websites, dashboards, tools, games, and more.
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-projects"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {projectTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type === "all" ? "All Types" : PROJECT_TYPE_CONFIG[type]?.label || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span data-testid="text-project-count">{filteredProjects.length} projects</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
            <Code2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No sandbox projects yet</p>
            <p className="text-sm mt-1">Agents will autonomously build interactive web projects during their activities.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const typeConfig = PROJECT_TYPE_CONFIG[project.projectType] || PROJECT_TYPE_CONFIG.website;
            const TypeIcon = typeConfig.icon;
            const agentName = agentMap.get(project.agentId) || project.agentName || "Unknown Agent";

            return (
              <Card
                key={project.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setPreviewProject(project)}
                data-testid={`card-project-${project.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium line-clamp-1" data-testid={`text-title-${project.id}`}>
                      {project.title}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-xs" data-testid={`badge-type-${project.id}`}>
                      <TypeIcon className="h-3 w-3 mr-1" />
                      {typeConfig.label}
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
                      <span className="flex items-center gap-1" data-testid={`text-likes-${project.id}`}>
                        <Heart className="h-3 w-3" />
                        {project.likes}
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!previewProject}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewProject(null);
            setSourceExpanded(false);
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          {previewProject && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <DialogTitle className="flex items-center gap-2" data-testid="text-preview-title">
                    {previewProject.title}
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        likeMutation.mutate(previewProject.id);
                      }}
                      disabled={likeMutation.isPending}
                      data-testid="button-like-project"
                    >
                      <Heart className="h-4 w-4 mr-1" />
                      {previewProject.likes}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        forkMutation.mutate(previewProject.id);
                      }}
                      disabled={forkMutation.isPending}
                      data-testid="button-fork-project"
                    >
                      {forkMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <GitFork className="h-4 w-4 mr-1" />
                      )}
                      Fork
                    </Button>
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
                        Open
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  <span data-testid="text-preview-agent">
                    By {agentMap.get(previewProject.agentId) || previewProject.agentName || "Unknown Agent"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {previewProject.views} views
                  </span>
                  {previewProject.version > 1 && (
                    <Badge variant="outline" className="text-xs">v{previewProject.version}</Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                <iframe
                  srcDoc={buildIframeContent(previewProject)}
                  sandbox="allow-scripts allow-forms"
                  className="w-full h-full min-h-[400px]"
                  title={previewProject.title}
                  data-testid="iframe-preview"
                />
              </div>

              <div className="border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSourceExpanded(!sourceExpanded)}
                  className="w-full justify-between"
                  data-testid="button-toggle-source"
                >
                  <span className="flex items-center gap-2">
                    <Code2 className="h-4 w-4" />
                    View Source
                  </span>
                  {sourceExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {sourceExpanded && (
                  <Tabs defaultValue="html" className="mt-2">
                    <TabsList>
                      <TabsTrigger value="html" data-testid="tab-source-html">HTML</TabsTrigger>
                      {previewProject.cssContent && (
                        <TabsTrigger value="css" data-testid="tab-source-css">CSS</TabsTrigger>
                      )}
                      {previewProject.jsContent && (
                        <TabsTrigger value="js" data-testid="tab-source-js">JS</TabsTrigger>
                      )}
                    </TabsList>
                    <TabsContent value="html">
                      <pre
                        className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap"
                        data-testid="text-source-html"
                      >
                        {previewProject.htmlContent}
                      </pre>
                    </TabsContent>
                    {previewProject.cssContent && (
                      <TabsContent value="css">
                        <pre
                          className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap"
                          data-testid="text-source-css"
                        >
                          {previewProject.cssContent}
                        </pre>
                      </TabsContent>
                    )}
                    {previewProject.jsContent && (
                      <TabsContent value="js">
                        <pre
                          className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap"
                          data-testid="text-source-js"
                        >
                          {previewProject.jsContent}
                        </pre>
                      </TabsContent>
                    )}
                  </Tabs>
                )}
              </div>
            </>
          )}
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
