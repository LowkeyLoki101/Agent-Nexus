import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, User, Mail } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: async (data: { email?: string; firstName?: string; lastName?: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/user", data);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Record<string, string> = {};
    if (email !== (user?.email || "")) updates.email = email;
    if (firstName !== (user?.firstName || "")) updates.firstName = firstName;
    if (lastName !== (user?.lastName || "")) updates.lastName = lastName;

    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes", description: "Nothing to update." });
      return;
    }

    updateProfile.mutate(updates);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and profile</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Update your name and email address</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  data-testid="input-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  data-testid="input-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                data-testid="input-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
              <p className="text-xs text-muted-foreground">
                This email is used for your account identity on this platform.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={updateProfile.isPending}
                data-testid="button-save-profile"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Info</CardTitle>
          <CardDescription>Read-only account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">User ID</span>
            <code className="text-sm font-mono bg-muted px-2 py-1 rounded" data-testid="text-user-id">
              {user?.id}
            </code>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm" data-testid="text-member-since">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
