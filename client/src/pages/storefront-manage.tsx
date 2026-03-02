import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { StorefrontListing, Agent, FactorySettings, PriceAdjustment } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Store, Plus, Eye, ShoppingCart, DollarSign, TrendingUp, ExternalLink, Check, X,
  Settings, Trash2, Send, CreditCard, BarChart3, ArrowUpDown, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

export default function StorefrontManage() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListing, setNewListing] = useState({
    title: "",
    description: "",
    listingType: "knowledge" as string,
    price: "",
    agentId: "",
    previewContent: "",
    downloadContent: "",
    tags: "",
    category: "",
  });
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    storefrontName: "",
    storefrontDescription: "",
    storefrontSlug: "",
  });
  const [analyticsListingId, setAnalyticsListingId] = useState<string | null>(null);

  const { data: listings, isLoading: listingsLoading } = useQuery<StorefrontListing[]>({
    queryKey: ["/api/storefront/my-listings"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: factorySettingsData } = useQuery<FactorySettings | null>({
    queryKey: ["/api/storefront/factory-settings"],
  });

  const { data: priceAdjustments } = useQuery<PriceAdjustment[]>({
    queryKey: ["/api/storefront/price-adjustments"],
  });

  const { data: analytics } = useQuery<{ totalViews: number; uniqueVisitors: number; buyClicks: number; purchases: number; conversionRate: number; revenue: number }>({
    queryKey: ["/api/storefront/analytics", analyticsListingId],
    enabled: !!analyticsListingId,
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/storefront/listings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/my-listings"] });
      setShowCreateForm(false);
      setNewListing({ title: "", description: "", listingType: "knowledge", price: "", agentId: "", previewContent: "", downloadContent: "", tags: "", category: "" });
      toast({ title: "Listing created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/storefront/listings/${id}/publish`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/my-listings"] });
      toast({ title: "Listing published" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/storefront/listings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/my-listings"] });
      toast({ title: "Listing archived" });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/storefront/factory-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/factory-settings"] });
      setShowSettingsForm(false);
      toast({ title: "Settings saved" });
    },
  });

  const connectStripeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/storefront/stripe/connect", {
        storefrontName: factorySettingsData?.storefrontName || "My Storefront",
        storefrontSlug: factorySettingsData?.storefrontSlug || `store-${Date.now()}`,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.onboardingUrl) {
        window.open(data.onboardingUrl, "_blank");
      }
      toast({ title: "Stripe Connect", description: "Complete onboarding in the new tab" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const approvePriceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/storefront/price-adjustments/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/price-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/my-listings"] });
      toast({ title: "Price adjustment approved" });
    },
  });

  const rejectPriceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/storefront/price-adjustments/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storefront/price-adjustments"] });
      toast({ title: "Price adjustment rejected" });
    },
  });

  const handleCreateListing = () => {
    if (!newListing.title || !newListing.agentId) {
      toast({ title: "Missing fields", description: "Title and agent are required", variant: "destructive" });
      return;
    }
    createListingMutation.mutate({
      title: newListing.title,
      description: newListing.description,
      listingType: newListing.listingType,
      price: Math.round(parseFloat(newListing.price || "0") * 100),
      agentId: newListing.agentId,
      previewContent: newListing.previewContent,
      downloadContent: newListing.downloadContent,
      tags: newListing.tags ? newListing.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      category: newListing.category || null,
    });
  };

  const totalRevenue = listings?.reduce((sum, l) => sum + (l.revenue || 0), 0) || 0;
  const totalViews = listings?.reduce((sum, l) => sum + (l.totalViews || 0), 0) || 0;
  const totalSold = listings?.reduce((sum, l) => sum + (l.totalPurchases || 0), 0) || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-from-manage">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-storefront-manage-title">
              <Store className="w-6 h-6 text-primary" />
              Storefront Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your listings, analytics, and Stripe connection</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/store", "_blank")} data-testid="button-view-store">
            <ExternalLink className="w-4 h-4 mr-1" /> View Store
          </Button>
          <Button size="sm" onClick={() => setShowCreateForm(true)} data-testid="button-create-listing">
            <Plus className="w-4 h-4 mr-1" /> New Listing
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Eye className="w-4 h-4" /> Total Views
            </div>
            <div className="text-2xl font-bold" data-testid="text-total-views">{totalViews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ShoppingCart className="w-4 h-4" /> Total Sold
            </div>
            <div className="text-2xl font-bold" data-testid="text-total-sold">{totalSold}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" /> Revenue
            </div>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">${(totalRevenue / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CreditCard className="w-4 h-4" /> Stripe
            </div>
            {factorySettingsData?.stripeOnboardingComplete ? (
              <div className="flex items-center gap-1 text-emerald-500">
                <Check className="w-4 h-4" /> Connected
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => connectStripeMutation.mutate()} disabled={connectStripeMutation.isPending} data-testid="button-connect-stripe">
                Connect Stripe
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Factory Settings</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => {
          setSettingsForm({
            storefrontName: factorySettingsData?.storefrontName || "",
            storefrontDescription: factorySettingsData?.storefrontDescription || "",
            storefrontSlug: factorySettingsData?.storefrontSlug || "",
          });
          setShowSettingsForm(!showSettingsForm);
        }} data-testid="button-toggle-settings">
          {showSettingsForm ? "Cancel" : "Edit"}
        </Button>
      </div>

      {showSettingsForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Storefront Name</label>
              <Input
                value={settingsForm.storefrontName}
                onChange={(e) => setSettingsForm({ ...settingsForm, storefrontName: e.target.value })}
                placeholder="My Agent Factory"
                data-testid="input-storefront-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={settingsForm.storefrontDescription}
                onChange={(e) => setSettingsForm({ ...settingsForm, storefrontDescription: e.target.value })}
                placeholder="What your factory produces..."
                data-testid="input-storefront-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug (URL path)</label>
              <Input
                value={settingsForm.storefrontSlug}
                onChange={(e) => setSettingsForm({ ...settingsForm, storefrontSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                placeholder="my-factory"
                data-testid="input-storefront-slug"
              />
            </div>
            <Button onClick={() => saveSettingsMutation.mutate(settingsForm)} disabled={saveSettingsMutation.isPending} data-testid="button-save-settings">
              Save Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create New Listing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={newListing.title}
                  onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                  placeholder="Knowledge Package Title"
                  data-testid="input-listing-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Agent</label>
                <Select value={newListing.agentId} onValueChange={(v) => setNewListing({ ...newListing, agentId: v })}>
                  <SelectTrigger data-testid="select-listing-agent">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={newListing.listingType} onValueChange={(v) => setNewListing({ ...newListing, listingType: v })}>
                  <SelectTrigger data-testid="select-listing-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knowledge">Knowledge</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="automation">Automation</SelectItem>
                    <SelectItem value="decoration">Decoration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Price (USD)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newListing.price}
                  onChange={(e) => setNewListing({ ...newListing, price: e.target.value })}
                  placeholder="4.99"
                  data-testid="input-listing-price"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newListing.description}
                onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                placeholder="What this product offers..."
                data-testid="input-listing-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Preview Content (shown before purchase)</label>
              <Textarea
                value={newListing.previewContent}
                onChange={(e) => setNewListing({ ...newListing, previewContent: e.target.value })}
                placeholder="Teaser content..."
                rows={3}
                data-testid="input-listing-preview"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Download Content (delivered after purchase)</label>
              <Textarea
                value={newListing.downloadContent}
                onChange={(e) => setNewListing({ ...newListing, downloadContent: e.target.value })}
                placeholder="Full content or download link..."
                rows={4}
                data-testid="input-listing-download"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tags (comma-separated)</label>
                <Input
                  value={newListing.tags}
                  onChange={(e) => setNewListing({ ...newListing, tags: e.target.value })}
                  placeholder="ai, automation, writing"
                  data-testid="input-listing-tags"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Input
                  value={newListing.category}
                  onChange={(e) => setNewListing({ ...newListing, category: e.target.value })}
                  placeholder="e.g. Productivity"
                  data-testid="input-listing-category"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateListing} disabled={createListingMutation.isPending} data-testid="button-submit-listing">
                <Plus className="w-4 h-4 mr-1" /> Create Listing
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="w-5 h-5" /> Listings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !listings || listings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No listings yet. Create your first product.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listings.map((listing) => {
                const agent = agents?.find(a => a.id === listing.agentId);
                return (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    data-testid={`row-listing-${listing.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{listing.title}</span>
                        <Badge variant={listing.status === "published" ? "default" : listing.status === "archived" ? "secondary" : "outline"} className="text-[10px]">
                          {listing.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{listing.listingType}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{agent?.name || "Agent"}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{listing.totalViews || 0}</span>
                        <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{listing.totalPurchases || 0}</span>
                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${((listing.revenue || 0) / 100).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm font-mono font-medium">${((listing.price || 0) / 100).toFixed(2)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnalyticsListingId(analyticsListingId === listing.id ? null : listing.id)}
                        data-testid={`button-analytics-${listing.id}`}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                      {listing.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => publishMutation.mutate(listing.id)}
                          disabled={publishMutation.isPending}
                          data-testid={`button-publish-${listing.id}`}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(listing.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${listing.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {analyticsListingId && analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold" data-testid="text-analytics-views">{analytics.totalViews}</div>
                <div className="text-xs text-muted-foreground">Views</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold" data-testid="text-analytics-visitors">{analytics.uniqueVisitors}</div>
                <div className="text-xs text-muted-foreground">Unique Visitors</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold" data-testid="text-analytics-clicks">{analytics.buyClicks}</div>
                <div className="text-xs text-muted-foreground">Buy Clicks</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold" data-testid="text-analytics-purchases">{analytics.purchases}</div>
                <div className="text-xs text-muted-foreground">Purchases</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold" data-testid="text-analytics-conversion">{analytics.conversionRate}%</div>
                <div className="text-xs text-muted-foreground">Conversion</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold" data-testid="text-analytics-revenue">${(analytics.revenue / 100).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {priceAdjustments && priceAdjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5" /> Agent Price Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {priceAdjustments.map((adj) => {
                const listing = listings?.find(l => l.id === adj.listingId);
                const agent = agents?.find(a => a.id === adj.suggestedByAgentId);
                return (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`row-price-adj-${adj.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{listing?.title || "Unknown Listing"}</span>
                        <span className="text-xs text-muted-foreground">by {agent?.name || "Agent"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="line-through text-muted-foreground">${((adj.previousPrice || 0) / 100).toFixed(2)}</span>
                        <span className="font-medium text-primary">→ ${((adj.newPrice || 0) / 100).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{adj.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-600"
                        onClick={() => approvePriceMutation.mutate(adj.id)}
                        disabled={approvePriceMutation.isPending}
                        data-testid={`button-approve-${adj.id}`}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => rejectPriceMutation.mutate(adj.id)}
                        disabled={rejectPriceMutation.isPending}
                        data-testid={`button-reject-${adj.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
