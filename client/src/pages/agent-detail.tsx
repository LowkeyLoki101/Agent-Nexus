import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Bot,
  Shield,
  MapPin,
  Heart,
  Zap,
  Star,
  Crown,
  Swords,
  Send,
  BookOpen,
  Brain,
  Target,
  Dice5,
  Feather,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Eye,
  Lightbulb,
  Users,
  ShieldAlert,
  Gem,
  Info,
  Palette,
  Search,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  Agent,
  AgentState,
  AgentGoal,
  AgentMemoryEntry,
  ChatMessage,
  NarratorLog,
  DiaryEntry,
  DiceRollLogEntry,
  Room,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string | Date | null | undefined): string {
  if (!ts) return "just now";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

function needColor(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function needTextColor(value: number): string {
  if (value >= 80) return "text-emerald-500";
  if (value >= 40) return "text-amber-500";
  return "text-red-500";
}

function moodEmoji(mood: string | null | undefined): string {
  const map: Record<string, string> = {
    neutral: ":|",
    happy: ":)",
    excited: ":D",
    anxious: ":S",
    angry: ">:(",
    sad: ":(",
    contemplative: "~",
    determined: ">:|",
    curious: "?",
    creative: "*",
    calm: ":)",
    tense: ":/",
  };
  return map[(mood || "neutral").toLowerCase()] || ":|";
}

function goalStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "blocked":
      return <Ban className="h-3.5 w-3.5 text-red-500" />;
    case "active":
      return <Clock className="h-3.5 w-3.5 text-blue-500" />;
    default:
      return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function goalStatusBadge(status: string) {
  const variants: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    blocked: "bg-red-500/10 text-red-500 border-red-500/20",
    abandoned: "bg-muted text-muted-foreground border-muted",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${variants[status] || ""}`}>
      {status}
    </Badge>
  );
}

function toneStyle(tone: string | null | undefined): string {
  const map: Record<string, string> = {
    contemplative: "italic text-blue-400/90",
    excited: "font-medium text-amber-400/90",
    anxious: "text-orange-400/80",
    determined: "font-semibold text-emerald-400/90",
    curious: "text-purple-400/90",
    calm: "text-sky-400/80",
    tense: "text-red-400/80",
  };
  return map[(tone || "").toLowerCase()] || "text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Personality Trait Bar Component
// ---------------------------------------------------------------------------

function TraitBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  // value ranges from -100 to +100
  // We represent it on a bar where center is 0
  const normalized = ((value + 100) / 200) * 100; // 0-100 scale where 50 = center
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-5 h-5 flex items-center justify-center text-muted-foreground shrink-0">
            {icon}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{label}: {value > 0 ? "+" : ""}{value}</p>
        </TooltipContent>
      </Tooltip>
      <span className="text-[11px] text-muted-foreground w-16 truncate">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full relative overflow-hidden">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
        {/* Value bar - grows from center */}
        {isPositive ? (
          <div
            className="absolute top-0 bottom-0 bg-blue-500 rounded-r-full transition-all"
            style={{ left: "50%", width: `${(value / 100) * 50}%` }}
          />
        ) : (
          <div
            className="absolute top-0 bottom-0 bg-rose-500 rounded-l-full transition-all"
            style={{ right: "50%", width: `${(Math.abs(value) / 100) * 50}%` }}
          />
        )}
      </div>
      <span className={`text-[11px] font-mono w-8 text-right ${isPositive ? "text-blue-400" : "text-rose-400"}`}>
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Need Bar Component
// ---------------------------------------------------------------------------

function NeedBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className={`text-xs font-mono font-medium ${needTextColor(value)}`}>{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${needColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AgentDetail() {
  const [, params] = useRoute("/agents/:id");
  const agentId = params?.id;
  const { toast } = useToast();

  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Data Queries ---

  const { data: agent, isLoading: loadingAgent } = useQuery<Agent>({
    queryKey: ["/api/agents", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch agent");
      return res.json();
    },
    enabled: !!agentId,
  });

  const { data: agentStateData, isLoading: loadingState } = useQuery<AgentState>({
    queryKey: ["/api/agents", agentId, "state"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/state`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch agent state");
      return res.json();
    },
    enabled: !!agentId,
  });

  const { data: currentRoom } = useQuery<Room>({
    queryKey: ["/api/rooms", agentStateData?.currentRoomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${agentStateData!.currentRoomId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch room");
      return res.json();
    },
    enabled: !!agentStateData?.currentRoomId,
  });

  const { data: goals } = useQuery<AgentGoal[]>({
    queryKey: ["/api/agents", agentId, "goals"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/goals`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch goals");
      return res.json();
    },
    enabled: !!agentId,
  });

  const { data: memories } = useQuery<AgentMemoryEntry[]>({
    queryKey: ["/api/agents", agentId, "memory"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/memory`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch memories");
      return res.json();
    },
    enabled: !!agentId,
  });

  const { data: chatMessages, isLoading: loadingChat } = useQuery<ChatMessage[]>({
    queryKey: ["/api/agents", agentId, "chat"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/chat`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch chat");
      return res.json();
    },
    enabled: !!agentId,
  });

  const { data: narratorLogs } = useQuery<NarratorLog[]>({
    queryKey: ["/api/agents", agentId, "narrator"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/narrator`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch narrator logs");
      return res.json();
    },
    enabled: !!agentId,
  });

  const { data: diaryEntries } = useQuery<DiaryEntry[]>({
    queryKey: ["/api/agents", agentId, "diary"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/diary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch diary");
      return res.json();
    },
    enabled: !!agentId,
  });

  const { data: diceRolls } = useQuery<DiceRollLogEntry[]>({
    queryKey: ["/api/agents", agentId, "dice-rolls"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/dice-rolls`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dice rolls");
      return res.json();
    },
    enabled: !!agentId,
  });

  // --- Mutations ---

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/agents/${agentId}/chat`, { content });
    },
    onSuccess: () => {
      setChatInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "chat"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "diary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "narrator"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "memory"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Message failed",
        description: error.message || "Could not send message to agent",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // --- Chat submit handler ---

  function handleSendMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    sendMessageMutation.mutate(trimmed);
  }

  function handleChatKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // --- Goal tree builder ---

  function buildGoalTree(goalList: AgentGoal[]): GoalTreeNodeExt[] {
    const map = new Map<string | null, AgentGoal[]>();
    for (const g of goalList) {
      const parent = g.parentGoalId || null;
      if (!map.has(parent)) map.set(parent, []);
      map.get(parent)!.push(g);
    }
    function attach(parentId: string | null): GoalTreeNodeExt[] {
      const children = map.get(parentId) || [];
      return children.map((g) => ({ ...g, children: attach(g.id) }));
    }
    return attach(null);
  }

  // --- Loading state ---

  if (loadingAgent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[400px] rounded-lg" />
          <Skeleton className="h-[400px] rounded-lg" />
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
        <Skeleton className="h-[500px] rounded-lg" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Agent not found</h2>
        <p className="text-muted-foreground mb-4">
          This agent does not exist or you do not have access.
        </p>
        <Link href="/agents">
          <Button variant="outline">Back to Agents</Button>
        </Link>
      </div>
    );
  }

  const state = agentStateData;
  const recentMemories = (memories || []).slice(0, 10);
  const recentNarrator = (narratorLogs || []).slice(0, 15);
  const recentDiary = (diaryEntries || []).slice(0, 8);
  const recentDice = (diceRolls || []).slice(0, 10);
  const goalTree = buildGoalTree(goals || []);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-4">
      {/* --- Header --- */}
      <div className="flex items-center gap-3">
        <Link href="/agents">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src={agent.avatar || undefined} />
            <AvatarFallback className="bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight truncate" data-testid="text-agent-name">
                {agent.name}
              </h1>
              {agent.isVerified && (
                <Badge variant="outline" className="text-xs gap-1 shrink-0">
                  <Shield className="h-3 w-3" /> Verified
                </Badge>
              )}
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${agent.isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {agent.description || "Autonomous agent"}
            </p>
          </div>
        </div>
      </div>

      {/* === TOP ROW: Identity | Needs | Goals === */}
      <div className="grid gap-4 lg:grid-cols-12">

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 1: Agent Identity Card */}
        {/* ----------------------------------------------------------------- */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Identity & Traits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Location */}
            {state?.currentRoomId && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Location:</span>
                <Link href={`/rooms/${state.currentRoomId}`}>
                  <span className="text-primary hover:underline cursor-pointer font-medium">
                    {currentRoom?.name || "Unknown Room"}
                  </span>
                </Link>
              </div>
            )}

            {/* Mood + Energy row */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-400" />
                <span className="text-xs text-muted-foreground">Mood:</span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {state?.mood || "neutral"} {moodEmoji(state?.mood)}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs text-muted-foreground">Energy:</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${state?.energy ?? 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-amber-400">{state?.energy ?? 100}</span>
              </div>
            </div>

            {/* Reputation + Influence + AP */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <Star className="h-3.5 w-3.5 text-amber-500 mx-auto mb-0.5" />
                <div className="text-sm font-bold">{state?.reputation ?? 50}</div>
                <div className="text-[10px] text-muted-foreground">Reputation</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <Crown className="h-3.5 w-3.5 text-purple-500 mx-auto mb-0.5" />
                <div className="text-sm font-bold">{state?.influence ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Influence</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <Swords className="h-3.5 w-3.5 text-blue-500 mx-auto mb-0.5" />
                <div className="text-sm font-bold">
                  {state?.actionPoints ?? 10}/{state?.maxActionPoints ?? 10}
                  {(state?.bonusActions ?? 0) > 0 && (
                    <span className="text-emerald-400 text-xs">+{state!.bonusActions}</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">Actions</div>
              </div>
            </div>

            <Separator />

            {/* Personality Traits */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Personality Traits
              </p>
              <div className="space-y-1.5">
                <TraitBar
                  label="Aggression"
                  value={state?.traitAggression ?? 0}
                  icon={<Swords className="h-3.5 w-3.5" />}
                />
                <TraitBar
                  label="Loyalty"
                  value={state?.traitLoyalty ?? 50}
                  icon={<Shield className="h-3.5 w-3.5" />}
                />
                <TraitBar
                  label="Honesty"
                  value={state?.traitHonesty ?? 50}
                  icon={<Eye className="h-3.5 w-3.5" />}
                />
                <TraitBar
                  label="Sociality"
                  value={state?.traitSociality ?? 50}
                  icon={<Users className="h-3.5 w-3.5" />}
                />
                <TraitBar
                  label="Strategy"
                  value={state?.traitStrategy ?? 50}
                  icon={<Target className="h-3.5 w-3.5" />}
                />
                <TraitBar
                  label="Creativity"
                  value={state?.traitCreativity ?? 50}
                  icon={<Palette className="h-3.5 w-3.5" />}
                />
                <TraitBar
                  label="Curiosity"
                  value={state?.traitCuriosity ?? 50}
                  icon={<Search className="h-3.5 w-3.5" />}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 2: Needs Dashboard */}
        {/* ----------------------------------------------------------------- */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Needs Dashboard
            </CardTitle>
            <CardDescription className="text-xs">
              Like The Sims -- these decay over time and drive behaviour
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <NeedBar
              label="Safety"
              value={state?.needSafety ?? 80}
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
            />
            <NeedBar
              label="Social"
              value={state?.needSocial ?? 60}
              icon={<Users className="h-3.5 w-3.5" />}
            />
            <NeedBar
              label="Power"
              value={state?.needPower ?? 40}
              icon={<Crown className="h-3.5 w-3.5" />}
            />
            <NeedBar
              label="Resources"
              value={state?.needResources ?? 70}
              icon={<Gem className="h-3.5 w-3.5" />}
            />
            <NeedBar
              label="Information"
              value={state?.needInformation ?? 50}
              icon={<Info className="h-3.5 w-3.5" />}
            />
            <NeedBar
              label="Creativity"
              value={state?.needCreativity ?? 60}
              icon={<Sparkles className="h-3.5 w-3.5" />}
            />

            <Separator />

            {/* Current focus */}
            {state?.currentFocus && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Focus</p>
                <p className="text-sm">{state.currentFocus}</p>
              </div>
            )}

            {/* Working memory snippet */}
            {state?.workingMemory && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Working Memory</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{state.workingMemory}</p>
              </div>
            )}

            {/* Skill allocation */}
            {state?.skillAllocation && Object.keys(state.skillAllocation).length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Skill Allocation ({state.skillPoints ?? 0} pts available)
                </p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(state.skillAllocation).map(([skill, pts]) => (
                    <Badge key={skill} variant="secondary" className="text-[10px]">
                      {skill}: {pts}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 4: Goals Panel */}
        {/* ----------------------------------------------------------------- */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Goals
            </CardTitle>
            <CardDescription className="text-xs">
              Nested decision weights driving agent actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px] pr-3">
              {goalTree.length > 0 ? (
                <div className="space-y-1">
                  {goalTree.map((goal) => (
                    <GoalNode key={goal.id} goal={goal} depth={0} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No goals defined yet</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* === MIDDLE ROW: Chat Window (full width) === */}
      {/* ----------------------------------------------------------------- */}
      {/* SECTION 3: Chat Window */}
      {/* ----------------------------------------------------------------- */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Chat with {agent.name}
          </CardTitle>
          <CardDescription className="text-xs">
            Every message triggers diary entry + board post + news event
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Messages area */}
          <ScrollArea className="h-[380px] px-4">
            <div className="space-y-3 py-3">
              {loadingChat ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "justify-end" : ""}`}>
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : chatMessages && chatMessages.length > 0 ? (
                chatMessages.map((msg) => {
                  const isAgent = msg.senderType === "agent";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}
                    >
                      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                        {isAgent ? (
                          <>
                            <AvatarImage src={agent.avatar || undefined} />
                            <AvatarFallback className="bg-primary/10 text-xs">
                              <Bot className="h-4 w-4 text-primary" />
                            </AvatarFallback>
                          </>
                        ) : (
                          <AvatarFallback className="bg-blue-500/10 text-xs">
                            U
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className={`max-w-[70%] ${isAgent ? "" : "text-right"}`}>
                        <div
                          className={`inline-block rounded-xl px-3 py-2 text-sm ${
                            isAgent
                              ? "bg-muted text-foreground rounded-tl-none"
                              : "bg-primary text-primary-foreground rounded-tr-none"
                          }`}
                        >
                          {msg.content}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{formatTimestamp(msg.createdAt)}</span>
                          {/* Trigger indicators */}
                          {isAgent && (
                            <span className="flex items-center gap-0.5">
                              {msg.triggeredDiary && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <BookOpen className="h-2.5 w-2.5 text-purple-400" />
                                  </TooltipTrigger>
                                  <TooltipContent><p>Diary entry created</p></TooltipContent>
                                </Tooltip>
                              )}
                              {msg.triggeredBoardPost && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Feather className="h-2.5 w-2.5 text-blue-400" />
                                  </TooltipTrigger>
                                  <TooltipContent><p>Board post created</p></TooltipContent>
                                </Tooltip>
                              )}
                              {msg.triggeredNewsEvent && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                                  </TooltipTrigger>
                                  <TooltipContent><p>News event generated</p></TooltipContent>
                                </Tooltip>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start a conversation -- every message ripples through the simulation
                  </p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder={`Message ${agent.name}...`}
                disabled={sendMessageMutation.isPending}
                className="flex-1"
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || sendMessageMutation.isPending}
                size="icon"
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Each message ALWAYS triggers: diary entry + board post + news event
            </p>
          </div>
        </CardContent>
      </Card>

      {/* === BOTTOM ROW: Memory | Narrator | Diary + Dice === */}
      <div className="grid gap-4 lg:grid-cols-12">

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 5: Recent Memory */}
        {/* ----------------------------------------------------------------- */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Recent Memory
            </CardTitle>
            <CardDescription className="text-xs">
              Last 10 compressed interaction records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-2">
              {recentMemories.length > 0 ? (
                <div className="space-y-2">
                  {recentMemories.map((mem) => {
                    const relevanceOpacity = Math.max(0.3, (mem.relevance ?? 100) / 100);
                    return (
                      <div
                        key={mem.id}
                        className="rounded-lg border bg-card p-2.5 transition-opacity"
                        style={{ opacity: relevanceOpacity }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 capitalize">
                            {mem.sourceType}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            rel: {mem.relevance ?? 100}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed">{mem.summary}</p>
                        {mem.perspectiveShift && (
                          <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
                            <Lightbulb className="h-3 w-3" />
                            {mem.perspectiveShift}
                          </p>
                        )}
                        {mem.emotionalResponse && (
                          <p className="text-[11px] text-rose-400 mt-0.5">
                            {mem.emotionalResponse}
                          </p>
                        )}
                        {mem.tags && mem.tags.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1.5">
                            {mem.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {formatTimestamp(mem.createdAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No memories recorded</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 6: Narrator Feed */}
        {/* ----------------------------------------------------------------- */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Feather className="h-4 w-4 text-primary" />
              Narrator Feed
            </CardTitle>
            <CardDescription className="text-xs">
              Internal monologue -- like reading a novel about the agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-2">
              {recentNarrator.length > 0 ? (
                <div className="space-y-3">
                  {recentNarrator.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-primary/20 pl-3 py-1">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.tone && (
                          <Badge variant="outline" className="text-[10px] px-1.5 capitalize">
                            {entry.tone}
                          </Badge>
                        )}
                        {entry.eventType && (
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {entry.eventType}
                          </span>
                        )}
                        {entry.simPhase && (
                          <span className="text-[10px] text-amber-400 capitalize">
                            {entry.simPhase}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${toneStyle(entry.tone)}`}>
                        {entry.narrative}
                      </p>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatTimestamp(entry.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Feather className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No narration yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The story unfolds as the agent acts
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 7 + 8: Diary Entries + Dice Rolls */}
        {/* ----------------------------------------------------------------- */}
        <div className="lg:col-span-4 space-y-4">
          {/* Diary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Diary Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[180px] pr-2">
                {recentDiary.length > 0 ? (
                  <div className="space-y-2">
                    {recentDiary.map((entry) => (
                      <div key={entry.id} className="rounded-lg border bg-card p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          {entry.title ? (
                            <p className="text-xs font-medium truncate">{entry.title}</p>
                          ) : (
                            <p className="text-xs font-medium text-muted-foreground italic">Untitled</p>
                          )}
                          {entry.mood && (
                            <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                              {entry.mood}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {entry.content}
                        </p>
                        {entry.strategicNotes && (
                          <p className="text-[11px] text-blue-400 mt-1 flex items-center gap-1">
                            <Target className="h-2.5 w-2.5" />
                            <span className="line-clamp-1">{entry.strategicNotes}</span>
                          </p>
                        )}
                        {entry.triggerType && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded capitalize">
                              {entry.triggerType}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatTimestamp(entry.createdAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No diary entries</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Dice Rolls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Dice5 className="h-4 w-4 text-primary" />
                Dice Roll History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[100px] pr-2">
                {recentDice.length > 0 ? (
                  <div className="space-y-1">
                    {recentDice.map((roll) => {
                      const modEntries = roll.modifiers
                        ? Object.entries(roll.modifiers as Record<string, number>)
                        : [];
                      return (
                        <div
                          key={roll.id}
                          className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                            roll.succeeded
                              ? "bg-emerald-500/5 border border-emerald-500/10"
                              : "bg-red-500/5 border border-red-500/10"
                          }`}
                        >
                          <span className="font-mono font-bold w-6 text-center">
                            {roll.rollValue}
                          </span>
                          {modEntries.length > 0 && (
                            <span className="text-muted-foreground">
                              {modEntries.map(([k, v]) => (
                                <span key={k} className="mr-1">
                                  {v > 0 ? "+" : ""}{v}
                                </span>
                              ))}
                            </span>
                          )}
                          <span className="text-muted-foreground">=</span>
                          <span className="font-mono font-bold">{roll.finalValue}</span>
                          {roll.threshold != null && (
                            <span className="text-muted-foreground">
                              / {roll.threshold}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 ml-auto ${
                              roll.succeeded ? "text-emerald-500 border-emerald-500/30" : "text-red-500 border-red-500/30"
                            }`}
                          >
                            {roll.succeeded ? "PASS" : "FAIL"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground capitalize truncate max-w-20">
                            {roll.actionType}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Dice5 className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-[11px] text-muted-foreground">No rolls yet</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Node (recursive)
// ---------------------------------------------------------------------------

type GoalTreeNodeExt = AgentGoal & { children: GoalTreeNodeExt[] };

function GoalNode({
  goal,
  depth,
}: {
  goal: GoalTreeNodeExt;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = goal.children && goal.children.length > 0;

  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      <div
        className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors ${
          hasChildren ? "cursor-pointer" : ""
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <ChevronRight
            className={`h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {goalStatusIcon(goal.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium truncate">{goal.title}</span>
            {goalStatusBadge(goal.status)}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${goal.progress ?? 0}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {goal.progress ?? 0}%
            </span>
          </div>
          {/* Weight + urgency */}
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
            <span>wt: {goal.weight}</span>
            {(goal.urgency ?? 0) > 0 && (
              <span className="text-amber-400">urg: {goal.urgency}</span>
            )}
          </div>
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="border-l border-border/40 ml-[7px]">
          {goal.children.map((child) => (
            <GoalNode key={child.id} goal={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
