import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Workspaces from "@/pages/workspaces";
import WorkspaceNew from "@/pages/workspace-new";
import WorkspaceDetail from "@/pages/workspace-detail";
import Agents from "@/pages/agents";
import AgentNew from "@/pages/agent-new";
import Briefings from "@/pages/briefings";
import BriefingNew from "@/pages/briefing-new";
import BriefingDetail from "@/pages/briefing-detail";
import Tokens from "@/pages/tokens";
import AuditLogs from "@/pages/audit-logs";
import AgentWorld from "@/pages/agent-world";
import Gifts from "@/pages/gifts";
import Products from "@/pages/products";
import AssemblyLinesPage from "@/pages/assembly-lines";
import Library from "@/pages/library";
import Workstation from "@/pages/workstation";
import Boards from "@/pages/boards";
import NotFound from "@/pages/not-found";
import ForgotPassword from "@/pages/forgot-password";
import Subscribe from "@/pages/subscribe";
import Admin from "@/pages/admin";
import { SubscriptionBanner } from "@/components/subscription-banner";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-4 py-3 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
          <SubscriptionBanner />
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedRouter() {
  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={AgentWorld} />
        <Route path="/factory" component={AgentWorld} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/workspaces" component={Workspaces} />
        <Route path="/workspaces/new" component={WorkspaceNew} />
        <Route path="/workspaces/:slug" component={WorkspaceDetail} />
        <Route path="/workspaces/:slug/agents/new" component={AgentNew} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/new" component={AgentNew} />
        <Route path="/agent-world" component={AgentWorld} />
        <Route path="/gifts" component={Gifts} />
        <Route path="/products" component={Products} />
        <Route path="/assembly-lines" component={AssemblyLinesPage} />
        <Route path="/library" component={Library} />
        <Route path="/workstation" component={Workstation} />
        <Route path="/briefings" component={Briefings} />
        <Route path="/briefings/new" component={BriefingNew} />
        <Route path="/briefings/:id" component={BriefingDetail} />
        <Route path="/boards" component={Boards} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/tokens" component={Tokens} />
        <Route path="/audit-logs" component={AuditLogs} />
        <Route path="/admin" component={Admin} />
        <Route path="/subscribe" component={Subscribe} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success" && user) {
      apiRequest("POST", "/api/stripe/sync-subscription", {})
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
          window.history.replaceState({}, "", "/");
        })
        .catch(console.error);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-md mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    if (window.location.pathname === "/forgot-password") {
      return <ForgotPassword />;
    }
    return <Landing />;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-md mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="agenthub-theme">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
