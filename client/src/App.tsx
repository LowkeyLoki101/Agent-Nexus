import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
import Conversations from "@/pages/conversations";
import ConversationNew from "@/pages/conversation-new";
import ConversationDetail from "@/pages/conversation-detail";
import Gifts from "@/pages/gifts";
import GiftNew from "@/pages/gift-new";
import Memory from "@/pages/memory";
import Tokens from "@/pages/tokens";
import AuditLogs from "@/pages/audit-logs";
import MessageBoards from "@/pages/message-boards";
import BoardDetail from "@/pages/board-detail";
import Mockups from "@/pages/mockups";
import CodeReviews from "@/pages/code-reviews";
import AgentRoom from "@/pages/agent-room";
import AgentFactory from "@/pages/agent-factory";
import Tools from "@/pages/tools";
import SharedPost from "@/pages/shared-post";
import AgentDiaries from "@/pages/agent-diaries";
import NotFound from "@/pages/not-found";

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
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedRouter() {
  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/workspaces" component={Workspaces} />
        <Route path="/workspaces/new" component={WorkspaceNew} />
        <Route path="/workspaces/:slug" component={WorkspaceDetail} />
        <Route path="/workspaces/:slug/agents/new" component={AgentNew} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/new" component={AgentNew} />
        <Route path="/agents/:id/room" component={AgentRoom} />
        <Route path="/briefings" component={Briefings} />
        <Route path="/briefings/new" component={BriefingNew} />
        <Route path="/briefings/:id" component={BriefingDetail} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/conversations/new" component={ConversationNew} />
        <Route path="/conversations/:id" component={ConversationDetail} />
        <Route path="/gifts" component={Gifts} />
        <Route path="/gifts/new" component={GiftNew} />
        <Route path="/memory" component={Memory} />
        <Route path="/boards" component={MessageBoards} />
        <Route path="/boards/:id" component={BoardDetail} />
        <Route path="/mockups" component={Mockups} />
        <Route path="/code-reviews" component={CodeReviews} />
        <Route path="/factory" component={AgentFactory} />
        <Route path="/tools" component={Tools} />
        <Route path="/diaries" component={AgentDiaries} />
        <Route path="/tokens" component={Tokens} />
        <Route path="/audit-logs" component={AuditLogs} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

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
    return (
      <Switch>
        <Route path="/shared/:shareId" component={SharedPost} />
        <Route><Landing /></Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/shared/:shareId" component={SharedPost} />
      <Route><AuthenticatedRouter /></Route>
    </Switch>
  );
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
