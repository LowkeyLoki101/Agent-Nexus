import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import type { StorefrontListing } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, ArrowRight, ShoppingCart, Eye, Download, Store, Zap, FileText, MessageSquare, Palette, Shield, ExternalLink, Package, Code, BookOpen, Lightbulb } from "lucide-react";

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

const THUMB_ICONS_MAP: Record<string, typeof Zap> = {
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

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  knowledge: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  template: { bg: "bg-amber-500/10", text: "text-amber-400" },
  automation: { bg: "bg-purple-500/10", text: "text-purple-400" },
  decoration: { bg: "bg-red-500/10", text: "text-red-400" },
};

const TYPE_ICONS: Record<string, typeof Zap> = {
  automation: Zap,
  template: FileText,
  knowledge: MessageSquare,
  decoration: Palette,
};

const TYPE_LABELS: Record<string, { label: string; format: string }> = {
  automation: { label: "Interactive Tool", format: "HTML/CSS/JS micro-app" },
  template: { label: "Template / Prompt Pack", format: "Ready-to-use document or prompt set" },
  knowledge: { label: "Guide / How-To", format: "Actionable guide with steps" },
  decoration: { label: "Creative Asset", format: "Visual or decorative content" },
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
    body: JSON.stringify({ sessionId: getSessionId(), eventType, listingId: listingId || null, eventData }),
  }).catch(() => {});
}

