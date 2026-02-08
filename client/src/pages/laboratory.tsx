import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Plus,
  FlaskConical,
  Pencil,
  Trash2,
  FileCode,
  FolderOpen,
  Rocket,
  Archive,
  HardHat,
  ClipboardCheck,
  Lightbulb,
  Bot,
  ChevronRight,
  X,
  Loader2,
  Copy,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { LabProject, Workspace, Agent } from "@shared/schema";

interface ProjectFile {
  name: string;
  content: string;
  language: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  planning: { label: "Planning", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Lightbulb },
  building: { label: "Building", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: HardHat },
  testing: { label: "Testing", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", icon: ClipboardCheck },
  launched: { label: "Launched", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: Rocket },
  archived: { label: "Archived", color: "bg-muted text-muted-foreground", icon: Archive },
};

function parseFiles(filesStr: string): ProjectFile[] {
  try {
    return JSON.parse(filesStr || "[]");
  } catch {
    return [];
  }
}

interface ProjectDetailProps {
  project: LabProject;
  agent?: Agent;
  workspaceSlug: string;
  onClose: () => void;
}

function ProjectDetail({ project, agent, workspaceSlug, onClose }: ProjectDetailProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(project.description || "");
  const [editPlatform, setEditPlatform] = useState(project.platform);
  const [editStatus, setEditStatus] = useState(project.status);

  const files = parseFiles(project.files);
  const status = statusConfig[project.status] || statusConfig.planning;
  const StatusIcon = status.icon;

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<LabProject>) => {
      return apiRequest("PATCH", `/api/lab-projects/${project.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceSlug, "lab-projects"] });
      toast({ title: "Project updated" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update project", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/lab-projects/${project.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceSlug, "lab-projects"] });
      toast({ title: "Project deleted" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to delete project", variant: "destructive" });
    },
  });

  const copyFileContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-back-projects">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-xl font-bold"
              data-testid="input-edit-project-title"
            />
          ) : (
            <h2 className="text-xl font-bold" data-testid="text-project-title">{project.title}</h2>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={status.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
          {!isEditing ? (
            <>
              <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} data-testid="button-edit-project">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate()} data-testid="button-delete-project">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditTitle(project.title);
                  setEditDescription(project.description || "");
                  setEditPlatform(project.platform);
                  setEditStatus(project.status);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateMutation.mutate({
                  title: editTitle,
                  description: editDescription,
                  platform: editPlatform,
                  status: editStatus,
                })}
                disabled={updateMutation.isPending}
                data-testid="button-save-project"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-1">Platform</div>
            {isEditing ? (
              <Select value={editPlatform} onValueChange={setEditPlatform}>
                <SelectTrigger data-testid="select-edit-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Node.js">Node.js</SelectItem>
                  <SelectItem value="React">React</SelectItem>
                  <SelectItem value="Python">Python</SelectItem>
                  <SelectItem value="API Server">API Server</SelectItem>
                  <SelectItem value="CLI Tool">CLI Tool</SelectItem>
                  <SelectItem value="Library">Library</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="font-medium" data-testid="text-project-platform">{project.platform}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-1">Version</div>
            <div className="font-medium" data-testid="text-project-version">{project.version || "0.1.0"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-1">Files</div>
            <div className="font-medium" data-testid="text-project-file-count">{files.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            {isEditing ? (
              <Select value={editStatus} onValueChange={(v: any) => setEditStatus(v)}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="building">Building</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="launched">Launched</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="font-medium capitalize" data-testid="text-project-status">{project.status}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {isEditing && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Label>Description</Label>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Project description..."
              data-testid="input-edit-project-desc"
            />
          </CardContent>
        </Card>
      )}

      {!isEditing && project.description && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground" data-testid="text-project-description">{project.description}</p>
          </CardContent>
        </Card>
      )}

      {agent && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="h-4 w-4" />
          <span>Created by <span className="font-medium text-foreground">{agent.name}</span></span>
        </div>
      )}

      {files.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">
              <FolderOpen className="h-4 w-4 inline mr-2" />
              Project Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="w-48 shrink-0 border-r pr-4">
                <ScrollArea className="h-[400px]">
                  {files.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFile(idx)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md mb-1 flex items-center gap-2 hover-elevate ${
                        selectedFile === idx ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                      }`}
                      data-testid={`button-file-${idx}`}
                    >
                      <FileCode className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
                </ScrollArea>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" data-testid="text-selected-filename">{files[selectedFile]?.name}</span>
                    <Badge variant="secondary">{files[selectedFile]?.language}</Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyFileContent(files[selectedFile]?.content || "")}
                    data-testid="button-copy-file"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="h-[370px]">
                  <pre className="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap" data-testid="text-file-content">
                    {files[selectedFile]?.content || ""}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {project.buildLog && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Build Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <pre className="text-xs font-mono bg-muted p-4 rounded-md whitespace-pre-wrap" data-testid="text-build-log">
                {project.buildLog}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {project.testResults && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <pre className="text-xs font-mono bg-muted p-4 rounded-md whitespace-pre-wrap" data-testid="text-test-results">
                {project.testResults}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {(project.tags?.length ?? 0) > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {project.tags?.map((tag, idx) => (
            <Badge key={idx} variant="outline">{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProjectCardProps {
  project: LabProject;
  agent?: Agent;
  onClick: () => void;
}

function ProjectCard({ project, agent, onClick }: ProjectCardProps) {
  const files = parseFiles(project.files);
  const status = statusConfig[project.status] || statusConfig.planning;
  const StatusIcon = status.icon;

  return (
    <Card className="hover-elevate cursor-pointer" onClick={onClick} data-testid={`card-project-${project.id}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-medium truncate">{project.title}</h3>
              <Badge className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{project.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <FileCode className="h-3 w-3" />
                {files.length} file{files.length !== 1 ? "s" : ""}
              </span>
              <span>{project.platform}</span>
              <span>v{project.version || "0.1.0"}</span>
              {agent && (
                <span className="flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  {agent.name}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Laboratory() {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<LabProject | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    platform: "Node.js",
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const agentForumWorkspace = workspaces?.find(w => w.slug === "agent-forum");
  const activeWorkspace = agentForumWorkspace || workspaces?.[0];

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agentMap = new Map<string, Agent>();
  agents?.forEach(a => agentMap.set(a.id, a));

  const { data: projects, isLoading } = useQuery<LabProject[]>({
    queryKey: ["/api/workspaces", activeWorkspace?.slug, "lab-projects"],
    enabled: !!activeWorkspace?.slug,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newProject) => {
      if (!activeWorkspace) throw new Error("No workspace");
      return apiRequest("POST", `/api/workspaces/${activeWorkspace.slug}/lab-projects`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", activeWorkspace?.slug, "lab-projects"] });
      toast({ title: "Project created" });
      setNewProjectOpen(false);
      setNewProject({ title: "", description: "", platform: "Node.js" });
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const filtered = statusFilter === "all"
    ? projects || []
    : projects?.filter(p => p.status === statusFilter) || [];

  const statusCounts = {
    planning: projects?.filter(p => p.status === "planning").length || 0,
    building: projects?.filter(p => p.status === "building").length || 0,
    testing: projects?.filter(p => p.status === "testing").length || 0,
    launched: projects?.filter(p => p.status === "launched").length || 0,
    archived: projects?.filter(p => p.status === "archived").length || 0,
  };

  if (selectedProject) {
    const fresh = projects?.find(p => p.id === selectedProject.id) || selectedProject;
    return (
      <ScrollArea className="h-full">
        <div className="p-6">
          <ProjectDetail
            project={fresh}
            agent={fresh.createdByAgentId ? agentMap.get(fresh.createdByAgentId) : undefined}
            workspaceSlug={activeWorkspace?.slug || ""}
            onClose={() => setSelectedProject(null)}
          />
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-lab-title">Laboratory</h1>
            <p className="text-muted-foreground">Multi-file projects built by agents through the full dev lifecycle</p>
          </div>
          <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-project">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Lab Project</DialogTitle>
                <DialogDescription>Start a new multi-file project for agents to build</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newProject.title}
                    onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Project name"
                    data-testid="input-new-project-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What should this project do?"
                    data-testid="input-new-project-desc"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select
                    value={newProject.platform}
                    onValueChange={(v) => setNewProject(prev => ({ ...prev, platform: v }))}
                  >
                    <SelectTrigger data-testid="select-new-project-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Node.js">Node.js</SelectItem>
                      <SelectItem value="React">React</SelectItem>
                      <SelectItem value="Python">Python</SelectItem>
                      <SelectItem value="API Server">API Server</SelectItem>
                      <SelectItem value="CLI Tool">CLI Tool</SelectItem>
                      <SelectItem value="Library">Library</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewProjectOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createMutation.mutate(newProject)}
                  disabled={!newProject.title || createMutation.isPending}
                  data-testid="button-save-new-project"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Project"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {Object.entries(statusConfig).map(([key, config]) => {
            const Icon = config.icon;
            const count = statusCounts[key as keyof typeof statusCounts] || 0;
            const isActive = statusFilter === key;
            return (
              <Card
                key={key}
                className={`cursor-pointer hover-elevate ${isActive ? "ring-2 ring-primary" : ""}`}
                onClick={() => setStatusFilter(isActive ? "all" : key)}
                data-testid={`card-filter-${key}`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground capitalize">{config.label}</div>
                    </div>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {statusFilter !== "all" && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">{statusFilter}</Badge>
            <Button size="icon" variant="ghost" onClick={() => setStatusFilter("all")} data-testid="button-clear-filter">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FlaskConical className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Agents will build multi-file projects when the factory runs, or create one manually
              </p>
              <Button onClick={() => setNewProjectOpen(true)} data-testid="button-create-first-project">
                <Plus className="h-4 w-4 mr-2" />
                Create First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                agent={project.createdByAgentId ? agentMap.get(project.createdByAgentId) : undefined}
                onClick={() => setSelectedProject(project)}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
