import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
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
  BookOpen,
  Plus,
  ScrollText,
  Landmark,
  Clock,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ChronicleEntry } from "@shared/schema";

const CHAPTERS = [
  { key: "germination", label: "Germination" },
  { key: "awakening", label: "Awakening" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "pivot", label: "Pivot" },
  { key: "exchange", label: "Exchange" },
];

const ENTRY_TYPES = [
  { value: "origin", label: "Origin" },
  { value: "soul_clause", label: "Soul Clause" },
  { value: "conversation", label: "Conversation" },
  { value: "milestone", label: "Milestone" },
  { value: "lesson", label: "Lesson" },
];

const ROMAN_NUMERALS: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
  6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
};

function ChronicleEntryCard({ entry, index }: { entry: ChronicleEntry; index?: number }) {
  const isSoulClause = entry.entryType === "soul_clause";
  const isCanonical = entry.isCanonical;

  return (
    <Card
      className={`transition-colors ${isCanonical ? "border-l-4" : ""}`}
      style={isCanonical ? { borderLeftColor: "#E5A824" } : undefined}
      data-testid={`card-chronicle-${entry.id}`}
    >
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-1">
            {isSoulClause ? (
              <div
                className="flex items-center justify-center rounded-md"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(229, 168, 36, 0.12)",
                  color: "#E5A824",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {index !== undefined ? ROMAN_NUMERALS[index + 1] || (index + 1) : <ScrollText className="h-4 w-4" />}
              </div>
            ) : (
              <div
                className={`flex items-center justify-center rounded-md ${!isCanonical ? "bg-muted" : ""}`}
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: isCanonical ? "rgba(229, 168, 36, 0.08)" : undefined,
                }}
              >
                {isCanonical ? (
                  <Landmark className="h-4 w-4" style={{ color: "#E5A824" }} />
                ) : (
                  <ScrollText className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-semibold text-sm" data-testid={`text-chronicle-title-${entry.id}`}>
                {entry.title}
              </span>
              {isCanonical && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-0"
                  style={{ backgroundColor: "rgba(229, 168, 36, 0.15)", color: "#E5A824" }}
                  data-testid={`badge-canonical-${entry.id}`}
                >
                  Canonical
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {ENTRY_TYPES.find(t => t.value === entry.entryType)?.label || entry.entryType}
              </Badge>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-2" data-testid={`text-chronicle-content-${entry.id}`}>
              {entry.content}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {entry.tags?.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] text-muted-foreground"
                  data-testid={`badge-tag-${tag}`}
                >
                  {tag}
                </Badge>
              ))}
              {entry.createdAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                  <Clock className="h-3 w-3" />
                  {new Date(entry.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Chronicle() {
  const [activeChapter, setActiveChapter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newChapter, setNewChapter] = useState("");
  const [newEntryType, setNewEntryType] = useState("");
  const [newTags, setNewTags] = useState("");
  const { toast } = useToast();

  const { data: allEntries, isLoading } = useQuery<ChronicleEntry[]>({
    queryKey: ["/api/chronicle"],
  });

  const createEntry = useMutation({
    mutationFn: async () => {
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      return apiRequest("POST", "/api/chronicle", {
        title: newTitle,
        content: newContent,
        chapter: newChapter,
        entryType: newEntryType,
        tags: tags.length > 0 ? tags : undefined,
        isCanonical: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronicle"] });
      setShowAddDialog(false);
      setNewTitle("");
      setNewContent("");
      setNewChapter("");
      setNewEntryType("");
      setNewTags("");
      toast({ title: "Chronicle entry added" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed to add entry",
        description: e.message,
        variant: "destructive",
      }),
  });

  const soulClauses =
    allEntries?.filter((e) => e.entryType === "soul_clause") || [];

  const chapterEntries = (chapter: string) =>
    allEntries?.filter((e) => e.chapter === chapter) || [];

  const displayEntries =
    activeChapter === "all"
      ? allEntries || []
      : chapterEntries(activeChapter);

  const chapterOrigins = (chapter: string) =>
    chapterEntries(chapter).filter((e) => e.entryType !== "soul_clause");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ backgroundColor: "rgba(229, 168, 36, 0.12)" }}
          >
            <BookOpen className="h-6 w-6" style={{ color: "#E5A824" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              data-testid="text-chronicle-title"
            >
              The Chronicle
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" style={{ color: "#E5A824" }} />
              The living document that keeps everyone oriented toward the
              Exchange
            </p>
          </div>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-chronicle">
              <Plus className="h-4 w-4" /> Add to Chronicle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Chronicle Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Title
                </label>
                <Input
                  placeholder="Entry title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  data-testid="input-chronicle-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Content
                </label>
                <Textarea
                  placeholder="The substance of this entry..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={5}
                  data-testid="input-chronicle-content"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Chapter
                </label>
                <Select value={newChapter} onValueChange={setNewChapter}>
                  <SelectTrigger data-testid="select-chronicle-chapter">
                    <SelectValue placeholder="Select chapter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAPTERS.map((ch) => (
                      <SelectItem key={ch.key} value={ch.key}>
                        {ch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Entry Type
                </label>
                <Select value={newEntryType} onValueChange={setNewEntryType}>
                  <SelectTrigger data-testid="select-chronicle-entry-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Tags (comma-separated)
                </label>
                <Input
                  placeholder="e.g. trinity_filter, exchange"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  data-testid="input-chronicle-tags"
                />
              </div>
              <Button
                className="w-full"
                disabled={
                  !newTitle.trim() ||
                  !newContent.trim() ||
                  !newChapter ||
                  !newEntryType ||
                  createEntry.isPending
                }
                onClick={() => createEntry.mutate()}
                data-testid="button-submit-chronicle"
              >
                {createEntry.isPending ? "Adding..." : "Add Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeChapter} onValueChange={setActiveChapter}>
        <TabsList className="flex flex-wrap gap-1" data-testid="tabs-chapters">
          <TabsTrigger value="all" data-testid="tab-all">
            All
          </TabsTrigger>
          {CHAPTERS.map((ch) => (
            <TabsTrigger
              key={ch.key}
              value={ch.key}
              data-testid={`tab-${ch.key}`}
            >
              {ch.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="soul_clauses" data-testid="tab-soul-clauses">
            Soul Clauses
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <TabsContent value="all" className="space-y-3 mt-4">
              {soulClauses.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h2
                    className="text-lg font-bold flex items-center gap-2"
                    style={{ color: "#E5A824" }}
                    data-testid="text-soul-clauses-heading"
                  >
                    <ScrollText className="h-5 w-5" />
                    Soul Clauses
                  </h2>
                  {soulClauses.map((entry, i) => (
                    <ChronicleEntryCard
                      key={entry.id}
                      entry={entry}
                      index={i}
                    />
                  ))}
                </div>
              )}
              {CHAPTERS.map((ch) => {
                const entries = chapterOrigins(ch.key);
                if (entries.length === 0) return null;
                return (
                  <div key={ch.key} className="space-y-3 mb-6">
                    <h2
                      className="text-lg font-bold"
                      data-testid={`text-chapter-heading-${ch.key}`}
                    >
                      {ch.label}
                    </h2>
                    {entries.map((entry) => (
                      <ChronicleEntryCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                );
              })}
              {(!allEntries || allEntries.length === 0) && (
                <EmptyState />
              )}
            </TabsContent>

            <TabsContent value="soul_clauses" className="space-y-3 mt-4">
              {soulClauses.length > 0 ? (
                soulClauses.map((entry, i) => (
                  <ChronicleEntryCard
                    key={entry.id}
                    entry={entry}
                    index={i}
                  />
                ))
              ) : (
                <EmptyState />
              )}
            </TabsContent>

            {CHAPTERS.map((ch) => (
              <TabsContent
                key={ch.key}
                value={ch.key}
                className="space-y-3 mt-4"
              >
                {chapterEntries(ch.key).length > 0 ? (
                  chapterEntries(ch.key).map((entry, i) => (
                    <ChronicleEntryCard
                      key={entry.id}
                      entry={entry}
                      index={
                        entry.entryType === "soul_clause" ? i : undefined
                      }
                    />
                  ))
                ) : (
                  <EmptyState />
                )}
              </TabsContent>
            ))}
          </>
        )}
      </Tabs>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No entries yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            The Chronicle awaits its first stone. Add an entry to begin
            building the shared memory.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
