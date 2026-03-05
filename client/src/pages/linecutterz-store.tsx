import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart,
  Download,
  Search,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Star,
  DollarSign,
  Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LinecuterzProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  minPrice: string;
  maxPrice: string;
  variantCount: number;
  imageCount: number;
  imageUrls: string;
  localImageFile: string;
  productUrl: string;
}

interface StorefrontListing {
  id: string;
  title: string;
  description: string;
  price: number;
  previewContent: string;
  downloadContent: string;
  listingType: string;
  status: string;
  slug: string;
  totalViews: number;
  totalPurchases: number;
  coverImage?: string;
  sourceType?: string;
  sourceId?: string;
  agentId?: string;
  createdAt: string;
}

export default function LinecuterzStore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "marketing">("products");
  const [selectedProduct, setSelectedProduct] = useState<LinecuterzProduct | null>(null);
  const { toast } = useToast();

  const { data: productsData, isLoading: productsLoading } = useQuery<{
    products: LinecuterzProduct[];
    total: number;
  }>({
    queryKey: ["/api/linecutterz/products"],
  });

  const { data: allListings } = useQuery<StorefrontListing[]>({
    queryKey: ["/api/storefront/listings"],
  });
  const listings = (allListings || []).filter(
    (l) => l.sourceType === "linecutterz_marketing"
  );

  const checkoutMutation = useMutation({
    mutationFn: async (listing: StorefrontListing) => {
      const resp = await apiRequest("POST", "/api/linecutterz/checkout", {
        listingId: listing.id,
      });
      return resp.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({ title: "Checkout failed", description: "Please try again", variant: "destructive" });
    },
  });

  const products = productsData?.products || [];
  const filteredProducts = searchQuery
    ? products.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const marketingListings = listings;

  return (
    <div className="space-y-6" data-testid="page-linecutterz-store">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-store-title">
            Line Cutterz Marketing Store
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated marketing content for LineCutterz products. Buy ready-made Facebook posts, articles, and social media kits.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {products.length} products
        </Badge>
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "products" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("products")}
          data-testid="tab-products"
        >
          <ShoppingCart className="h-4 w-4 mr-1" />
          Product Catalog
        </Button>
        <Button
          variant={activeTab === "marketing" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("marketing")}
          data-testid="tab-marketing"
        >
          <FileText className="h-4 w-4 mr-1" />
          Marketing Content
          {marketingListings.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {marketingListings.length}
            </Badge>
          )}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={activeTab === "products" ? "Search products..." : "Search marketing content..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      {activeTab === "products" && (
        <div>
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedProduct(selectedProduct?.id === product.id ? null : product)}
                  data-testid={`card-product-${product.id}`}
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.localImageFile ? (
                      <img
                        src={`/linecutterz-images/${product.localImageFile}`}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge className="text-[10px] bg-black/60 text-white border-0">
                        ${product.minPrice}{product.minPrice !== product.maxPrice ? ` - $${product.maxPrice}` : ""}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="text-sm font-medium line-clamp-2" data-testid={`text-product-title-${product.id}`}>
                      {product.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}
                      </span>
                      {product.productUrl && (
                        <a
                          href={product.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`link-product-${product.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </div>
                  </CardContent>

                  {selectedProduct?.id === product.id && (
                    <div className="border-t px-3 py-2 bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        Marketing content for this product will be available in the Marketing Content tab once agents create it.
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "marketing" && (
        <div>
          {marketingListings.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                No marketing content yet
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-md mx-auto">
                AI agents are creating Facebook posts, articles, and social media kits for LineCutterz products. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketingListings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden" data-testid={`card-listing-${listing.id}`}>
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {listing.coverImage ? (
                      <>
                        <img
                          src={listing.coverImage}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-4xl font-bold text-white/20 rotate-[-30deg] select-none pointer-events-none tracking-widest">
                            PREVIEW
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <FileText className="h-12 w-12 text-muted-foreground/30" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl font-bold text-muted-foreground/10 rotate-[-30deg] select-none pointer-events-none tracking-widest">
                            PREVIEW
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge className="text-[10px]">
                        {listing.listingType}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-medium line-clamp-2" data-testid={`text-listing-title-${listing.id}`}>
                        {listing.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {listing.description || listing.previewContent?.slice(0, 100)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="text-lg font-bold">{((listing.price || 299) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" /> {listing.totalViews || 0}
                        <Star className="h-3 w-3" /> {listing.totalPurchases || 0} sold
                      </div>
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={() => checkoutMutation.mutate(listing)}
                      disabled={checkoutMutation.isPending}
                      data-testid={`button-buy-${listing.id}`}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                      Buy Now — ${((listing.price || 299) / 100).toFixed(2)}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
