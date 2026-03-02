import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, CreditCard, ArrowRight, Loader2, X, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function SubscriptionBanner() {
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: profile } = useQuery<any>({ queryKey: ["/api/user/profile"] });
  const { data: priceData } = useQuery<any>({ queryKey: ["/api/stripe/subscription-price"] });

  if (!profile) return null;
  if (profile.isAdmin) return null;
  if (profile.subscriptionStatus === "active" || profile.subscriptionStatus === "trialing") return null;
  if (dismissed) return null;

  const handleSubscribe = async () => {
    if (!priceData?.price_id) return;
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/create-checkout", {
        priceId: priceData.price_id,
        couponCode: couponCode.trim() || undefined,
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sticky bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" data-testid="subscription-banner">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">Upgrade to Pro</span>
                <Badge variant="outline" className="text-[10px] shrink-0">90-day free trial</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Unlock full platform access with unlimited agents, assembly lines, and more
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setExpanded(!expanded)}
              data-testid="button-expand-banner"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              onClick={handleSubscribe}
              disabled={isLoading || !priceData?.price_id}
              className="gap-1.5"
              data-testid="button-banner-subscribe"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Start Free Trial
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={() => setDismissed(true)}
              data-testid="button-dismiss-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Have a coupon code?</label>
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-banner-coupon"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSubscribe}
              disabled={isLoading || !priceData?.price_id}
              className="gap-1.5"
              data-testid="button-banner-subscribe-coupon"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              Apply & Subscribe
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
