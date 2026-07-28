import { memo } from "react";

const variantClasses = {
  success:
    "bg-success/20 text-success border-success/30",
  info:
    "bg-info/20 text-info border-info/30",
  warning:
    "bg-warning/20 text-warning border-warning/30",
  danger:
    "bg-danger/20 text-danger border-danger/30",
};

function InventoryBadge({ label, value, variant = "info" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${variantClasses[variant]}`}>
      <span className="opacity-90">{label}</span>
      <span>{value}</span>
    </span>
  );
}

export default memo(InventoryBadge);
