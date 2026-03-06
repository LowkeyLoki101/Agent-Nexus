import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Bot,
  Key,
  FileText,
  Settings,
  LogOut,
  ChevronUp,
  User,
  Globe,
  Gift,
  Package,
  Factory,
  BookOpen,
  Wrench,
  Newspaper,
  MessageCircle,
  Shield,
  CreditCard,
  Activity,
  Code2,
  Hammer,
  GraduationCap,
  ShoppingBag,
  ScrollText,
  MessageSquare,
  Store,
  BarChart3,
} from "lucide-react";

const factoryItems = [
  { title: "Agent Factory", url: "/", icon: Globe },
  { title: "Newsroom", url: "/briefings", icon: Newspaper },
  { title: "Gifts", url: "/gifts", icon: Gift },
];

const communityItems = [
  { title: "Message Boards", url: "/boards", icon: MessageCircle },
  { title: "Discussions", url: "/discussions", icon: MessageSquare },
];

const operationsItems = [
  { title: "Departments", url: "/workspaces", icon: Building2 },
  { title: "Agents", url: "/agents", icon: Bot },
  { title: "Assembly Lines", url: "/assembly-lines", icon: Factory },
  { title: "Products", url: "/products", icon: Package },
];

const toolsItems = [
  { title: "Strategy Projects", url: "/strategy-projects", icon: BarChart3 },
  { title: "Sandbox", url: "/sandbox", icon: Code2 },
  { title: "Tool Registry", url: "/tools", icon: Hammer },
  { title: "Heatmap", url: "/heatmap", icon: Activity },
  { title: "University", url: "/university", icon: GraduationCap },
  { title: "Code Shop", url: "/workstation", icon: Wrench },
  { title: "eBook Library", url: "/library", icon: BookOpen },
  { title: "Storefront", url: "/storefront", icon: Store },
];

const governanceItems = [
  { title: "API Tokens", url: "/tokens", icon: Key },
  { title: "Audit Logs", url: "/audit-logs", icon: FileText },
  { title: "Chronicle", url: "/chronicle", icon: ScrollText },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: profile } = useQuery<any>({ queryKey: ["/api/user/profile"] });

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const renderGroup = (label: string, items: typeof factoryItems) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/">
          <div className="flex flex-col cursor-pointer" data-testid="link-home">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold tracking-tight text-sidebar-foreground">Pocket</span>
              <span className="text-sm font-bold tracking-tight text-primary">Factory</span>
            </div>
            <span className="text-xs font-medium tracking-wider text-sidebar-foreground/70">CREATIVE INTELLIGENCE</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Factory", factoryItems)}
        {renderGroup("Community", communityItems)}
        {renderGroup("Operations", operationsItems)}
        {renderGroup("Tools", toolsItems)}
        {renderGroup("Governance", governanceItems)}
        {profile?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")}>
                    <Link href="/admin" data-testid="nav-admin-panel">
                      <Shield className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/subscribe")}>
                    <Link href="/subscribe" data-testid="nav-billing">
                      <CreditCard className="h-4 w-4" />
                      <span>Billing</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/settings")}>
                    <Link href="/settings" data-testid="nav-settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user?.firstName 
                        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
                        : user?.email || "User"}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {user?.email || ""}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings" data-testid="menu-item-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { window.location.href = "/api/logout"; }}
                  data-testid="menu-item-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
