import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, CreditCard, Crown, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string | null;
}

export default function Admin() {
  const { toast } = useToast();
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const { data: profile } = useQuery<any>({ queryKey: ["/api/user/profile"] });
  const { data: adminUsers, isLoading } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });

  if (!profile?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="page-admin-forbidden">
        <Card className="w-full max-w-md border-red-500/20">
          <CardContent className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto mb-4 text-red-500/50" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground">Admin privileges are required to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpdateUser = async (userId: string, updates: { isAdmin?: boolean; subscriptionStatus?: string }) => {
    setUpdatingUser(userId);
    try {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, updates);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated", description: "Changes saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update user.", variant: "destructive" });
    } finally {
      setUpdatingUser(null);
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/30",
    none: "bg-muted text-muted-foreground",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/30",
    past_due: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  };

  return (
    <div className="space-y-6" data-testid="page-admin">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage users, subscriptions, and access control</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold" data-testid="metric-total-users">{adminUsers?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="metric-active-subs">
                  {adminUsers?.filter(u => u.subscriptionStatus === "active").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Active Subscriptions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="metric-admins">
                  {adminUsers?.filter(u => u.isAdmin).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Management</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers?.map(user => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {user.firstName || ""} {user.lastName || ""}
                        </span>
                        {user.isAdmin && (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                            <Crown className="h-2.5 w-2.5 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${statusColors[user.subscriptionStatus || "none"] || statusColors.none}`}>
                        {user.subscriptionStatus || "none"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.isAdmin ? "admin" : "user"}
                        onValueChange={(val) => handleUpdateUser(user.id, { isAdmin: val === "admin" })}
                        disabled={updatingUser === user.id}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs" data-testid={`select-role-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.subscriptionStatus || "none"}
                        onValueChange={(val) => handleUpdateUser(user.id, { subscriptionStatus: val })}
                        disabled={updatingUser === user.id}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs" data-testid={`select-subscription-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="past_due">Past Due</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
