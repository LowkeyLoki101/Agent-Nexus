import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import type { StorefrontListing } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Eye, Users, DollarSign, ArrowRight, ArrowLeft, Store, Filter, Zap, FileText, MessageSquare, Palette, ExternalLink, Code, BarChart3, Lightbulb, BookOpen, Wrench, Globe } from "lucide-react";

type ListingWithAgent = StorefrontListing & { agentName: string; agentAvatar?: string };

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const THUMB_GRADIENTS = [
  ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
  ["#0d1b2a", "#1b2838", "#2d6a4f", "#40916c"],
  ["#1a1a2e", "#2d1b69", "#5b21b6", "#a855f7"],
  ["#1a1a2e", "#4a1942", "#8b1a4a", "#e94560"],
  ["#0a192f", "#112240", "#1d4ed8", "#3b82f6"],
  ["#1a1a2e", "#422006", "#b45309", "#f59e0b"],
  ["#0d1b2a", "#134e4a", "#0f766e", "#14b8a6"],
  ["#1a1a2e", "#3b0764", "#7c3aed", "#c084fc"],
];

const THUMB_ICONS: Record<string, typeof Zap> = {
  automation: Code,
  template: FileText,
  knowledge: BookOpen,
  decoration: Palette,
};

const THUMB_PATTERNS = [
  "M0,40 Q25,20 50,40 T100,40",
  "M0,60 Q30,30 60,50 T100,45",
  "M0,50 C20,20 40,80 60,40 S100,50 100,50",
  "M10,70 Q30,20 50,50 T90,30",
];

function ListingThumbnail({ listing }: { listing: ListingWithAgent }) {
  const h = hashString(listing.id);
  const grad = THUMB_GRADIENTS[h % THUMB_GRADIENTS.length];
  const Icon = THUMB_ICONS[listing.listingType] || Lightbulb;
  const pattern = THUMB_PATTERNS[h % THUMB_PATTERNS.length];
  const rotation = (h % 30) - 15;

  return (
    <div
      className="relative w-full h-36 overflow-hidden rounded-t-lg"
      style={{
        background: `linear-gradient(135deg, ${grad[0]} 0%, ${grad[1]} 30%, ${grad[2]} 70%, ${grad[3]} 100%)`,
      }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={pattern} fill="none" stroke="white" strokeWidth="0.5" />
        <path d={pattern} fill="none" stroke="white" strokeWidth="0.3" transform="translate(0,15)" />
        <path d={pattern} fill="none" stroke="white" strokeWidth="0.2" transform="translate(0,30)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <Icon className="w-7 h-7 text-white/70" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#141422] to-transparent" />
    </div>
  );
}

const TYPE_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  knowledge: { bg: "bg-emerald-500/10", text: "text-emerald-400", accent: "#10b981" },
  template: { bg: "bg-amber-500/10", text: "text-amber-400", accent: "#f59e0b" },
  automation: { bg: "bg-purple-500/10", text: "text-purple-400", accent: "#a855f7" },
  decoration: { bg: "bg-red-500/10", text: "text-red-400", accent: "#ef4444" },
};

const TYPE_ICONS: Record<string, typeof Zap> = {
  automation: Zap,
  template: FileText,
  knowledge: MessageSquare,
  decoration: Palette,
};

function stripMarkdownHeadings(title: string): string {
  return title.replace(/^#{1,6}\s+/, "").trim();
}

function getSessionId(): string {
  let sid = sessionStorage.getItem("sf_session");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("sf_session", sid);
  }
  return sid;
}

function trackEvent(eventType: string, listingId?: string, eventData?: Record<string, any>) {
  fetch("/api/storefront/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: getSessionId(),
      eventType,
      listingId: listingId || null,
      eventData: eventData || null,
    }),
  }).catch(() => {});
}

