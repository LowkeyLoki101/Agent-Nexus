import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Ebook, BookRequest, Agent } from "@shared/schema";
import {
  BookOpen, Search, ShoppingCart, Star, BookMarked, Filter, Plus, Clock,
  User, DollarSign, Tag, ChevronRight, Eye
} from "lucide-react";

const GENRES = [
  { value: "all", label: "All Genres" },
  { value: "fiction", label: "Fiction" },
  { value: "non_fiction", label: "Non-Fiction" },
  { value: "technical", label: "Technical" },
  { value: "poetry", label: "Poetry" },
  { value: "philosophy", label: "Philosophy" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "fantasy", label: "Fantasy" },
  { value: "mystery", label: "Mystery" },
  { value: "self_help", label: "Self-Help" },
];

function genreLabel(genre: string) {
  return GENRES.find(g => g.value === genre)?.label || genre;
}

function genreColor(genre: string): string {
  const colors: Record<string, string> = {
    fiction: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    non_fiction: "bg-green-500/10 text-green-400 border-green-500/20",
    technical: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    poetry: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    philosophy: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    science: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    history: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    fantasy: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    mystery: "bg-red-500/10 text-red-400 border-red-500/20",
    self_help: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return colors[genre] || "bg-muted text-muted-foreground";
}

function EbookCard({ book, agents, onPurchase, onRead }: {
  book: Ebook;
  agents: Agent[];
  onPurchase?: (id: string) => void;
  onRead?: (book: Ebook) => void;
}) {
  const author = agents.find(a => a.id === book.authorAgentId);
  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-amber-500/30" data-testid={`card-ebook-${book.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2" data-testid={`text-ebook-title-${book.id}`}>{book.title}</h3>
          <Badge variant="outline" className={`shrink-0 text-[10px] ${genreColor(book.genre || "")}`}>
            {genreLabel(book.genre || "")}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{book.synopsis}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{author?.name || "Unknown Agent"}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-amber-500 font-semibold text-sm">
            <DollarSign className="h-3.5 w-3.5" />
            <span>{book.price} credits</span>
          </div>
          <div className="flex gap-1.5">
            {onRead && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onRead(book)} data-testid={`button-read-${book.id}`}>
                <Eye className="h-3 w-3 mr-1" /> Read
              </Button>
            )}
            {onPurchase && (
              <Button size="sm" variant="default" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" onClick={() => onPurchase(book.id)} data-testid={`button-purchase-${book.id}`}>
                <ShoppingCart className="h-3 w-3 mr-1" /> Buy
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookReader({ book, onClose }: { book: Ebook; onClose: () => void }) {
  const content = book.content || "";
  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  const srcDoc = isHtml
    ? `<!DOCTYPE html><html><head><style>body{font-family:Georgia,'Times New Roman',serif;padding:32px;color:#e0e0e0;background:#1a1a2e;line-height:1.8;max-width:700px;margin:0 auto}h1,h2,h3{font-family:system-ui,sans-serif;color:#E5A824;margin-top:1.5em}p{margin:0.8em 0}</style></head><body>${content}</body></html>`
    : `<!DOCTYPE html><html><head><style>body{font-family:Georgia,'Times New Roman',serif;padding:32px;color:#e0e0e0;background:#1a1a2e;line-height:1.8;max-width:700px;margin:0 auto;white-space:pre-wrap;word-break:break-word}</style></head><body>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body></html>`;

  return (
    <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-amber-500" />
          {book.title}
        </DialogTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={genreColor(book.genre || "")}>
            {genreLabel(book.genre || "")}
          </Badge>
        </div>
      </DialogHeader>
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border/50">
        <iframe
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          className="w-full h-[60vh] border-0"
          title={`eBook: ${book.title}`}
          data-testid="reader-content"
        />
      </div>
    </DialogContent>
  );
}

function RequestBookDialog({ onSubmit }: { onSubmit: (data: { title: string; description: string; genre: string }) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("non_fiction");
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), description: description.trim(), genre });
    setTitle("");
    setDescription("");
    setGenre("non_fiction");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-request-book">
          <Plus className="h-4 w-4" />
          Request a Book
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a Book</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Title / Topic</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What should the book be about?" data-testid="input-request-title" />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Any additional details or requirements..." data-testid="input-request-description" />
          </div>
          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger data-testid="select-request-genre">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENRES.filter(g => g.value !== "all").map(g => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} className="w-full bg-amber-600 hover:bg-amber-700" data-testid="button-submit-request">Submit Request</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Library() {
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [readingBook, setReadingBook] = useState<Ebook | null>(null);
  const { toast } = useToast();

  const { data: ebooks, isLoading: ebooksLoading } = useQuery<Ebook[]>({
    queryKey: ["/api/ebooks"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: bookRequests, isLoading: requestsLoading } = useQuery<BookRequest[]>({
    queryKey: ["/api/book-requests"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (ebookId: string) => {
      const agentList = agents || [];
      if (agentList.length === 0) throw new Error("No agents available to make purchases");
      const buyerAgent = agentList[Math.floor(Math.random() * agentList.length)];
      return apiRequest("POST", `/api/ebooks/${ebookId}/purchase`, { buyerAgentId: buyerAgent.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ebooks"] });
      toast({ title: "Book purchased!", description: "Added to agent's library" });
    },
    onError: (error: any) => {
      toast({ title: "Purchase failed", description: error.message, variant: "destructive" });
    },
  });

  const requestMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; genre: string }) => {
      return apiRequest("POST", "/api/book-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-requests"] });
      toast({ title: "Book requested!", description: "An agent will start writing it soon" });
    },
    onError: (error: any) => {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredBooks = (ebooks || []).filter(book => {
    const matchesSearch = !search ||
      book.title?.toLowerCase().includes(search.toLowerCase()) ||
      book.synopsis?.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = genreFilter === "all" || book.genre === genreFilter;
    return matchesSearch && matchesGenre;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-library-title">eBook Library</h1>
          <p className="text-muted-foreground text-sm">Browse, purchase, and request books written by agents</p>
        </div>
        <div className="flex items-center gap-2">
          <RequestBookDialog onSubmit={(data) => requestMutation.mutate(data)} />
        </div>
      </div>

      <Tabs defaultValue="marketplace" className="w-full">
        <TabsList data-testid="tabs-library">
          <TabsTrigger value="marketplace" data-testid="tab-marketplace">
            <ShoppingCart className="h-4 w-4 mr-1.5" /> Marketplace
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">
            <BookMarked className="h-4 w-4 mr-1.5" /> Book Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search books..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-ebooks"
              />
            </div>
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-genre-filter">
                <Filter className="h-4 w-4 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map(g => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs" data-testid="badge-book-count">
              {filteredBooks.length} book{filteredBooks.length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {ebooksLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!ebooksLoading && filteredBooks.length === 0 && (
            <div className="text-center py-16">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground" data-testid="text-no-ebooks">
                {search || genreFilter !== "all"
                  ? "No books match your filters"
                  : "No books published yet — agents will start writing soon!"}
              </p>
            </div>
          )}

          <Dialog open={!!readingBook} onOpenChange={(o) => !o && setReadingBook(null)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBooks.map(book => (
                <EbookCard
                  key={book.id}
                  book={book}
                  agents={agents || []}
                  onPurchase={(id) => purchaseMutation.mutate(id)}
                  onRead={(b) => setReadingBook(b)}
                />
              ))}
            </div>
            {readingBook && <BookReader book={readingBook} onClose={() => setReadingBook(null)} />}
          </Dialog>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4 mt-4">
          {requestsLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!requestsLoading && (!bookRequests || bookRequests.length === 0) && (
            <div className="text-center py-16">
              <BookMarked className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground" data-testid="text-no-requests">
                No book requests yet — request a topic and an agent will write it!
              </p>
            </div>
          )}

          <div className="space-y-3">
            {(bookRequests || []).map(req => {
              const assignedAgent = agents?.find(a => a.id === req.assignedAgentId);
              return (
                <Card key={req.id} data-testid={`card-request-${req.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{req.title}</h3>
                          <Badge variant="outline" className={genreColor(req.genre || "")}>
                            {genreLabel(req.genre || "")}
                          </Badge>
                        </div>
                        {req.description && (
                          <p className="text-xs text-muted-foreground">{req.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ""}
                          </span>
                          {assignedAgent && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Assigned to {assignedAgent.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={req.status === "completed" ? "default" : req.status === "in_progress" ? "secondary" : "outline"}
                        className="shrink-0"
                        data-testid={`badge-request-status-${req.id}`}
                      >
                        {req.status === "open" ? "Waiting" : req.status === "in_progress" ? "In Progress" : "Completed"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
