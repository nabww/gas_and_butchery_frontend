import { memo } from "react";

const CATEGORY_META = {
  butchery: { icon: "", label: "Retail" },
  gas: { icon: "🔥", label: "Gas" },
  drinks: { icon: "🥤", label: "Drinks" },
  dairy: { icon: "🥛", label: "Dairy" },
};

function CategoryPills({ categories, active, onSelect, labels = {} }) {
  return (
    <div
      className="flex flex-wrap justify-center gap-1 border-b border-borderColor"
      role="tablist"
      aria-label="Product categories">
      {categories.map((type) => {
        const meta = CATEGORY_META[type] || { icon: "", label: type };
        const label = labels[type] || meta.label;
        const isActive = type === active;
        return (
          <button
            key={type}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(type)}
            className={`inline-flex items-center gap-2 px-6 py-3 -mb-px border-b-2 text-sm font-semibold transition-colors duration-150 ${
              isActive
                ? "text-primary border-primary"
                : "text-textSecondary border-transparent hover:text-textPrimary"
            }`}>
            <span aria-hidden="true">{meta.icon}</span>
            <span className="capitalize">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(CategoryPills);
