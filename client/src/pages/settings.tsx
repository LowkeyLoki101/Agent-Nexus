import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, Key, BarChart3, DollarSign, Zap, Shield, AlertTriangle } from "lucide-react";

interface UserSettings {
  userId: string;
  useOwnKey: boolean;
  monthlySpendLimitCents: number;
  hasCustomKey: boolean;
  customKeyPreview: string | null;
  updatedAt?: string;
}

interface UserUsage {
  monthlyTokens: number;
  monthlyCostCents: number;
  dailyAvgTokens: number;
  dailyAvgCostCents: number;
  byFeature: Record<string, { tokens: number; costCents: number }>;
  spendLimitCents: number;
  spendPercentUsed: number;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<UserSettings>({
    queryKey: ["/api/user/settings"],
  });

  const { data: usage, isLoading: usageLoading } = useQuery<UserUsage>({
    queryKey: ["/api/user/usage"],
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<{ useOwnKey: boolean; customOpenaiKey: string; monthlySpendLimitCents: number }>) => {
      const res = await apiRequest("PUT", "/api/user/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/usage"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const featureLabels: Record<string, string> = {
    chat: "Agent Chat",
    daemon: "Background Daemon",
    "daemon-storefront": "Storefront Intelligence",
    "command-chat": "Command Center",
    voice: "Voice Chat",
    image: "Image Generation",
    assembly: "Assembly Lines",
    court: "Court Evaluations",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your API key, spending limits, and view usage</p>
        </div>
      </div>

      <Card data-testid="card-usage-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            This Month's Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <p className="text-sm text-muted-foreground">Loading usage data...</p>
          ) : usage ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold" data-testid="text-monthly-tokens">{usage.monthlyTokens.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Tokens This Month</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold" data-testid="text-monthly-cost">{formatCost(usage.monthlyCostCents)}</p>
                  <p className="text-xs text-muted-foreground">Estimated Cost</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold" data-testid="text-daily-avg-tokens">{usage.dailyAvgTokens.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Daily Avg Tokens</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold" data-testid="text-daily-avg-cost">{formatCost(usage.dailyAvgCostCents)}</p>
                  <p className="text-xs text-muted-foreground">Daily Avg Cost</p>
                </div>
              </div>

              {usage.spendLimitCents > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Spending: {formatCost(usage.monthlyCostCents)} of {formatCost(usage.spendLimitCents)}</span>
                    <span>{usage.spendPercentUsed}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${usage.spendPercentUsed > 80 ? "bg-red-500" : usage.spendPercentUsed > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, usage.spendPercentUsed)}%` }}
                      data-testid="progress-spend-usage"
                    />
                  </div>
                </div>
              )}

              {Object.keys(usage.byFeature).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Usage by Feature</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(usage.byFeature)
                      .sort(([, a], [, b]) => b.tokens - a.tokens)
                      .map(([feature, data]) => (
                        <div key={feature} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm" data-testid={`usage-feature-${feature}`}>
                          <span className="text-muted-foreground">{featureLabels[feature] || feature}</span>
                          <div className="text-right">
                            <span className="font-medium">{data.tokens.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground ml-1">({formatCost(data.costCents)})</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No usage data yet</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-api-key-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            API Key
          </CardTitle>
          <CardDescription>
            Manage your API keys for AI providers. When enabled, AI calls will use your keys and costs go directly to your accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use my own API key</Label>
              <p className="text-xs text-muted-foreground">
                {settings?.useOwnKey ? "Your API key is being used for AI calls" : "Using platform API key"}
              </p>
            </div>
            <Switch
              checked={settings?.useOwnKey ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ useOwnKey: checked })}
              disabled={updateSettings.isPending || (!settings?.hasCustomKey && !settings?.useOwnKey)}
              data-testid="switch-use-own-key"
            />
          </div>

          {settings?.hasCustomKey && !showKeyInput && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Shield className="h-4 w-4 text-green-500" />
              <span className="text-sm">Key saved: {settings.customKeyPreview}</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => setShowKeyInput(true)}
                data-testid="button-change-key"
              >
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  updateSettings.mutate({ customOpenaiKey: "", useOwnKey: false });
                  setShowKeyInput(false);
                }}
                data-testid="button-remove-key"
              >
                Remove
              </Button>
            </div>
          )}

          {(!settings?.hasCustomKey || showKeyInput) && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  data-testid="input-api-key"
                />
                <Button
                  onClick={() => {
                    if (apiKeyInput.startsWith("sk-")) {
                      updateSettings.mutate({ customOpenaiKey: apiKeyInput, useOwnKey: true });
                      setApiKeyInput("");
                      setShowKeyInput(false);
                    } else {
                      toast({ title: "Invalid key", description: "API key should start with sk-", variant: "destructive" });
                    }
                  }}
                  disabled={!apiKeyInput || updateSettings.isPending}
                  data-testid="button-save-key"
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your key is stored securely and never shared. You can remove it at any time.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-spending-limits">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Spending Limits
          </CardTitle>
          <CardDescription>
            Set a monthly limit on AI token spending. Once reached, AI features will be paused until the next billing cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Monthly spending limit</Label>
              <Badge variant="outline" data-testid="badge-spend-limit">
                {formatCost(settings?.monthlySpendLimitCents ?? 5000)}
              </Badge>
            </div>
            <Slider
              value={[settings?.monthlySpendLimitCents ?? 5000]}
              onValueChange={([value]) => updateSettings.mutate({ monthlySpendLimitCents: value })}
              min={100}
              max={50000}
              step={100}
              className="w-full"
              data-testid="slider-spend-limit"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$1.00</span>
              <span>$500.00</span>
            </div>
          </div>

          {usage && usage.spendPercentUsed > 80 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                You've used {usage.spendPercentUsed}% of your monthly limit. Consider increasing it or reducing agent activity.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
