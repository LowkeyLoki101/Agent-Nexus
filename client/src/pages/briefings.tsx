import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Clock,
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Image,
  Mic,
  Video,
  Newspaper,
  Zap,
  MessageSquare,
  Shield,
  RotateCcw,
  Megaphone,
  Bot,
  Loader2,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import type { Briefing } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ARTICLE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  breaking: { label: "BREAKING", icon: Zap, color: "text-red-500", bg: "bg-red-500/10 border-red-500/30" },
  feature: { label: "FEATURE", icon: Newspaper, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30" },
  interview: { label: "INTERVIEW", icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/30" },
  investigation: { label: "INVESTIGATION", icon: Shield, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
  recap: { label: "RECAP", icon: RotateCcw, color: "text-green-500", bg: "bg-green-500/10 border-green-500/30" },
  bulletin: { label: "BULLETIN", icon: Megaphone, color: "text-primary", bg: "bg-primary/10 border-primary/30" },
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-slate-400",
};

function HeroBroadcast({ briefing }: { briefing: Briefing }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const typeConfig = ARTICLE_TYPE_CONFIG[briefing.articleType || "bulletin"] || ARTICLE_TYPE_CONFIG.bulletin;
  const TypeIcon = typeConfig.icon;

  const generateImage = useMutation({
    mutationFn: () => apiRequest("POST", `/api/briefings/${briefing.id}/generate-image`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings"] });
      toast({ title: "Image generated for broadcast" });
    },
    onError: (e: any) => toast({ title: "Image generation failed", description: e.message, variant: "destructive" }),
  });

  const generateAudio = useMutation({
    mutationFn: () => apiRequest("POST", `/api/briefings/${briefing.id}/generate-audio`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings"] });
      toast({ title: "Audio broadcast generated" });
    },
    onError: (e: any) => toast({ title: "Audio generation failed", description: e.message, variant: "destructive" }),
  });

  const generateVideo = useMutation({
    mutationFn: () => apiRequest("POST", `/api/briefings/${briefing.id}/generate-video`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings"] });
      toast({ title: "Video generation started" });
    },
    onError: (e: any) => toast({ title: "Video generation failed", description: e.message, variant: "destructive" }),
  });

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-gradient-to-br from-card via-card to-primary/5" data-testid="panel-hero-broadcast">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-amber-500 to-primary" />
      
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-6 lg:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30">
              <Radio className="h-3 w-3 text-red-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-500">LIVE</span>
            </div>
            <Badge className={`text-xs ${typeConfig.bg} ${typeConfig.color}`} variant="outline">
              <TypeIcon className="h-3 w-3 mr-1" />
              {typeConfig.label}
            </Badge>
            <div className={`h-2 w-2 rounded-full ${PRIORITY_DOT[briefing.priority] || PRIORITY_DOT.medium}`} />
          </div>
          
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight leading-tight" data-testid="text-hero-title">
            {briefing.title}
          </h1>
          
          <p className="text-muted-foreground text-base lg:text-lg leading-relaxed max-w-2xl">
            {briefing.summary || briefing.content.slice(0, 300)}
          </p>

          {briefing.tags && briefing.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {briefing.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            {briefing.audioUrl ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" className="gap-2" onClick={togglePlay} data-testid="button-play-hero-audio">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? "Pause" : "Play Broadcast"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsMuted(!isMuted); if (audioRef.current) audioRef.current.muted = !isMuted; }} data-testid="button-mute-hero">
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <audio ref={audioRef} src={briefing.audioUrl} onEnded={() => setIsPlaying(false)} />
              </div>
            ) : (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => generateAudio.mutate()} disabled={generateAudio.isPending} data-testid="button-generate-hero-audio">
                {generateAudio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                Generate Audio
              </Button>
            )}
            
            {!briefing.imageUrl && (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => generateImage.mutate()} disabled={generateImage.isPending} data-testid="button-generate-hero-image">
                {generateImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                Generate Image
              </Button>
            )}

            <Button size="sm" variant="outline" className="gap-2" onClick={() => generateVideo.mutate()} disabled={generateVideo.isPending} data-testid="button-generate-hero-video">
              {generateVideo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              Generate Video
            </Button>

            <Link href={`/briefings/${briefing.id}`}>
              <Button size="sm" variant="ghost" className="gap-1" data-testid="button-read-full-story">
                Full Story <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5">
              <Bot className="h-3 w-3" />
              <span>Herald Newsroom</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>{briefing.createdAt ? new Date(briefing.createdAt).toLocaleString() : "Just now"}</span>
            </div>
          </div>
        </div>

        {briefing.imageUrl && (
          <div className="lg:w-96 lg:shrink-0">
            <img 
              src={briefing.imageUrl} 
              alt={briefing.title}
              className="w-full h-48 lg:h-full object-cover"
              data-testid="img-hero-broadcast"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleCard({ briefing }: { briefing: Briefing }) {
  const typeConfig = ARTICLE_TYPE_CONFIG[briefing.articleType || "bulletin"] || ARTICLE_TYPE_CONFIG.bulletin;
  const TypeIcon = typeConfig.icon;
  const { toast } = useToast();

  const generateImage = useMutation({
    mutationFn: () => apiRequest("POST", `/api/briefings/${briefing.id}/generate-image`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings"] });
      toast({ title: "Image generated" });
    },
  });

  const generateAudio = useMutation({
    mutationFn: () => apiRequest("POST", `/api/briefings/${briefing.id}/generate-audio`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefings"] });
      toast({ title: "Audio generated" });
    },
  });

  return (
    <Card className="hover-elevate overflow-hidden group h-full flex flex-col" data-testid={`card-article-${briefing.id}`}>
      {briefing.imageUrl ? (
        <div className="h-40 overflow-hidden">
          <img src={briefing.imageUrl} alt={briefing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      ) : (
        <div className={`h-2 ${typeConfig.color === "text-red-500" ? "bg-red-500" : typeConfig.color === "text-blue-500" ? "bg-blue-500" : typeConfig.color === "text-purple-500" ? "bg-purple-500" : typeConfig.color === "text-amber-500" ? "bg-amber-500" : typeConfig.color === "text-green-500" ? "bg-green-500" : "bg-primary"}`} />
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={`text-[10px] ${typeConfig.bg} ${typeConfig.color}`} variant="outline">
            <TypeIcon className="h-3 w-3 mr-1" />
            {typeConfig.label}
          </Badge>
          <div className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[briefing.priority] || PRIORITY_DOT.medium}`} />
        </div>
        <Link href={`/briefings/${briefing.id}`}>
          <CardTitle className="text-base leading-tight hover:text-primary transition-colors cursor-pointer line-clamp-2" data-testid={`text-article-title-${briefing.id}`}>
            {briefing.title}
          </CardTitle>
        </Link>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-3">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {briefing.summary || briefing.content.slice(0, 150)}
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {briefing.audioUrl && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Volume2 className="h-3 w-3" /> Audio
              </Badge>
            )}
            {briefing.videoUrl && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Video className="h-3 w-3" /> Video
              </Badge>
            )}
            {!briefing.imageUrl && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => generateImage.mutate()} disabled={generateImage.isPending} data-testid={`button-gen-img-${briefing.id}`}>
                {generateImage.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Image className="h-3 w-3" />} +Image
              </Button>
            )}
            {!briefing.audioUrl && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => generateAudio.mutate()} disabled={generateAudio.isPending} data-testid={`button-gen-audio-${briefing.id}`}>
                {generateAudio.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />} +Audio
              </Button>
            )}
          </div>

          {briefing.tags && briefing.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {briefing.tags.slice(0, 3).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{briefing.createdAt ? new Date(briefing.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "recently"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TickerBar({ briefings }: { briefings: Briefing[] }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset(o => o + 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  if (briefings.length === 0) return null;

  const tickerText = briefings.map(b => {
    const typeConfig = ARTICLE_TYPE_CONFIG[b.articleType || "bulletin"];
    return `${typeConfig?.label || "BULLETIN"}: ${b.title}`;
  }).join("  ///  ");

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg overflow-hidden" data-testid="panel-ticker-bar">
      <div className="flex items-center">
        <div className="shrink-0 px-3 py-2 bg-primary/20 flex items-center gap-2">
          <Radio className="h-3 w-3 text-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">LIVE FEED</span>
        </div>
        <div className="flex-1 overflow-hidden py-2 px-4">
          <div className="whitespace-nowrap" style={{ transform: `translateX(-${offset % (tickerText.length * 8)}px)` }}>
            <span className="text-sm font-medium">
              {tickerText}  ///  {tickerText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutoplayQueue({ briefings }: { briefings: Briefing[] }) {
  const audioQueue = briefings.filter(b => b.audioUrl);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentTrack = currentIndex >= 0 ? audioQueue[currentIndex] : null;

  const playQueue = () => {
    if (audioQueue.length === 0) return;
    if (currentIndex < 0) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  };

  const skipForward = () => {
    if (currentIndex < audioQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
    } else {
      setCurrentIndex(-1);
      setIsPlaying(false);
      setProgress(0);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentIndex < 0 && audioQueue.length > 0) {
        setCurrentIndex(0);
      }
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    audioRef.current.src = currentTrack.audioUrl!;
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [currentIndex, currentTrack?.id]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateProgress = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    audio.addEventListener("timeupdate", updateProgress);
    return () => audio.removeEventListener("timeupdate", updateProgress);
  }, []);

  if (audioQueue.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid="panel-autoplay-queue">
      <div className="flex items-center gap-3 p-3">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant={isPlaying ? "default" : "outline"} className="h-8 w-8 p-0" onClick={togglePlay} data-testid="button-autoplay-toggle">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={skipForward} disabled={currentIndex < 0} data-testid="button-autoplay-skip">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-w-0">
          {currentTrack ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Radio className="h-3 w-3 text-red-500 animate-pulse shrink-0" />
                <span className="text-sm font-medium truncate">{currentTrack.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">{currentIndex + 1}/{audioQueue.length}</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{audioQueue.length} broadcasts ready to play</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={playQueue} data-testid="button-play-all">Play All</Button>
            </div>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        onEnded={skipForward}
        data-testid="audio-autoplay"
      />
    </div>
  );
}

export default function Briefings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: briefings, isLoading } = useQuery<Briefing[]>({
    queryKey: ["/api/briefings"],
  });

  const published = briefings?.filter(b => b.status === "published") || [];
  const hero = published.find(b => b.featured) || published[0];
  const articles = published.filter(b => b.id !== hero?.id);

  const filteredArticles = articles.filter((b) => {
    const matchesSearch = !searchQuery || 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || b.articleType === typeFilter;
    return matchesSearch && matchesType;
  });

  const articleTypes = ["all", "breaking", "feature", "interview", "investigation", "recap", "bulletin"];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Newspaper className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-newsroom-title">
              The Newsroom
            </h1>
            <p className="text-sm text-muted-foreground">
              Herald's broadcast headquarters — breaking news, investigations & factory updates
            </p>
          </div>
        </div>
        <Link href="/briefings/new">
          <Button className="gap-2" data-testid="button-create-briefing">
            <Plus className="h-4 w-4" />
            New Story
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-72 rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {hero && <HeroBroadcast briefing={hero} />}

          <TickerBar briefings={published.slice(0, 8)} />

          <AutoplayQueue briefings={published} />

          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-stories"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {articleTypes.map((type) => {
                const config = type !== "all" ? ARTICLE_TYPE_CONFIG[type] : null;
                return (
                  <Button
                    key={type}
                    size="sm"
                    variant={typeFilter === type ? "default" : "outline"}
                    className="text-xs h-8 gap-1"
                    onClick={() => setTypeFilter(type)}
                    data-testid={`button-filter-${type}`}
                  >
                    {config && <config.icon className="h-3 w-3" />}
                    {type === "all" ? "All" : config?.label || type}
                  </Button>
                );
              })}
            </div>
          </div>

          {filteredArticles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredArticles.map((briefing) => (
                <ArticleCard key={briefing.id} briefing={briefing} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="text-center">
                  <Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {searchQuery || typeFilter !== "all" ? "No matching stories" : "No stories yet"}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {searchQuery || typeFilter !== "all"
                      ? "Try adjusting your filters"
                      : "Herald and the newsroom team will publish stories here"
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
