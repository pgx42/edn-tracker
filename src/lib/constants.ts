export const APP_NAME = "EDN Tracker";
export const APP_VERSION = "0.1.0";

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { id: "pdfs", label: "PDFs", icon: "FileText" },
  { id: "items", label: "EDN Items", icon: "List" },
  { id: "errors", label: "Error Notebook", icon: "AlertCircle" },
  { id: "planning", label: "Planning", icon: "Calendar" },
] as const;

export const ROUTES = {
  DASHBOARD: "/",
  PDFS: "/pdfs",
  ITEMS: "/items",
  ERRORS: "/errors",
  PLANNING: "/planning",
  SETTINGS: "/settings",
} as const;
