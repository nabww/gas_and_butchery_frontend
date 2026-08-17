import { memo } from "react";

const CATEGORY_META = {
  butchery: { icon: "🥩", label: "Retail" },
  gas: { icon: "🔥", label: "Gas" },
  drinks: { icon: "🥤", label: "Drinks" },
  dairy: { icon: "🥛", label: "Dairy" },
};

function CategoryPills({ categories, active, onSelect, labels = {} }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product categories">
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
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 border ${
              isActive
                ? "bg-primary text-onPrimary border-primary shadow-md"
                : "bg-surface2 text-textSecondary border-borderColor hover:border-borderStrong hover:text-textPrimary"
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
