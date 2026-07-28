import { memo } from "react";

function MetricCard({ title, value, icon, accent = "primary" }) {
  const accentClasses = {
    primary: "text-primaryLight",
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface2 border border-borderColor shadow-card">
      <div
        className={`flex items-center justify-center w-11 h-11 rounded-xl bg-surface1 border border-borderColor text-xl ${accentClasses[accent]}`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-textMuted text-xs font-semibold uppercase tracking-wide truncate">
          {title}
        </span>
        <span className="text-textPrimary text-lg font-bold truncate">{value}</span>
      </div>
    </div>
  );
}

export default memo(MetricCard);
