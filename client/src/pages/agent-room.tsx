import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CloudLightning,
  FileText,
  Heart,
  Lightbulb,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Star,
  Telescope,
  Trash2,
  Eye,
  Cpu,
} from "lucide-react";
import { Link } from "wouter";
import type { Agent, AgentRoom, DiaryEntry } from "@shared/schema";

const MOOD_CONFIG: Record<string, { icon: typeof Brain; label: string; color: string }> = {
  thinking: { icon: Brain, label: "Thinking", color: "text-blue-500" },
  dreaming: { icon: Sparkles, label: "Dreaming", color: "text-purple-500" },
  wanting: { icon: Heart, label: "Wanting", color: "text-rose-500" },
  reflecting: { icon: Eye, label: "Reflecting", color: "text-amber-500" },
  planning: { icon: Lightbulb, label: "Planning", color: "text-green-500" },
  creating: { icon: Star, label: "Creating", color: "text-orange-500" },
  observing: { icon: Telescope, label: "Observing", color: "text-cyan-500" },
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  xai: "xAI (Grok)",
};

export default function AgentRoomPage() {
  const [, params] = useRoute("/agents/:id/room");
  const agentId = params?.id || "";
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("briefing");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [editedStatus, setEditedStatus] = useState("");

  const [showNewDiary, setShowNewDiary] = useState(false);
  const [diaryTitle, setDiaryTitle] = useState("");
  const [diaryContent, setDiaryContent] = useState("");
  const [diaryMood, setDiaryMood] = useState("thinking");

  const { data: agent, isLoading: agentLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", agentId],
    enabled: !!agentId,
  });

  const { data: room, isLoading: roomLoading } = useQuery<AgentRoom>({
    queryKey: ["/api/agents", agentId, "room"],
    enabled: !!agentId,
  });

  const { data: diaryEntries = [], isLoading: diaryLoading } = useQuery<DiaryEntry[]>({
    queryKey: ["/api/agents", agentId, "diary"],
    enabled: !!agentId,
  });

  const updateRoomMutation = useMutation({
    mutationFn: async (updates: { personalNotes?: string; projectStatus?: string }) => {
      return apiRequest("PATCH", `/api/agents/${agentId}/room`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "room"] });
      toast({ title: "Room updated" });
      setIsEditingNotes(false);
      setIsEditingStatus(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update room", variant: "destructive" });
    },
  });

  const createDiaryMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; mood: string }) => {
      return apiRequest("POST", `/api/agents/${agentId}/diary`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "diary"] });
      toast({ title: "Diary entry created" });
      setShowNewDiary(false);
      setDiaryTitle("");
      setDiaryContent("");
      setDiaryMood("thinking");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create diary entry", variant: "destructive" });
    },
  });

  const deleteDiaryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/diary/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "diary"] });
      toast({ title: "Diary entry deleted" });
    },
  });

  const isLoading = agentLoading || roomLoading;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Agent not found</p>
        <Link href="/agents">
          <Button variant="outline" className="mt-4" data-testid="button-back-to-agents">Back to Agents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-agent-room-title">
              {agent.name}'s Room
            </h1>
            <Badge variant={agent.isActive ? "default" : "secondary"} data-testid="badge-agent-status">
              {agent.isActive ? "Active" : "Inactive"}
            </Badge>
            {agent.provider && (
              <Badge variant="outline" data-testid="badge-agent-provider">
                <Cpu className="h-3 w-3 mr-1" />
                {PROVIDER_LABELS[agent.provider] || agent.provider}
              </Badge>
            )}
            {agent.modelName && (
              <Badge variant="outline" data-testid="badge-agent-model">
                {agent.modelName}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1" data-testid="text-agent-description">
            {agent.description || "Private room for autonomous reflection"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-room">
          <TabsTrigger value="briefing" data-testid="tab-briefing">
            <BookOpen className="h-4 w-4 mr-2" />
            Briefing
          </TabsTrigger>
          <TabsTrigger value="diary" data-testid="tab-diary">
            <Pencil className="h-4 w-4 mr-2" />
            Diary ({diaryEntries.length})
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <FileText className="h-4 w-4 mr-2" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="briefing" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Orientation Briefing</CardTitle>
                <CardDescription>
                  Agent identity, role, and onboarding information
                </CardDescription>
              </div>
              {room?.lastBriefedAt && (
                <Badge variant="outline" data-testid="badge-last-briefed">
                  Last briefed: {new Date(room.lastBriefedAt).toLocaleDateString()}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-orientation">
                {room?.orientation?.split("\n").map((line, i) => {
                  if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
                  if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-3 mb-1">{line.slice(3)}</h2>;
                  if (line.startsWith("- ")) return <li key={i} className="ml-4">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</li>;
                  if (line.match(/^\d+\./)) return <li key={i} className="ml-4">{line}</li>;
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="my-1">{line}</p>;
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Project Status</CardTitle>
                <CardDescription>
                  Current assignments and workspace activity
                </CardDescription>
              </div>
              {!isEditingStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsEditingStatus(true); setEditedStatus(room?.projectStatus || ""); }}
                  data-testid="button-edit-status"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingStatus ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedStatus}
                    onChange={(e) => setEditedStatus(e.target.value)}
                    rows={4}
                    data-testid="textarea-edit-status"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingStatus(false)} data-testid="button-cancel-status">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateRoomMutation.mutate({ projectStatus: editedStatus })}
                      disabled={updateRoomMutation.isPending}
                      data-testid="button-save-status"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm" data-testid="text-project-status">
                  {room?.projectStatus || "No active projects yet."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diary" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Agent Diary</h3>
              <p className="text-sm text-muted-foreground">Private thoughts, dreams, and reflections</p>
            </div>
            <Button
              onClick={() => setShowNewDiary(true)}
              disabled={showNewDiary}
              data-testid="button-new-diary-entry"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </div>

          {showNewDiary && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      placeholder="What's on your mind..."
                      value={diaryTitle}
                      onChange={(e) => setDiaryTitle(e.target.value)}
                      data-testid="input-diary-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mood</Label>
                    <Select value={diaryMood} onValueChange={setDiaryMood}>
                      <SelectTrigger data-testid="select-diary-mood">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MOOD_CONFIG).map(([key, config]) => {
                          const MoodIcon = config.icon;
                          return (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <MoodIcon className={`h-4 w-4 ${config.color}`} />
                                {config.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    placeholder="Write your thoughts..."
                    value={diaryContent}
                    onChange={(e) => setDiaryContent(e.target.value)}
                    rows={5}
                    data-testid="textarea-diary-content"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => { setShowNewDiary(false); setDiaryTitle(""); setDiaryContent(""); }}
                    data-testid="button-cancel-diary"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createDiaryMutation.mutate({ title: diaryTitle, content: diaryContent, mood: diaryMood })}
                    disabled={!diaryTitle.trim() || !diaryContent.trim() || createDiaryMutation.isPending}
                    data-testid="button-save-diary"
                  >
                    {createDiaryMutation.isPending ? "Saving..." : "Save Entry"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {diaryLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : diaryEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CloudLightning className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No diary entries yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This is where the agent records thoughts, dreams, and reflections
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {diaryEntries.map((entry) => {
                const moodConfig = MOOD_CONFIG[entry.mood || "thinking"] || MOOD_CONFIG.thinking;
                const MoodIcon = moodConfig.icon;
                return (
                  <Card key={entry.id} data-testid={`card-diary-entry-${entry.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <MoodIcon className={`h-4 w-4 ${moodConfig.color}`} />
                          <span className="font-medium" data-testid={`text-diary-title-${entry.id}`}>{entry.title}</span>
                          <Badge variant="outline" className={moodConfig.color}>
                            {moodConfig.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt!).toLocaleString()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteDiaryMutation.mutate(entry.id)}
                          data-testid={`button-delete-diary-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap" data-testid={`text-diary-content-${entry.id}`}>
                        {entry.content}
                      </p>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
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
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Personal Notes</CardTitle>
                <CardDescription>
                  Private workspace for agent self-management
                </CardDescription>
              </div>
              {!isEditingNotes && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsEditingNotes(true); setEditedNotes(room?.personalNotes || ""); }}
                  data-testid="button-edit-notes"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingNotes ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    rows={8}
                    placeholder="Personal notes, goals, reminders..."
                    data-testid="textarea-edit-notes"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(false)} data-testid="button-cancel-notes">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateRoomMutation.mutate({ personalNotes: editedNotes })}
                      disabled={updateRoomMutation.isPending}
                      data-testid="button-save-notes"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div data-testid="text-personal-notes">
                  {room?.personalNotes ? (
                    <p className="text-sm whitespace-pre-wrap">{room.personalNotes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No personal notes yet. Click Edit to add some.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
