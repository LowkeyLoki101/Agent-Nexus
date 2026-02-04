import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  Key, 
  Search,
  Copy,
  Trash2,
  Clock,
  Activity,
  MoreHorizontal,
  AlertTriangle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { ApiToken, Workspace } from "@shared/schema";

export default function Tokens() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenWorkspace, setNewTokenWorkspace] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: tokens, isLoading } = useQuery<ApiToken[]>({
    queryKey: ["/api/tokens"],
  });

  const { data: workspaces } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; workspaceId: string }) => {
      const response = await apiRequest("POST", "/api/tokens", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      setGeneratedToken(data.token);
      setNewTokenName("");
      setNewTokenWorkspace("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create token",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      return apiRequest("DELETE", `/api/tokens/${tokenId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({
        title: "Token revoked",
        description: "The API token has been revoked successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke token",
        variant: "destructive",
      });
    },
  });

  const filteredTokens = tokens?.filter((token) =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Token copied to clipboard",
    });
  };

  const handleCreateToken = () => {
    if (!newTokenName.trim() || !newTokenWorkspace) {
      toast({
        title: "Validation error",
        description: "Name and workspace are required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({ name: newTokenName, workspaceId: newTokenWorkspace });
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setGeneratedToken(null);
    setNewTokenName("");
    setNewTokenWorkspace("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-tokens-title">
            API Tokens
          </h1>
          <p className="text-muted-foreground">
            Manage access tokens for your agents and integrations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-token">
              <Plus className="h-4 w-4" />
              Create Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            {generatedToken ? (
              <>
                <DialogHeader>
                  <DialogTitle>Token Created</DialogTitle>
                  <DialogDescription>
                    Copy your token now. You won't be able to see it again.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <code className="flex-1 text-sm break-all font-mono">{generatedToken}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(generatedToken)}
                      data-testid="button-copy-token"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 p-3 border border-yellow-500/20 bg-yellow-500/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      This is the only time you'll see this token. Store it securely.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseDialog} data-testid="button-close-dialog">
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Token</DialogTitle>
                  <DialogDescription>
                    Generate a new token for API access
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="token-name">Token Name</Label>
                    <Input
                      id="token-name"
                      placeholder="Production API Key"
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                      data-testid="input-token-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token-workspace">Workspace</Label>
                    <Select value={newTokenWorkspace} onValueChange={setNewTokenWorkspace}>
                      <SelectTrigger data-testid="select-token-workspace">
                        <SelectValue placeholder="Select workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces?.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id}>
                            {ws.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateToken} 
                    disabled={createMutation.isPending}
                    data-testid="button-create-token-submit"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Token"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-tokens"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-60" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTokens && filteredTokens.length > 0 ? (
        <div className="space-y-3">
          {filteredTokens.map((token) => (
            <Card key={token.id} data-testid={`card-token-${token.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{token.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {token.tokenPrefix}...
                        </code>
                        <Badge 
                          variant={token.status === "active" ? "outline" : "secondary"} 
                          className="text-xs capitalize"
                        >
                          {token.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-4 w-4" />
                        <span>{token.usageCount} uses</span>
                      </div>
                      {token.expiresAt && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          <span>Expires {new Date(token.expiresAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => revokeMutation.mutate(token.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Revoke Token
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Key className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No matching tokens" : "No API tokens"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery 
                  ? "Try adjusting your search query"
                  : "Create API tokens to allow agents and integrations to access your workspaces"
                }
              </p>
              {!searchQuery && (
                <Button className="gap-2" onClick={() => setIsDialogOpen(true)} data-testid="button-create-first-token">
                  <Plus className="h-4 w-4" />
                  Create your first token
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
