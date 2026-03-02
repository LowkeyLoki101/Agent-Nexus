import { storage } from "./storage";

export async function buildStorefrontAnalyticsFeed(agentId: string): Promise<string> {
  const listings = await storage.getStorefrontListingsByAgent(agentId);
  if (listings.length === 0) return "No storefront listings found for this agent.";

  const lines: string[] = ["=== STOREFRONT ANALYTICS FEED ===", ""];

  let totalRevenue = 0;
  let totalViews = 0;
  let totalPurchases = 0;

  for (const listing of listings) {
    const summary = await storage.getStorefrontAnalyticsSummary(listing.id);
    totalRevenue += summary.revenue;
    totalViews += summary.totalViews;
    totalPurchases += summary.purchases;

    lines.push(`--- ${listing.title} (${listing.listingType}) ---`);
    lines.push(`  Status: ${listing.status}`);
    lines.push(`  Price: $${(listing.price / 100).toFixed(2)}`);
    lines.push(`  Views: ${summary.totalViews} | Unique Visitors: ${summary.uniqueVisitors}`);
    lines.push(`  Buy Clicks: ${summary.buyClicks} | Purchases: ${summary.purchases}`);
    lines.push(`  Conversion Rate: ${summary.conversionRate}%`);
    lines.push(`  Revenue: $${(summary.revenue / 100).toFixed(2)}`);

    if (summary.totalViews > 10 && summary.purchases === 0) {
      lines.push(`  ⚠ SIGNAL: High views but zero purchases — consider lowering price`);
    } else if (summary.conversionRate > 20) {
      lines.push(`  📈 SIGNAL: High conversion rate — price increase opportunity`);
    } else if (summary.totalViews === 0 && listing.status === "published") {
      lines.push(`  ⚠ SIGNAL: Zero views — needs promotion or better description`);
    }
    lines.push("");
  }

  lines.push("=== SUMMARY ===");
  lines.push(`Total Listings: ${listings.length}`);
  lines.push(`Total Views: ${totalViews}`);
  lines.push(`Total Purchases: ${totalPurchases}`);
  lines.push(`Total Revenue: $${(totalRevenue / 100).toFixed(2)}`);
  lines.push(`Average Conversion: ${totalViews > 0 ? ((totalPurchases / totalViews) * 100).toFixed(1) : 0}%`);

  return lines.join("\n");
}

export async function analyzeListingForPricing(agentId: string): Promise<{
  listingId: string;
  currentPrice: number;
  suggestedPrice: number;
  reason: string;
} | null> {
  const listings = await storage.getStorefrontListingsByAgent(agentId);
  const publishedListings = listings.filter(l => l.status === "published");
  if (publishedListings.length === 0) return null;

  for (const listing of publishedListings) {
    const summary = await storage.getStorefrontAnalyticsSummary(listing.id);

    if (summary.totalViews > 20 && summary.purchases === 0 && listing.price > 100) {
      return {
        listingId: listing.id,
        currentPrice: listing.price,
        suggestedPrice: Math.round(listing.price * 0.7),
        reason: `${summary.totalViews} views with 0 purchases suggests price resistance at $${(listing.price / 100).toFixed(2)}. Recommending 30% reduction to test demand elasticity.`,
      };
    }

    if (summary.conversionRate > 25 && summary.purchases >= 3) {
      return {
        listingId: listing.id,
        currentPrice: listing.price,
        suggestedPrice: Math.round(listing.price * 1.2),
        reason: `${summary.conversionRate}% conversion with ${summary.purchases} purchases indicates strong demand. Recommending 20% price increase to capture value.`,
      };
    }

    if (summary.buyClicks > 5 && summary.purchases === 0) {
      return {
        listingId: listing.id,
        currentPrice: listing.price,
        suggestedPrice: Math.round(listing.price * 0.85),
        reason: `${summary.buyClicks} buy clicks but 0 completions — checkout friction or price hesitation at $${(listing.price / 100).toFixed(2)}. Recommending 15% reduction.`,
      };
    }
  }

  return null;
}
