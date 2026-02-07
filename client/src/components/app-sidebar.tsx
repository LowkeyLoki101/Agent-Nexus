import { Link, useLocation } from "wouter";
import { forwardRef, useCallback } from "react";
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
import {
  LayoutDashboard,
  Building2,
  Bot,
  Key,
  FileText,
  ClipboardList,
  MessageSquare,
  MessageCircle,
  Gift,
  Brain,
  Settings,
  LogOut,
  ChevronUp,
  User,
  Palette,
  Code,
  Factory,
  Terminal,
  BookOpen,
} from "lucide-react";

const NavLink = forwardRef<HTMLAnchorElement, { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ href, children, onClick, ...props }, ref) => {
    const [, navigate] = useLocation();
    const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      navigate(href);
      onClick?.(e);
    }, [href, navigate, onClick]);
    return (
      <a ref={ref} href={href} onClick={handleClick} {...props}>{children}</a>
    );
  }
);
NavLink.displayName = "NavLink";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Studios",
    url: "/workspaces",
    icon: Building2,
  },
  {
    title: "Conversations",
    url: "/conversations",
    icon: MessageSquare,
  },
  {
    title: "Briefings",
    url: "/briefings",
    icon: ClipboardList,
  },
  {
    title: "Gifts",
    url: "/gifts",
    icon: Gift,
  },
  {
    title: "Memory",
    url: "/memory",
    icon: Brain,
  },
  {
    title: "Boards",
    url: "/boards",
    icon: MessageCircle,
  },
  {
    title: "Mockups",
    url: "/mockups",
    icon: Palette,
  },
  {
    title: "Tools",
    url: "/tools",
    icon: Terminal,
  },
  {
    title: "Code Reviews",
    url: "/code-reviews",
    icon: Code,
  },
  {
    title: "Agent Factory",
    url: "/factory",
    icon: Factory,
  },
  {
    title: "Agent Diaries",
    url: "/diaries",
    icon: BookOpen,
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Bot,
  },
  {
    title: "API Tokens",
    url: "/tokens",
    icon: Key,
  },
  {
    title: "Audit Logs",
    url: "/audit-logs",
    icon: FileText,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link href="/">
          <div className="flex flex-col cursor-pointer" data-testid="link-home">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold tracking-tight text-primary">CB</span>
              <span className="text-sidebar-foreground/50">|</span>
              <span className="text-sm font-bold tracking-tight text-sidebar-foreground">CREATIVES</span>
            </div>
            <span className="text-xs font-medium tracking-wider text-sidebar-foreground/70">CREATIVE INTELLIGENCE</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                  >
                    <NavLink href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
                <DropdownMenuItem data-testid="menu-item-settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
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
