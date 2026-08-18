// Canonical nav/module catalog -- mirrors backend/src/config/modules.js.
// Keep both lists in sync when adding a module (same duplication pattern
// already used for role/business-type enums across this app).
//
// `staff.modules` (set on login, see auth.service.js) is the server-
// resolved, effective list for that person: their role's defaults plus
// any per-staff extra grants an admin has added via Staff admin. This
// file only supplies display metadata (label/path) and the fallback
// role-default list for older cached sessions that predate this feature.
export const MODULE_CATALOG = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "till", label: "Till", path: "/till" },
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "customers", label: "Customers", path: "/customers" },
  { key: "staff", label: "Staff", path: "/staff" },
  { key: "catalog", label: "Catalog", path: "/catalog" },
  { key: "rewards", label: "Rewards", path: "/rewards" },
  { key: "promotions", label: "Promos", path: "/promotions" },
  { key: "corporate", label: "Corporate", path: "/corporate" },
  { key: "settings", label: "Settings", path: "/settings" },
  { key: "overrides", label: "Overrides", path: "/overrides" },
];

export const MODULE_BY_PATH = MODULE_CATALOG.reduce((acc, module) => {
  acc[module.path] = module.key;
  return acc;
}, {});
// "/stock" is an alternate route into the same Catalog page/module.
MODULE_BY_PATH["/stock"] = "catalog";

// What each role gets automatically, with no per-staff grant needed.
export const ROLE_DEFAULT_MODULES = {
  cashier: ["till"],
  supervisor: ["till", "overrides", "catalog"],
  admin: [
    "dashboard",
    "till",
    "reports",
    "customers",
    "staff",
    "catalog",
    "rewards",
    "promotions",
    "corporate",
    "settings",
  ],
};

// Effective modules for a signed-in staff member -- prefer the
// server-resolved `staff.modules`, falling back to the role default for
// sessions cached before this feature shipped.
export function effectiveModules(staff) {
  if (Array.isArray(staff?.modules)) return staff.modules;
  return ROLE_DEFAULT_MODULES[staff?.role] || [];
}