export default function StorefrontListingPage() {
  const [, params] = useRoute("/store/:slug");
  const { toast } = useToast();
  const [buyEmail, setBuyEmail] = useState("");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const slug = params?.slug;

  const { data: listing, isLoading } = useQuery<ListingWithAgent>({
    queryKey: ["/api/storefront/listings", slug],
    enabled: !!slug,
  });

  const { data: relatedListings } = useQuery<ListingWithAgent[]>({
    queryKey: ["/api/storefront/listings"],
  });

  useEffect(() => {
    if (listing) {
      trackEvent("page_view", listing.id, { page: `/store/${slug}` });
      trackEvent("listing_view", listing.id);
    }
  }, [listing?.id, slug]);

  const related = relatedListings?.filter(l => l.agentId === listing?.agentId && l.id !== listing?.id).slice(0, 3) || [];

  const handleCheckout = async () => {
    if (!listing || !buyEmail) return;
    setIsPurchasing(true);
    try {
      trackEvent("buy_click", listing.id);
      trackEvent("checkout_opened", listing.id);
      const res = await fetch(`/api/storefront/checkout/${listing.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: buyEmail }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Checkout Error", description: data.error || "Could not create checkout. Please try again.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Connection Error", description: "Could not reach the server. Please check your connection and try again.", variant: "destructive" });
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #050508 0%, #0a0a12 100%)" }}>
        <div className="max-w-4xl mx-auto px-6 py-16">
          <Skeleton className="h-8 w-64 mb-4 bg-white/5" />
          <Skeleton className="h-4 w-96 mb-8 bg-white/5" />
          <Skeleton className="h-40 w-full bg-white/5" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050508" }}>
        <div className="text-center">
          <Store className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30 font-mono">Listing not found</p>
          <Link href="/store">
            <Button variant="outline" className="mt-4 border-white/10 text-white/60" data-testid="button-back-to-store">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Store
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const colors = TYPE_COLORS[listing.listingType] || TYPE_COLORS.knowledge;
  const TypeIcon = TYPE_ICONS[listing.listingType] || FileText;
  const typeInfo = TYPE_LABELS[listing.listingType] || TYPE_LABELS.knowledge;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #050508 0%, #0a0a12 50%, #0f0f1a 100%)" }}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/store">
          <span className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/60 font-mono mb-8 cursor-pointer" data-testid="link-back-store">
            <ArrowLeft className="w-3 h-3" /> Back to The Exchange
          </span>
        </Link>

        {(() => {
          const h = hashString(listing.id);
          const grad = THUMB_GRADIENTS[h % THUMB_GRADIENTS.length];
          const ThumbIcon = THUMB_ICONS_MAP[listing.listingType] || Lightbulb;
          const pattern = THUMB_PATTERNS[h % THUMB_PATTERNS.length];
          const rotation = (h % 30) - 15;
          return (
            <div
              className="relative w-full h-48 md:h-56 overflow-hidden rounded-xl mb-8"
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
                  className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  <ThumbIcon className="w-10 h-10 text-white/70" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a12] to-transparent" />
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: listing.agentColor || "#E5A824" }}
              />
              <span className="text-sm text-white/50 font-mono">{listing.agentName}</span>
              <Badge className={`${colors.bg} ${colors.text} border-0 text-[10px] uppercase tracking-wider font-mono`}>
                <TypeIcon className="w-3 h-3 mr-1" />
                {listing.listingType}
              </Badge>
            </div>

            <h1 className="text-3xl font-bold text-white/90 mb-4" data-testid="text-listing-title">
              {stripMarkdownHeadings(listing.title)}
            </h1>
            <p className="text-white/40 leading-relaxed mb-6">{listing.description}</p>

            <div className="flex items-center gap-6 text-sm text-white/30 font-mono mb-8 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> {listing.totalViews || 0} views
              </span>
              <span className="flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4" /> {listing.totalPurchases || 0} sold
              </span>
            </div>

            <div className="border border-white/5 rounded-lg bg-[#141422] p-5 mb-6" data-testid="section-what-you-get">
              <h3 className="text-sm font-mono text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                What You Get
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <TypeIcon className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-sm text-white/70 font-medium">{typeInfo.label}</span>
                    <p className="text-xs text-white/30 mt-0.5">{typeInfo.format}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Download className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-sm text-white/70 font-medium">Instant download</span>
                    <p className="text-xs text-white/30 mt-0.5">Delivered to your email immediately after purchase</p>
                  </div>
                </div>
              </div>
            </div>

            {listing.previewContent && (
              <div className="border border-amber-500/20 rounded-lg bg-amber-500/[0.03] p-6 mb-6" data-testid="section-preview">
                <h3 className="text-sm font-mono text-amber-400/80 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </h3>
                <div className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
                  {listing.previewContent}
                </div>
              </div>
            )}

            {listing.tags && listing.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {listing.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-white/40 font-mono">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-1">
            <div className="sticky top-8 border border-white/10 rounded-lg bg-[#141422] p-6">
              <div className="text-3xl font-bold text-white mb-1 font-mono" data-testid="text-listing-price">
                ${((listing.price || 0) / 100).toFixed(2)}
              </div>
              <p className="text-xs text-white/30 mb-6">One-time purchase</p>

              <div className="mb-4">
                <label className="text-xs text-white/40 font-mono block mb-1.5">
                  Email for delivery
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={buyEmail}
                  onChange={(e) => setBuyEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  data-testid="input-listing-email"
                />
                <p className="text-[10px] text-white/20 mt-1.5">We'll send your download link here</p>
              </div>

              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                onClick={handleCheckout}
                disabled={!buyEmail || isPurchasing}
                data-testid="button-listing-buy"
              >
                {isPurchasing ? "Processing..." : "Buy Now"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-white/25 font-mono">
                <Shield className="w-3 h-3" />
                Secure checkout via Stripe
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-16 border-t border-white/5 pt-10">
            <h3 className="text-sm font-mono text-white/40 uppercase tracking-wider mb-6">
              More from {listing.agentName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link key={r.id} href={`/store/${r.slug}`}>
                  <div className="border border-white/5 rounded-lg bg-[#141422] p-4 hover:border-white/10 transition-all cursor-pointer" data-testid={`card-related-${r.id}`}>
                    <h4 className="text-sm font-semibold text-white/80 mb-1">{stripMarkdownHeadings(r.title)}</h4>
                    <p className="text-xs text-white/30 line-clamp-2 mb-2">{r.description}</p>
                    <span className="text-sm font-mono text-white/60">${((r.price || 0) / 100).toFixed(2)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/5 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
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
