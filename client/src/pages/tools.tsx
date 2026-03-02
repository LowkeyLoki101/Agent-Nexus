import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hammer, Plus, Play, Bot, Cpu, FileText, Code, BarChart3, Globe, Palette, Search, Loader2 } from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  generation: FileText,
  analysis: BarChart3,
  code: Code,
  data: BarChart3,
  media: Palette,
  web: Globe,
};

const CATEGORY_COLORS: Record<string, string> = {
  generation: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  analysis: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  code: "bg-green-500/10 text-green-500 border-green-500/20",
  data: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  media: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  web: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

type AgentTool = {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchema: string | null;
  outputType: string;
  executionType: string;
  codeTemplate: string | null;
  systemPrompt: string | null;
  createdByAgentId: string | null;
  isBuiltIn: boolean;
  usageCount: number;
  createdAt: string;
};

export default function Tools() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedTool, setSelectedTool] = useState<AgentTool | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [newTool, setNewTool] = useState({
    name: "",
    description: "",
    category: "generation",
    outputType: "text",
    executionType: "llm_prompt",
    systemPrompt: "",
    codeTemplate: "",
  });

  const { data: tools = [], isLoading } = useQuery<AgentTool[]>({
    queryKey: ["/api/tools"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newTool) => {
      const res = await apiRequest("POST", "/api/tools", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools"] });
      setCreateOpen(false);
      setNewTool({ name: "", description: "", category: "generation", outputType: "text", executionType: "llm_prompt", systemPrompt: "", codeTemplate: "" });
      toast({ title: "Tool created", description: "Your custom tool has been registered." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create tool", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ id, instructions }: { id: string; instructions: string }) => {
      const res = await apiRequest("POST", `/api/tools/${id}/test`, { instructions });
      return res.json();
    },
    onSuccess: (data) => {
      setTestOutput(data.output || "No output");
    },
    onError: (err: any) => {
      setTestOutput(`Error: ${err.message}`);
    },
  });

  const categories = ["all", ...new Set(tools.map(t => t.category))];

  const filteredTools = tools.filter(t => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const builtInTools = filteredTools.filter(t => t.isBuiltIn);
  const agentTools = filteredTools.filter(t => !t.isBuiltIn);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="page-tools">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Hammer className="h-8 w-8 text-primary" />
            Tool Registry
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse, create, and test tools that agents use in assembly line workflows
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-tool">
              <Plus className="h-4 w-4 mr-2" />
              Create Tool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Custom Tool</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name (snake_case)</label>
                <Input
                  value={newTool.name}
                  onChange={e => setNewTool(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="my_custom_tool"
                  data-testid="input-tool-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newTool.description}
                  onChange={e => setNewTool(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What this tool does"
                  data-testid="input-tool-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={newTool.category} onValueChange={v => setNewTool(prev => ({ ...prev, category: v }))}>
                    <SelectTrigger data-testid="select-tool-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generation">Generation</SelectItem>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="code">Code</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="web">Web</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Output Type</label>
                  <Select value={newTool.outputType} onValueChange={v => setNewTool(prev => ({ ...prev, outputType: v }))}>
                    <SelectTrigger data-testid="select-tool-output">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="code">Code</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Execution Type</label>
                <Select value={newTool.executionType} onValueChange={v => setNewTool(prev => ({ ...prev, executionType: v }))}>
                  <SelectTrigger data-testid="select-tool-execution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llm_prompt">LLM Prompt</SelectItem>
                    <SelectItem value="code_sandbox">Code Sandbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newTool.executionType === "llm_prompt" ? (
                <div>
                  <label className="text-sm font-medium">System Prompt</label>
                  <Textarea
                    value={newTool.systemPrompt}
                    onChange={e => setNewTool(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder="Specialized system prompt for this tool..."
                    rows={4}
                    data-testid="input-tool-prompt"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">Code Template (JavaScript)</label>
                  <Textarea
                    value={newTool.codeTemplate}
                    onChange={e => setNewTool(prev => ({ ...prev, codeTemplate: e.target.value }))}
                    placeholder="// Access input via `input` variable&#10;// Previous step outputs via `previousOutputs` array&#10;// Set result via `result` variable"
                    rows={6}
                    className="font-mono text-sm"
                    data-testid="input-tool-code"
                  />
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => createMutation.mutate(newTool)}
                disabled={!newTool.name || !newTool.description || createMutation.isPending}
                data-testid="button-submit-tool"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Register Tool
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-tools"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              data-testid={`button-category-${cat}`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{tools.length} total tools</span>
        <span>{builtInTools.length} built-in</span>
        <span>{agentTools.length} agent-created</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-5 w-32 bg-muted rounded" /><div className="h-4 w-48 bg-muted rounded mt-2" /></CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All ({filteredTools.length})</TabsTrigger>
            <TabsTrigger value="builtin" data-testid="tab-builtin">Built-in ({builtInTools.length})</TabsTrigger>
            <TabsTrigger value="agent" data-testid="tab-agent">Agent-Created ({agentTools.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ToolGrid tools={filteredTools} onSelect={setSelectedTool} />
          </TabsContent>
          <TabsContent value="builtin" className="mt-4">
            <ToolGrid tools={builtInTools} onSelect={setSelectedTool} />
          </TabsContent>
          <TabsContent value="agent" className="mt-4">
            {agentTools.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No agent-created tools yet. Agents will create tools autonomously during daemon activities.</p>
                </CardContent>
              </Card>
            ) : (
              <ToolGrid tools={agentTools} onSelect={setSelectedTool} />
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!selectedTool} onOpenChange={open => { if (!open) { setSelectedTool(null); setTestInput(""); setTestOutput(""); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTool && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ToolIcon category={selectedTool.category} />
                  {selectedTool.name}
                  {selectedTool.isBuiltIn ? (
                    <Badge variant="secondary" className="text-xs" data-testid="badge-builtin">built-in</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs" data-testid="badge-agent-created">
                      <Bot className="h-3 w-3 mr-1" />
                      agent-created
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-muted-foreground" data-testid="text-tool-description">{selectedTool.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Category</span>
                    <Badge className={CATEGORY_COLORS[selectedTool.category] || ""}>{selectedTool.category}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Output</span>
                    <span className="font-medium" data-testid="text-tool-output">{selectedTool.outputType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Execution</span>
                    <span className="font-medium" data-testid="text-tool-execution">{selectedTool.executionType}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Used {selectedTool.usageCount} times</span>
                  {selectedTool.createdByAgentId && (
                    <span className="text-muted-foreground">Created by agent</span>
                  )}
                </div>

                {selectedTool.systemPrompt && (
                  <div>
                    <span className="text-sm font-medium block mb-1">System Prompt</span>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-32 whitespace-pre-wrap" data-testid="text-tool-prompt">
                      {selectedTool.systemPrompt}
                    </pre>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Test Tool
                  </h3>
                  <Textarea
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    placeholder="Enter test instructions for this tool..."
                    rows={3}
                    data-testid="input-test-instructions"
                  />
                  <Button
                    className="mt-2"
                    size="sm"
                    onClick={() => testMutation.mutate({ id: selectedTool.id, instructions: testInput })}
                    disabled={!testInput || testMutation.isPending}
                    data-testid="button-run-test"
                  >
                    {testMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Test
                      </>
                    )}
                  </Button>
                  {testOutput && (
                    <div className="mt-3">
                      <span className="text-sm font-medium block mb-1">Output</span>
                      <pre className="text-sm bg-muted p-3 rounded-md overflow-x-auto max-h-64 whitespace-pre-wrap" data-testid="text-test-output">
                        {testOutput}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolIcon({ category }: { category: string }) {
  const Icon = CATEGORY_ICONS[category] || Cpu;
  return <Icon className="h-5 w-5" />;
}

function ToolGrid({ tools, onSelect }: { tools: AgentTool[]; onSelect: (t: AgentTool) => void }) {
  if (tools.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tools match your filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tools.map(tool => (
        <Card
          key={tool.id}
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onSelect(tool)}
          data-testid={`card-tool-${tool.id}`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ToolIcon category={tool.category} />
                {tool.name}
              </CardTitle>
              <div className="flex items-center gap-1">
                {tool.isBuiltIn ? (
                  <Badge variant="secondary" className="text-xs">built-in</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <Bot className="h-3 w-3 mr-1" />
                    agent
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription className="text-xs line-clamp-2">{tool.description}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[tool.category] || ""}`}>
                {tool.category}
              </Badge>
              <div className="flex items-center gap-3">
                <span>{tool.outputType}</span>
                <span>{tool.usageCount} uses</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
