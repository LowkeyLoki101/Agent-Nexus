import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, ArrowLeft, Store } from "lucide-react";

export default function StorefrontSuccess() {
  const [downloadToken, setDownloadToken] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const listingSlug = params.get("listing");
  const sessionId = params.get("session_id");

  const { data: listing } = useQuery({
    queryKey: ["/api/storefront/listings", listingSlug],
    enabled: !!listingSlug,
  });

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, #050508 0%, #0a0a12 100%)" }}>
      <div className="max-w-md w-full mx-auto px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-success-title">Purchase Complete</h1>
        <p className="text-white/40 mb-8">
          Thank you for your purchase. Your download will be delivered to your email.
        </p>

        {listing && (
          <div className="border border-white/10 rounded-lg bg-[#141422] p-4 mb-8">
            <h3 className="text-sm font-semibold text-white/80" data-testid="text-purchased-item">{(listing as any).title}</h3>
            <p className="text-xs text-white/40 mt-1">
              ${(((listing as any).price || 0) / 100).toFixed(2)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link href="/store">
            <Button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-mono" data-testid="button-back-to-store">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to The Exchange
            </Button>
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="text-xs font-bold text-white/30">POCKET FACTORY</span>
        </div>
      </div>
    </div>
  );
}
