import { memo } from "react";

function QuantityStepper({ value = 1, onChange, min = 1, max, step = 1, size = "md" }) {
  const handleDecrement = () => {
    const next = Math.max(min, parseFloat((value - step).toFixed(2)));
    onChange(next);
  };

  const handleIncrement = () => {
    const next = max ? Math.min(max, parseFloat((value + step).toFixed(2))) : parseFloat((value + step).toFixed(2));
    onChange(next);
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange("");
      return;
    }
    const num = parseFloat(raw);
    if (Number.isFinite(num)) {
      onChange(num);
    }
  };

  const sizeClasses =
    size === "lg"
      ? "h-12 w-14 text-lg"
      : size === "sm"
        ? "h-8 w-9 text-sm"
        : "h-10 w-11 text-base";
  const inputClasses =
    size === "lg"
      ? "h-12 text-lg"
      : size === "sm"
        ? "h-8 text-sm"
        : "h-10 text-base";

  return (
    <div className="inline-flex items-center rounded-lg border border-borderColor bg-surface2 overflow-hidden">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className={`${sizeClasses} flex items-center justify-center px-0 text-textPrimary hover:bg-surface3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleInputChange}
        className={`${inputClasses} w-12 bg-transparent text-center text-textPrimary font-semibold focus:outline-none appearance-none m-0 p-0`}
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={max !== undefined && value >= max}
        aria-label="Increase quantity"
        className={`${sizeClasses} flex items-center justify-center px-0 text-textPrimary hover:bg-surface3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
        +
      </button>
    </div>
  );
}

export default memo(QuantityStepper);
