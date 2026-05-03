import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  List,
  BookOpen,
  AlertCircle,
  PenTool,
  Calendar,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/constants";

// Brand mark — design system: stacked-square + check, single-color via currentColor.
// Source of truth: Design System/assets/logo-mono.svg
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="EDN Tracker"
    >
      <rect x="6" y="14" width="40" height="44" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <rect x="18" y="6" width="40" height="44" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M27 28 L34 35 L48 21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/pdfs", label: "PDFs", icon: FileText },
  { to: "/items", label: "EDN Items", icon: List },
  { to: "/matieres", label: "Matières", icon: BookOpen },
  { to: "/errors", label: "Error Notebook", icon: AlertCircle },
  { to: "/diagrams", label: "Schémas", icon: PenTool },
  { to: "/planning", label: "Planning", icon: Calendar },
  { to: "/anki", label: "Anki", icon: CreditCard },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const location = useLocation();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200",
        sidebarCollapsed ? "w-14" : "w-56"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <BrandMark className="h-6 w-6 shrink-0 text-sidebar-primary" />
          {!sidebarCollapsed && (
            <span className="font-semibold text-sidebar-foreground truncate text-sm">
              {APP_NAME}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="ml-auto h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-0.5 px-2">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);

            const link = (
              <NavLink
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-primary"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{label}</span>}
              </NavLink>
            );

            if (sidebarCollapsed) {
              return (
                <Tooltip key={to} delayDuration={0}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={to}>{link}</div>;
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Settings */}
      <div className="px-2 py-2 shrink-0">
        {sidebarCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to="/settings"
                className={cn(
                  "flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent",
                  location.pathname === "/settings" && "bg-sidebar-accent text-sidebar-primary"
                )}
              >
                <Settings className="h-4 w-4" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <NavLink
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              "text-sidebar-foreground hover:bg-sidebar-accent",
              location.pathname === "/settings" && "bg-sidebar-accent text-sidebar-primary"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </NavLink>
        )}
      </div>
    </aside>
  );
}
