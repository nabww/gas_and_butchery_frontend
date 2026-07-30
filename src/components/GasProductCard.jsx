import { useState, memo } from "react";
import { useCart } from "../contexts/CartContext";
import { addSaleItem, updateSaleItem } from "../lib/saleOperations";
import { recordLocalCylinderExchange } from "../lib/db/syncQueue";
import QuantityStepper from "./QuantityStepper";
import InventoryBadge from "./InventoryBadge";

const formatKes = (amount) =>
  `KES ${parseFloat(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function GasProductCard({ product, onToast, staffRole, allBrands }) {
  const { saleId, saleLocalId, items, addItem, updateItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [transactionType, setTransactionType] = useState("refill");
  const [isAdding, setIsAdding] = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [returnBrandId, setReturnBrandId] = useState("");
  const canExemptCrossBrand = staffRole === "admin" || staffRole === "supervisor";

  const isRefill = transactionType === "refill";
  const unitPrice = isRefill ? product.refill_price : product.cylinder_value;
  const filled = product.filled_qty ?? 0;
  const empty = product.empty_qty ?? 0;

  const handleAdd = async (mode) => {
    setTransactionType(mode);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      onToast("Enter a quantity greater than zero before adding an item.");
      return;
    }
    if (!saleLocalId) {
      onToast("No active sale. Please wait for the till to initialize.");
      return;
    }

    const isModeRefill = mode === "refill";
    const unitPriceForMode = isModeRefill
      ? product.refill_price
      : product.cylinder_value;
    const itemName = `${product.name} ${isModeRefill ? "Refill" : "Complete Cylinder"}`;

    setIsAdding(true);
    try {
      const matchingItem = items.find(
        (i) =>
          i.cylinder_brand_id === product.brand_id &&
          i.product_name === itemName &&
          Number(i.unit_price) === Number(unitPriceForMode),
      );

      if (matchingItem) {
        const newQuantity = parseFloat(
          (matchingItem.quantity + quantity).toFixed(2),
        );
        await updateSaleItem(
          matchingItem.local_id || matchingItem.id,
          newQuantity,
          unitPriceForMode,
          saleId,
        );
        updateItem(matchingItem.id, newQuantity);
      } else {
        const lineTotal = parseFloat(
          (quantity * unitPriceForMode).toFixed(2),
        );
        const newItem = await addSaleItem(saleId, saleLocalId, {
          product_id: null,
          cylinder_brand_id: product.brand_id,
          product_name: itemName,
          item_type: isModeRefill ? "refill" : "complete",
          quantity,
          unit_price: unitPriceForMode,
          line_total: lineTotal,
          pricing_type: "fixed",
        });
        addItem({
          id: newItem.local_id,
          local_id: newItem.local_id,
          product_id: null,
          cylinder_brand_id: product.brand_id,
          product_name: itemName,
          item_type: isModeRefill ? "refill" : "complete",
          quantity,
          unit_price: unitPriceForMode,
          line_total: lineTotal,
          pricing_type: "fixed",
          is_brand: true,
        });
      }
      setQuantity(1);
    } catch (err) {
      onToast(err.message || "Failed to add item");
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddRefillWithExchange = async () => {
    if (!returnBrandId) {
      onToast("Select the brand of the empty cylinder being returned.");
      return;
    }
    const returnedBrand = allBrands.find((b) => b.id === parseInt(returnBrandId));
    const issuedBrand = allBrands.find((b) => b.id === product.brand_id);
    if (!returnedBrand || !issuedBrand) {
      onToast("Brand lookup failed");
      return;
    }

    const isCrossBrand = returnedBrand.id !== issuedBrand.id;
    if (isCrossBrand && !canExemptCrossBrand) {
      onToast("Cross-brand exchange requires admin/supervisor approval.");
      return;
    }

    let priceAdjustment = 0;
    if (isCrossBrand) {
      const issuedValue = parseFloat(issuedBrand.cylinder_value);
      const returnedValue = parseFloat(returnedBrand.cylinder_value);
      if (issuedValue > returnedValue) {
        priceAdjustment = (issuedValue - returnedValue) * quantity;
      }
    }

    setIsAdding(true);
    try {
      const lineTotal = parseFloat((quantity * product.refill_price).toFixed(2));
      const itemName = `${product.name} Refill`;
      const newItem = await addSaleItem(saleId, saleLocalId, {
        product_id: null,
        cylinder_brand_id: product.brand_id,
        product_name: itemName,
        item_type: "refill",
        quantity,
        unit_price: product.refill_price,
        line_total: lineTotal,
        pricing_type: "fixed",
      });
      addItem({
        id: newItem.local_id,
        local_id: newItem.local_id,
        product_id: null,
        cylinder_brand_id: product.brand_id,
        product_name: itemName,
        item_type: "refill",
        quantity,
        unit_price: product.refill_price,
        line_total: lineTotal,
        pricing_type: "fixed",
        is_brand: true,
      });

      await recordLocalCylinderExchange(saleLocalId, {
        empty_brand_id: parseInt(returnBrandId),
        issued_brand_id: product.brand_id,
        quantity,
        price_adjustment: priceAdjustment,
      });

      if (priceAdjustment > 0) {
        const topUpName = `Cylinder Top-up (${returnedBrand.brand} → ${issuedBrand.brand})`;
        const topUpItem = await addSaleItem(saleId, saleLocalId, {
          product_id: null,
          cylinder_brand_id: null,
          product_name: topUpName,
          quantity: 1,
          unit_price: priceAdjustment,
          line_total: priceAdjustment,
          pricing_type: "fixed",
        });
        addItem({
          id: topUpItem.local_id,
          local_id: topUpItem.local_id,
          product_id: null,
          cylinder_brand_id: null,
          product_name: topUpName,
          quantity: 1,
          unit_price: priceAdjustment,
          line_total: priceAdjustment,
          pricing_type: "fixed",
          is_brand: false,
        });
        onToast(`Cross-brand top-up: KES ${priceAdjustment.toFixed(2)} added to cart.`);
      } else if (isCrossBrand) {
        onToast("Cross-brand exchange approved — no additional charge.");
      } else {
        onToast("Refill with exchange recorded.");
      }

      setShowExchange(false);
      setReturnBrandId("");
      setQuantity(1);
    } catch (err) {
      onToast(err.message || "Failed to record exchange");
    } finally {
      setIsAdding(false);
    }
  };

  const filledVariant = filled <= 0 ? "danger" : filled <= 3 ? "warning" : "success";
  const emptyVariant = empty <= 0 ? "danger" : "info";

  return (
    <div className="group flex flex-col rounded-2xl bg-surface2 border border-borderColor p-4 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-1 hover:border-borderStrong">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-surface1 border border-borderColor text-3xl shrink-0">
          🛢️
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-textPrimary font-bold text-base truncate">
            {product.brand}
          </h3>
          <p className="text-textMuted text-sm">{product.weight_kg}kg Cylinder</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <InventoryBadge label="Filled" value={filled} variant={filledVariant} />
        <InventoryBadge label="Empty" value={empty} variant={emptyVariant} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-textSecondary text-sm font-medium">Qty</span>
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          step={1}
          size="md"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-auto">
        <button
          type="button"
          onClick={() => handleAdd("refill")}
          disabled={isAdding || !saleId}
          className={`flex flex-col items-center justify-center rounded-xl border px-2 py-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            isRefill
              ? "bg-primary text-onPrimary border-primary shadow-md"
              : "bg-surface1 border-borderColor text-textSecondary hover:border-borderStrong hover:bg-surface3"
          }`}>
          <span className="text-xs font-semibold uppercase tracking-wide mb-0.5">
            Refill
          </span>
          <span className="text-sm font-bold">{formatKes(product.refill_price)}</span>
        </button>
        <button
          type="button"
          onClick={() => handleAdd("cylinder")}
          disabled={isAdding || !saleId}
          className={`flex flex-col items-center justify-center rounded-xl border px-2 py-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            !isRefill
              ? "bg-primary text-onPrimary border-primary shadow-md"
              : "bg-surface1 border-borderColor text-textSecondary hover:border-borderStrong hover:bg-surface3"
          }`}>
          <span className="text-xs font-semibold uppercase tracking-wide mb-0.5">
            Complete
          </span>
          <span className="text-sm font-bold">{formatKes(product.cylinder_value)}</span>
        </button>
      </div>

      {showExchange ? (
        <div className="mt-2 p-3 rounded-xl bg-surface1 border border-borderColor space-y-2">
          <p className="text-textSecondary text-xs font-semibold uppercase tracking-wide">
            Empty cylinder returned
          </p>
          <select
            value={returnBrandId}
            onChange={(e) => setReturnBrandId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface2 border border-borderColor text-textPrimary text-sm focus:outline-none focus:border-primary">
            <option value="">Select brand returned...</option>
            {allBrands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.brand} {b.weight_kg}kg
              </option>
            ))}
          </select>
          {returnBrandId && parseInt(returnBrandId) !== product.brand_id && (
            <p className="text-warning text-xs">
              Cross-brand exchange{canExemptCrossBrand ? " (approved by " + staffRole + ")" : " — requires admin/supervisor"}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddRefillWithExchange}
              disabled={isAdding || !returnBrandId || (parseInt(returnBrandId) !== product.brand_id && !canExemptCrossBrand)}
              className="flex-1 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors disabled:opacity-50 active:scale-[0.98]">
              {isAdding ? "Adding..." : "Add Refill + Exchange"}
            </button>
            <button
              type="button"
              onClick={() => { setShowExchange(false); setReturnBrandId(""); }}
              className="flex-1 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors active:scale-[0.98]">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExchange(true)}
          disabled={isAdding || !saleId}
          className="mt-2 w-full py-2 rounded-xl border border-borderColor bg-surface1 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors active:scale-[0.98] disabled:opacity-50">
          Refill with Exchange
        </button>
      )}
    </div>
  );
}

export default memo(GasProductCard);
