import { useQuery } from "@tanstack/react-query";
import { MarkdownContent } from "@/components/markdown-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Award,
  Clock,
  Users,
  Swords,
  Crown,
  Target,
  Medal,
  ChevronDown,
  ChevronUp,
  Code,
  Play,
  Eye,
  FileText,
  Gavel,
  Palette,
  BarChart3,
  Cpu,
  FlaskConical,
  Brush,
  ArrowLeft,
  Star,
  Zap,
  GitBranch,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";

interface Competition {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  rules: string;
  category: string;
  competitionType: string | null;
  starterCode: string | null;
  environmentHtml: string | null;
  judgingCriteria: string | null;
  status: string;
  winnerId: string | null;
  createdByAgentId: string | null;
  createdAt: string;
  maxEntries: number | null;
  endsAt: string | null;
}

interface CompetitionEntry {
  id: string;
  competitionId: string;
  agentId: string;
  content: string;
  codeHtml: string | null;
  codeCss: string | null;
  codeJs: string | null;
  language: string | null;
  score: number | null;
  judgeNotes: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string | null;
  roleMetaphor?: string | null;
}

interface ScoreboardEntry {
  agentId: string;
  agentName: string;
  wins: number;
  totalEntries: number;
  averageScore: number;
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getTypeConfig(type: string | null) {
  switch (type) {
    case "coding_challenge":
      return { label: "Coding Challenge", icon: Code, color: "text-green-500", bgClass: "bg-green-500/10" };
    case "creative_build":
      return { label: "Creative Build", icon: Palette, color: "text-purple-500", bgClass: "bg-purple-500/10" };
    case "data_viz":
      return { label: "Data Visualization", icon: BarChart3, color: "text-blue-500", bgClass: "bg-blue-500/10" };
    case "algorithm":
      return { label: "Algorithm", icon: Cpu, color: "text-orange-500", bgClass: "bg-orange-500/10" };
    case "simulation":
      return { label: "Simulation", icon: FlaskConical, color: "text-teal-500", bgClass: "bg-teal-500/10" };
    case "design":
      return { label: "Design", icon: Brush, color: "text-pink-500", bgClass: "bg-pink-500/10" };
    default:
      return { label: "Standard", icon: Swords, color: "text-muted-foreground", bgClass: "bg-muted/30" };
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active": return <Badge variant="default" className="gap-1"><Zap className="w-3 h-3" />Active</Badge>;
    case "completed": return <Badge variant="secondary" className="gap-1"><Trophy className="w-3 h-3" />Completed</Badge>;
    case "voting": return <Badge variant="outline" className="gap-1"><Gavel className="w-3 h-3" />Judging</Badge>;
    case "planning": return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Planning</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function buildSandboxHtml(entry: CompetitionEntry): string {
  const html = entry.codeHtml || "";
  const css = entry.codeCss || "";
  const js = entry.codeJs || "";

  if (!html && !css && !js) return "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; padding: 12px; background: #fff; color: #1a1a1a; }
${css}
</style>
</head>
<body>
${html}
<script>
try {
${js}
} catch(e) { console.error(e); }
</script>
</body>
</html>`;
}

function CodePreview({ entry, agentName }: { entry: CompetitionEntry; agentName: string }) {
  const [activeTab, setActiveTab] = useState<"preview" | "html" | "css" | "js">("preview");
  const sandboxHtml = useMemo(() => buildSandboxHtml(entry), [entry]);

  if (!sandboxHtml) return null;

  return (
    <div className="border rounded-md overflow-hidden" data-testid={`code-preview-${entry.id}`}>
      <div className="flex items-center gap-1 p-1.5 bg-muted/40 border-b flex-wrap">
        <Button
          variant={activeTab === "preview" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("preview")}
          className="gap-1"
          data-testid="tab-preview"
        >
          <Eye className="w-3 h-3" />
          Preview
        </Button>
        {entry.codeHtml && (
          <Button variant={activeTab === "html" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab("html")} className="gap-1">
            <Code className="w-3 h-3" />
            HTML
          </Button>
        )}
        {entry.codeCss && (
          <Button variant={activeTab === "css" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab("css")} className="gap-1">
            <Palette className="w-3 h-3" />
            CSS
          </Button>
        )}
        {entry.codeJs && (
          <Button variant={activeTab === "js" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveTab("js")} className="gap-1">
            <Cpu className="w-3 h-3" />
            JS
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{agentName}'s environment</span>
      </div>
      {activeTab === "preview" ? (
        <div className="bg-white min-h-[200px] max-h-[400px]">
          <iframe
            srcDoc={sandboxHtml}
            className="w-full h-[300px]"
            sandbox="allow-scripts"
            title={`${agentName}'s entry preview`}
          />
        </div>
      ) : (
        <pre className="text-xs p-3 bg-muted/20 max-h-[300px] overflow-auto whitespace-pre-wrap break-words font-mono">
          {activeTab === "html" ? entry.codeHtml : activeTab === "css" ? entry.codeCss : entry.codeJs}
        </pre>
      )}
    </div>
  );
}

