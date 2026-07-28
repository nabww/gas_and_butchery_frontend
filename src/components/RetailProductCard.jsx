import { useState, useEffect, memo } from "react";
import { useCart } from "../contexts/CartContext";
import { addSaleItem, updateSaleItem } from "../lib/saleOperations";
import QuantityStepper from "./QuantityStepper";

const formatKes = (amount) =>
  `KES ${parseFloat(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const PRODUCT_ICONS = {
  beef: "🥩",
  goat: "🐐",
  chicken: "🍗",
  pork: "🐖",
  sausage: "🌭",
};

function getIcon(product) {
  if (product.business_type === "gas" || product.is_brand) return null;
  const key = product.name?.toLowerCase() || "";
  for (const [name, icon] of Object.entries(PRODUCT_ICONS)) {
    if (key.includes(name)) return icon;
  }
  return null;
}

function RetailProductCard({ product, onToast }) {
  const { saleId, saleLocalId, items, addItem, updateItem } = useCart();
  const isWeighted = product.pricing_type === "weighted";
  const initialQuantity = isWeighted ? 0.5 : 1;
  const [quantity, setQuantity] = useState(initialQuantity);
  const [amount, setAmount] = useState(
    isWeighted ? (initialQuantity * product.unit_price).toFixed(2) : "",
  );
  const [isAdding, setIsAdding] = useState(false);

  const icon = getIcon(product);

  const step = isWeighted ? 0.1 : 1;
  const min = isWeighted ? 0.1 : 1;

  useEffect(() => {
    if (isWeighted) {
      setAmount((quantity * product.unit_price).toFixed(2));
    }
  }, [quantity, product.unit_price, isWeighted]);

  const handleAdd = async () => {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      onToast("Enter a quantity greater than zero before adding an item.");
      return;
    }
    if (!saleLocalId) {
      onToast("No active sale. Please wait for the till to initialize.");
      return;
    }

    setIsAdding(true);
    try {
      const matchingItem = items.find(
        (i) =>
          i.product_id === product.id &&
          i.product_name === product.name &&
          Number(i.unit_price) === Number(product.unit_price),
      );

      if (matchingItem) {
        const newQuantity = parseFloat(
          (matchingItem.quantity + quantity).toFixed(2),
        );
        await updateSaleItem(
          matchingItem.local_id || matchingItem.id,
          newQuantity,
          product.unit_price,
          saleId,
        );
        updateItem(matchingItem.id, newQuantity);
      } else {
        const lineTotal = parseFloat(
          (quantity * product.unit_price).toFixed(2),
        );
        const newItem = await addSaleItem(saleId, saleLocalId, {
          product_id: product.id,
          cylinder_brand_id: null,
          product_name: product.name,
          quantity,
          unit_price: product.unit_price,
          line_total: lineTotal,
          pricing_type: product.pricing_type,
        });
        addItem({
          id: newItem.local_id,
          local_id: newItem.local_id,
          product_id: product.id,
          cylinder_brand_id: null,
          product_name: product.name,
          quantity,
          unit_price: product.unit_price,
          line_total: lineTotal,
          pricing_type: product.pricing_type,
          is_brand: false,
        });
      }
      const resetQty = product.pricing_type === "weighted" ? 0.5 : 1;
      setQuantity(resetQty);
      if (isWeighted) {
        setAmount((resetQty * product.unit_price).toFixed(2));
      }
    } catch (err) {
      onToast(err.message || "Failed to add item");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="group flex flex-col rounded-2xl bg-surface2 border border-borderColor p-4 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-1 hover:border-borderStrong">
      {icon && (
        <div className="flex items-center justify-center h-28 rounded-xl bg-surface1 border border-borderColor mb-4 text-5xl">
          {icon}
        </div>
      )}

      <div className="mb-3 min-w-0">
        <h3 className="text-textPrimary font-bold text-base truncate">
          {product.name}
        </h3>
        <p className="text-textPrimary text-lg font-bold mt-1">
          {formatKes(product.unit_price)}
        </p>
        <p className="text-textMuted text-sm mt-0.5">
          {product.pricing_type === "weighted" ? "Per kg" : "Fixed"}
        </p>
      </div>

      <div className="flex items-center justify-between mb-3 mt-auto">
        <span className="text-textSecondary text-sm font-medium">Qty</span>
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          min={min}
          step={step}
          size="md"
        />
      </div>

      {isWeighted && (
        <div className="flex items-center justify-between mb-4 gap-3">
          <span className="text-textSecondary text-sm font-medium">Amount</span>
          <input
            type="number"
            min={0}
            step={10}
            value={amount}
            onChange={(e) => {
              const value = e.target.value;
              setAmount(value);
              const num = parseFloat(value);
              if (Number.isFinite(num) && num > 0) {
                setQuantity(parseFloat((num / product.unit_price).toFixed(2)));
              }
            }}
            className="w-28 px-2.5 py-1.5 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-right text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={isAdding || !saleId}
        className="w-full rounded-xl bg-primary text-onPrimary font-semibold py-3 px-4 transition-all duration-150 hover:bg-primaryDark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
        {isAdding ? "Adding..." : "Add to Cart"}
      </button>
    </div>
  );
}

export default memo(RetailProductCard);