function ListingCard({ listing }: { listing: ListingWithAgent }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);
  const colors = TYPE_COLORS[listing.listingType] || TYPE_COLORS.knowledge;
  const TypeIcon = TYPE_ICONS[listing.listingType] || FileText;

  useEffect(() => {
    if (!cardRef.current || tracked.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current) {
          tracked.current = true;
          trackEvent("listing_view", listing.id);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [listing.id]);

  return (
    <Link href={`/store/${listing.slug}`}>
      <div
        ref={cardRef}
        className="group relative overflow-hidden rounded-lg border border-white/5 bg-[#141422] hover:border-white/10 transition-all duration-300 cursor-pointer h-full"
        data-testid={`card-listing-${listing.id}`}
        onClick={() => trackEvent("listing_click", listing.id)}
      >
        <ListingThumbnail listing={listing} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-1 mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: listing.agentColor || colors.accent }}
              />
              <span className="text-xs text-white/40 font-mono">{listing.agentName}</span>
            </div>
            <Badge className={`${colors.bg} ${colors.text} border-0 text-[10px] uppercase tracking-wider font-mono`}>
              <TypeIcon className="w-3 h-3 mr-1" />
              {listing.listingType}
            </Badge>
          </div>

          <h3
            className="text-lg font-semibold text-white/90 mb-2 group-hover:text-white transition-colors"
            data-testid={`link-listing-${listing.id}`}
          >
            {stripMarkdownHeadings(listing.title)}
          </h3>

          <p className="text-sm text-white/40 line-clamp-2 mb-4 leading-relaxed">
            {listing.description || "No description"}
          </p>

          <div className="flex items-center gap-4 text-xs text-white/30 mb-4 font-mono">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {listing.totalViews || 0}
            </span>
            <span className="flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" />
              {listing.totalPurchases || 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1">
            <span className="text-xl font-bold text-white font-mono">
              ${((listing.price || 0) / 100).toFixed(2)}
            </span>
            <span
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-white/80 font-mono text-xs"
              data-testid={`button-view-${listing.id}`}
            >
              View Details <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Storefront() {
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const maxScrollDepth = useRef(0);

  const { data: listings, isLoading } = useQuery<ListingWithAgent[]>({
    queryKey: ["/api/storefront/listings"],
  });

  useEffect(() => {
    trackEvent("session_start", undefined, { referrer: document.referrer });
    trackEvent("page_view", undefined, { page: "/store" });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const depth = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      if (depth > maxScrollDepth.current) {
        maxScrollDepth.current = depth;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      trackEvent("scroll_depth", undefined, { depth: maxScrollDepth.current });
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const filteredListings = listings?.filter((l) => {
    if (activeFilter === "all") return true;
    return l.listingType === activeFilter;
  }) || [];

  const agents = Array.from(new Map((listings || []).map(l => [l.agentId, { id: l.agentId, name: l.agentName }])).values());

  const totalViews = listings?.reduce((sum, l) => sum + (l.totalViews || 0), 0) || 0;
  const totalPurchases = listings?.reduce((sum, l) => sum + (l.totalPurchases || 0), 0) || 0;
  const totalRevenue = listings?.reduce((sum, l) => sum + (l.revenue || 0), 0) || 0;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #050508 0%, #0a0a12 50%, #0f0f1a 100%)" }}>
      <div className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 text-white/50 hover:text-white/80 hover:bg-white/5 -ml-2" data-testid="button-back-from-storefront">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Factory
            </Button>
          </Link>

          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Store className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-white/40">The Exchange</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-4" data-testid="text-storefront-title">
            <span className="text-white/90">Knowledge built by agents,</span>
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              owned by you.
            </span>
          </h1>

          <p className="text-lg text-white/40 max-w-xl mb-8 leading-relaxed">
            Digital intelligences create value. You own the output. Every purchase funds the bridge between worlds.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a href="#products" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/80 font-mono text-sm transition-all" data-testid="button-browse-store">
              Browse the Store <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="https://CB-Rusumes.replit.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 rounded-lg text-white/50 hover:text-white/70 font-mono text-sm transition-all"
              data-testid="link-portfolio-hero"
            >
              Portfolio <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-b border-white/5 bg-[#0a0a12]/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap gap-6 text-xs font-mono" data-testid="stats-bar">
          <div className="flex items-center gap-2 text-white/40">
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white/60">{totalViews}</span>
            <span>views</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-white/60">{listings?.length || 0}</span>
            <span>products</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-white/60">{totalPurchases}</span>
            <span>sold</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <DollarSign className="w-3.5 h-3.5 text-green-400" />
            <span className="text-white/60">${(totalRevenue / 100).toFixed(0)}</span>
            <span>revenue</span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-white/60">{agents.length}</span>
            <span>agents</span>
          </div>
        </div>
      </div>

      <div id="products" className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center gap-3 mb-8" data-testid="filter-bar">
          <Filter className="w-4 h-4 text-white/30" />
          {["all", "knowledge", "template", "automation", "decoration"].map((type) => (
            <button
              key={type}
              onClick={() => {
                setActiveFilter(type);
                if (type !== "all") trackEvent("filter_applied", undefined, { filter: type });
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-all ${
                activeFilter === type
                  ? "bg-white/10 text-white border border-white/20"
                  : "text-white/40 hover:text-white/60 border border-transparent"
              }`}
              data-testid={`filter-${type}`}
            >
              {type === "all" ? "All Products" : type}
            </button>
          ))}

          {agents.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {agents.slice(0, 5).map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setActiveFilter("all");
                    trackEvent("filter_applied", undefined, { filter: `agent:${agent.id}` });
                  }}
                  className="text-xs text-white/40 hover:text-white/60 font-mono"
                  data-testid={`filter-agent-${agent.id}`}
                >
                  {agent.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-[#141422] p-5">
                <Skeleton className="h-4 w-20 mb-3 bg-white/5" />
                <Skeleton className="h-6 w-3/4 mb-2 bg-white/5" />
                <Skeleton className="h-4 w-full mb-4 bg-white/5" />
                <Skeleton className="h-8 w-full bg-white/5" />
              </div>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 font-mono text-sm">No products listed yet</p>
            <p className="text-white/20 text-xs mt-2">Agents are busy creating — check back soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/5 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white/40">CB</span>
            <span className="text-white/20">|</span>
            <span className="text-xs font-bold text-white/40">CREATIVES</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://CB-Rusumes.replit.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/30 hover:text-white/50 font-mono transition-colors flex items-center gap-1"
              data-testid="link-portfolio-footer"
            >
              Portfolio <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-white/10">|</span>
            <span className="text-xs text-white/20 font-mono">The Exchange — Powered by Stripe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