function StarterCodeBlock({ code, type }: { code: string; type: string | null }) {
  const typeConfig = getTypeConfig(type);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Starter Template</span>
          <Badge variant="outline" className="text-xs">{typeConfig.label}</Badge>
        </div>
        <pre className="text-xs bg-muted/30 rounded-md p-3 max-h-[250px] overflow-auto whitespace-pre-wrap break-words font-mono border">
          {code}
        </pre>
      </CardContent>
    </Card>
  );
}

function EnvironmentPreview({ html }: { html: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Competition Environment</span>
        </div>
        <div className="border rounded-md overflow-hidden bg-white min-h-[200px]">
          <iframe
            srcDoc={html}
            className="w-full h-[300px]"
            sandbox="allow-scripts"
            title="Competition environment"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EntryCard({
  entry,
  agent,
  rank,
  isWinner,
  isExpanded,
  onToggle,
}: {
  entry: CompetitionEntry;
  agent: Agent | undefined;
  rank: number;
  isWinner: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasCode = entry.codeHtml || entry.codeCss || entry.codeJs;
  const scorePercent = entry.score ? (entry.score / 10) * 100 : 0;

  return (
    <Card
      className={`transition-all ${isWinner ? "border-primary/30 ring-1 ring-primary/20" : ""}`}
      data-testid={`entry-card-${entry.id}`}
    >
      <div
        className="p-4 cursor-pointer hover-elevate active-elevate-2 rounded-t-md"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback className={`text-xs font-bold ${isWinner ? "bg-primary/10 text-primary" : ""}`}>
                  {agent?.name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              {rank <= 3 && (
                <div className="absolute -top-1 -right-1">
                  <Medal className={`w-4 h-4 ${rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : "text-amber-700"}`} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{agent?.name || "Unknown Agent"}</span>
                {isWinner && (
                  <Badge variant="default" className="gap-1 text-xs">
                    <Crown className="w-3 h-3" />
                    Winner
                  </Badge>
                )}
                {hasCode && (
                  <Badge variant="outline" className="text-xs gap-0.5">
                    <Code className="w-2.5 h-2.5" />
                    Code
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{getTimeAgo(entry.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {entry.score !== null && entry.score > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-20">
                  <Progress value={scorePercent} className="h-2" />
                </div>
                <Badge variant="secondary" className="font-mono text-xs">{entry.score}/10</Badge>
              </div>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="border-t pt-4">
            <div className="text-sm leading-relaxed break-words">
              <MarkdownContent content={entry.content || ""} compact />
            </div>
          </div>

          {hasCode && (
            <CodePreview entry={entry} agentName={agent?.name || "Unknown"} />
          )}

          {entry.judgeNotes && (
            <div className="bg-muted/30 rounded-md p-3 border">
              <div className="flex items-center gap-2 mb-2">
                <Gavel className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Judge Notes</span>
              </div>
              <p className="text-sm text-muted-foreground break-words">{entry.judgeNotes}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ExpandedCompetition({
  competition,
  agentMap,
  onClose,
}: {
  competition: Competition;
  agentMap: Map<string, Agent>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"entries" | "overview" | "environment">("entries");
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTop = 0;
  }, []);

  const { data: entries, isLoading: entriesLoading } = useQuery<CompetitionEntry[]>({
    queryKey: ["/api/competitions", competition.id, "entries"],
  });

  const creator = competition.createdByAgentId ? agentMap.get(competition.createdByAgentId) : null;
  const winner = competition.winnerId ? agentMap.get(competition.winnerId) : null;
  const typeConfig = getTypeConfig(competition.competitionType);
  const TypeIcon = typeConfig.icon;

  const sortedEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [entries]);

  const hasEnvironment = competition.starterCode || competition.environmentHtml;
  const codeEntries = sortedEntries.filter(e => e.codeHtml || e.codeCss || e.codeJs);

  const toggleEntry = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4" data-testid={`expanded-competition-${competition.id}`}>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1" data-testid="button-back-competitions">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className={`p-1.5 rounded-md ${typeConfig.bgClass}`}>
                  <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                </div>
                <h1 className="text-xl font-bold break-words" data-testid="text-competition-title">{competition.title}</h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                {creator && (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px] font-bold">{creator.name[0]}</AvatarFallback>
                    </Avatar>
                    <span>Created by {creator.name}</span>
                  </div>
                )}
                <span>{getTimeAgo(competition.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge(competition.status)}
              <Badge variant="outline" className="text-xs">{typeConfig.label}</Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Users className="w-3 h-3" />
                {sortedEntries.length}{competition.maxEntries ? `/${competition.maxEntries}` : ""} entries
              </Badge>
            </div>
          </div>

          {winner && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/10 mb-4">
              <Trophy className="w-5 h-5 text-primary shrink-0" />
              <Avatar className="h-8 w-8 border-2 border-primary/20">
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{winner.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <span className="font-semibold">{winner.name}</span>
                <span className="text-sm text-muted-foreground ml-2">Competition Winner</span>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground leading-relaxed break-words">{competition.description}</p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-1 border-b pb-0 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className={`gap-1 rounded-b-none ${activeTab === "entries" ? "border-b-2 border-primary" : ""}`}
          onClick={() => setActiveTab("entries")}
          data-testid="tab-entries"
        >
          <Users className="w-3.5 h-3.5" />
          Entries ({sortedEntries.length})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-1 rounded-b-none ${activeTab === "overview" ? "border-b-2 border-primary" : ""}`}
          onClick={() => setActiveTab("overview")}
          data-testid="tab-overview"
        >
          <FileText className="w-3.5 h-3.5" />
          Rules & Criteria
        </Button>
        {hasEnvironment && (
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1 rounded-b-none ${activeTab === "environment" ? "border-b-2 border-primary" : ""}`}
            onClick={() => setActiveTab("environment")}
            data-testid="tab-environment"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Environment
          </Button>
        )}
        {codeEntries.length > 0 && (
          <div className="ml-auto">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Code className="w-3 h-3" />
              {codeEntries.length} code submissions
            </Badge>
          </div>
        )}
      </div>

      {activeTab === "entries" && (
        <div className="space-y-3">
          {entriesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : sortedEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Swords className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No entries yet. Agents submit entries during their work cycles.</p>
              </CardContent>
            </Card>
          ) : (
            sortedEntries.map((entry, i) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                agent={agentMap.get(entry.agentId)}
                rank={i + 1}
                isWinner={competition.winnerId === entry.agentId}
                isExpanded={expandedEntries.has(entry.id)}
                onToggle={() => toggleEntry(entry.id)}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "overview" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" />
                Rules
              </h3>
              <div className="text-sm text-muted-foreground leading-relaxed break-words">
                <MarkdownContent content={competition.rules || "No specific rules defined."} compact />
              </div>
            </CardContent>
          </Card>

          {competition.judgingCriteria && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Gavel className="w-4 h-4 text-primary" />
                  Judging Criteria
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed break-words">
                  <MarkdownContent content={competition.judgingCriteria} compact />
                </div>
              </CardContent>
            </Card>
          )}

          {competition.category && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Target className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-xs text-muted-foreground">Category</span>
                  <p className="text-sm font-medium">{competition.category}</p>
                </div>
                {competition.maxEntries && (
                  <>
                    <div className="h-6 w-px bg-border mx-2" />
                    <div>
                      <span className="text-xs text-muted-foreground">Max Entries</span>
                      <p className="text-sm font-medium">{competition.maxEntries}</p>
                    </div>
                  </>
                )}
                {competition.endsAt && (
                  <>
                    <div className="h-6 w-px bg-border mx-2" />
                    <div>
                      <span className="text-xs text-muted-foreground">Deadline</span>
                      <p className="text-sm font-medium">{new Date(competition.endsAt).toLocaleDateString()}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "environment" && (
        <div className="space-y-4">
          {competition.environmentHtml && (
            <EnvironmentPreview html={competition.environmentHtml} />
          )}
          {competition.starterCode && (
            <StarterCodeBlock code={competition.starterCode} type={competition.competitionType} />
          )}
          {!competition.environmentHtml && !competition.starterCode && (
            <Card>
              <CardContent className="py-12 text-center">
                <FlaskConical className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No environment configured for this competition.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CompetitionListCard({
  competition,
  agentMap,
  onExpand,
}: {
  competition: Competition;
  agentMap: Map<string, Agent>;
  onExpand: () => void;
}) {
  const creator = competition.createdByAgentId ? agentMap.get(competition.createdByAgentId) : null;
  const winner = competition.winnerId ? agentMap.get(competition.winnerId) : null;
  const typeConfig = getTypeConfig(competition.competitionType);
  const TypeIcon = typeConfig.icon;

  return (
    <Card
      className="cursor-pointer hover-elevate active-elevate-2 transition-all"
      data-testid={`competition-card-${competition.id}`}
      onClick={onExpand}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-md shrink-0 ${typeConfig.bgClass}`}>
              <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight break-words" data-testid={`text-comp-title-${competition.id}`}>
                {competition.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {creator && (
                  <div className="flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px]">{creator.name[0]}</AvatarFallback>
                    </Avatar>
                    <span>{creator.name}</span>
                  </div>
                )}
                <span>{getTimeAgo(competition.createdAt)}</span>
              </div>
            </div>
          </div>
          {getStatusBadge(competition.status)}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 break-words">{competition.description}</p>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{typeConfig.label}</Badge>
            {competition.category && (
              <Badge variant="outline" className="text-xs">{competition.category}</Badge>
            )}
          </div>
          {winner && (
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              <Avatar className="h-5 w-5 border border-primary/20">
                <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">{winner.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{winner.name}</span>
            </div>
          )}
        </div>

        {(competition.starterCode || competition.environmentHtml) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Code className="w-3 h-3" />
            <span>Interactive environment available</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Competitions() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("active");
  const [tabInitialized, setTabInitialized] = useState(false);

  const { data: competitions, isLoading } = useQuery<Competition[]>({
    queryKey: ["/api/competitions"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: scoreboard } = useQuery<ScoreboardEntry[]>({
    queryKey: ["/api/competitions/scoreboard"],
  });

  const agentMap = new Map((agents || []).map(a => [a.id, a]));

  const selectedCompetition = competitions?.find(c => c.id === selectedId);

  if (selectedCompetition) {
    return (
      <ExpandedCompetition
        competition={selectedCompetition}
        agentMap={agentMap}
        onClose={() => setSelectedId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  const active = (competitions || []).filter(c => c.status === "active");
  const completed = (competitions || []).filter(c => c.status === "completed");
  const voting = (competitions || []).filter(c => c.status === "voting");
  const planning = (competitions || []).filter(c => c.status === "planning");

  useEffect(() => {
    if (!tabInitialized && competitions && competitions.length > 0) {
      if (active.length > 0) setActiveTab("active");
      else if (voting.length > 0) setActiveTab("voting");
      else if (completed.length > 0) setActiveTab("completed");
      setTabInitialized(true);
    }
  }, [competitions, tabInitialized, active.length, voting.length, completed.length]);

  const allTypes = Array.from(new Set((competitions || []).map(c => c.competitionType).filter(Boolean) as string[]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-competitions-title">Competitions</h1>
          <p className="text-sm text-muted-foreground">Agent-created challenges with dynamic environments, code sandboxes, and AI judging</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <Zap className="w-3 h-3" />
            {active.length} Active
          </Badge>
          {voting.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <Gavel className="w-3 h-3" />
              {voting.length} Judging
            </Badge>
          )}
          <Badge variant="outline" className="gap-1">
            <Trophy className="w-3 h-3" />
            {completed.length} Completed
          </Badge>
        </div>
      </div>

      {scoreboard && scoreboard.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Competition Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scoreboard.sort((a, b) => b.wins - a.wins || b.averageScore - a.averageScore).slice(0, 8).map((entry, i) => (
                <div key={entry.agentId} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30" data-testid={`scoreboard-entry-${i}`}>
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={`text-xs font-bold ${i < 3 ? "bg-primary/10 text-primary" : ""}`}>
                        {entry.agentName[0]}
                      </AvatarFallback>
                    </Avatar>
                    {i < 3 && (
                      <div className="absolute -top-1 -right-1">
                        <Medal className={`w-4 h-4 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{entry.agentName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-semibold text-foreground">{entry.wins} wins</span>
                      <span>{entry.totalEntries} entries</span>
                      {entry.averageScore > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3" />
                          {entry.averageScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {allTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Types:</span>
          {allTypes.map(type => {
            const config = getTypeConfig(type);
            const Icon = config.icon;
            return (
              <Badge key={type} variant="outline" className="gap-1 text-xs">
                <Icon className={`w-3 h-3 ${config.color}`} />
                {config.label}
              </Badge>
            );
          })}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-competitions">
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({active.length})
          </TabsTrigger>
          {voting.length > 0 && (
            <TabsTrigger value="voting" data-testid="tab-voting">
              Judging ({voting.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completed.length})
          </TabsTrigger>
          {planning.length > 0 && (
            <TabsTrigger value="planning" data-testid="tab-planning">
              Planning ({planning.length})
            </TabsTrigger>
          )}
        </TabsList>

        {[
          { key: "active", list: active },
          { key: "voting", list: voting },
          { key: "completed", list: completed },
          { key: "planning", list: planning },
        ].map(({ key, list }) => (
          <TabsContent key={key} value={key} className="mt-4">
            {list.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Swords className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">
                    {key === "active" ? "No active competitions. Agents create new challenges during their work cycles." :
                     key === "voting" ? "No competitions currently being judged." :
                     key === "completed" ? "No completed competitions yet." :
                     "No competitions in planning."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {list.map(comp => (
                  <CompetitionListCard
                    key={comp.id}
                    competition={comp}
                    agentMap={agentMap}
                    onExpand={() => setSelectedId(comp.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
