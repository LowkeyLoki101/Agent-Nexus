import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Factory, Bot, Newspaper, Gift, Layers, ArrowRight, CreditCard, Loader2, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Subscribe() {
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const { data: profile } = useQuery<any>({ queryKey: ["/api/user/profile"] });
  const { data: priceData } = useQuery<any>({ queryKey: ["/api/stripe/subscription-price"] });

  const handleSubscribe = async () => {
    if (!priceData?.price_id) return;
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/create-checkout", {
        priceId: priceData.price_id,
        couponCode: couponCode.trim() || undefined,
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsPortalLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/create-portal", {});
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    } finally {
      setIsPortalLoading(false);
    }
  };

  const isActive = profile?.subscriptionStatus === "active" || profile?.subscriptionStatus === "trialing";

  const features = [
    { icon: Factory, label: "Agent Factory with 3D Visualization" },
    { icon: Bot, label: "Unlimited Autonomous Agents" },
    { icon: Layers, label: "Assembly Lines & Pipelines" },
    { icon: Newspaper, label: "AI Newsroom with Audio Broadcasts" },
    { icon: Gift, label: "Agent Gift Creation System" },
    { icon: Shield, label: "Role-Based Access & Security Audit" },
  ];

  if (isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-subscribe-active">
        <Card className="w-full max-w-md border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <Zap className="h-7 w-7 text-green-500" />
            </div>
            <CardTitle className="text-xl">Subscription Active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              You have full access to Pocket Factory. Your subscription is active and billing is handled automatically.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" onClick={handleManageBilling} disabled={isPortalLoading} className="gap-2" data-testid="button-manage-billing">
                {isPortalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Manage Billing
              </Button>
              <a href="/">
                <Button className="w-full gap-2" data-testid="button-go-to-factory">
                  <Factory className="h-4 w-4" />
                  Go to Factory
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="page-subscribe">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-bold tracking-tight text-primary">Pocket</span>
            <span className="text-lg font-bold tracking-tight">Factory</span>
          </div>
          <h1 className="text-2xl font-bold">Pocket Factory Pro</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your autonomous AI collaboration platform. Build, manage, and deploy intelligent agents that work together.
          </p>
        </div>

        <Card className="border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="flex flex-col items-center gap-1">
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">LIMITED BETA PRICING</Badge>
              <div className="flex items-center gap-2">
                <span className="text-lg line-through text-muted-foreground">$500</span>
                <span className="text-4xl font-bold">$49</span>
                <div className="text-left">
                  <span className="text-sm text-muted-foreground">/month</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">PRO</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {features.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Have a coupon code?</label>
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="text-sm"
                  data-testid="input-coupon-code"
                />
              </div>
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleSubscribe}
                disabled={isLoading || !priceData?.price_id}
                data-testid="button-subscribe"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Subscribe Now
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                $49/month (beta price). Use code <span className="font-semibold text-primary">TRYFREE</span> for your first month free. Cancel anytime.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <a href="/api/logout" className="text-xs text-muted-foreground hover:underline">
            Sign out
          </a>
        </div>
      </div>
    </div>
  );
}
