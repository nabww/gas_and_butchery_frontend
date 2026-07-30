import { useState, memo, useEffect } from "react";
import {
  updateSaleItem,
  removeSaleItem,
  applySaleDiscount,
} from "../lib/saleOperations";
import { useCart } from "../contexts/CartContext";
import { getCustomerPoints, getLoyaltyConfig, getRewards, redeemReward } from "../lib/api";
import { redeemLocalPoints } from "../lib/db/syncQueue";
import QuantityStepper from "./QuantityStepper";

const formatKes = (amount) =>
  `KES ${parseFloat(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CartItem = memo(function CartItem({ item, saleId, onUpdate, onRemove }) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleQtyChange = async (qty) => {
    if (!Number.isFinite(qty) || qty <= 0) return;
    setIsUpdating(true);
    try {
      await updateSaleItem(
        item.local_id || item.id,
        qty,
        item.unit_price,
        saleId,
      );
      onUpdate(item.id, qty);
    } catch (err) {
      alert(err.message || "Failed to update quantity");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeSaleItem(item.local_id || item.id, saleId);
      onRemove(item.id);
    } catch (err) {
      alert(err.message || "Failed to remove item");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 p-3 rounded-xl bg-surface1 border border-borderColor">
      <div className="flex-1 min-w-0 w-full">
        <p className="text-textPrimary font-semibold text-sm truncate">
          {item.product_name}
        </p>
        <p className="text-textMuted text-xs mt-0.5">
          {formatKes(item.unit_price)} each
        </p>
      </div>

      <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 w-full lg:w-auto">
        <QuantityStepper
          value={item.quantity}
          onChange={handleQtyChange}
          min={0.1}
          step={item.pricing_type === "weighted" ? 0.1 : 1}
          size="sm"
        />
        <div className="text-right min-w-[72px]">
          <p className="text-textPrimary font-bold text-sm">
            {formatKes(item.line_total)}
          </p>
        </div>
        <button
          onClick={handleRemove}
          title="Remove item"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-textMuted hover:text-danger hover:bg-danger/10 transition-colors text-sm">
          ✕
        </button>
      </div>
    </div>
  );
});

export default function Cart({ canRedeemPoints }) {
  const {
    saleId,
    saleLocalId,
    items,
    subtotal,
    discountAmount,
    total,
    customer,
    removeItem,
    updateItem,
    applyDiscount,
    setDiscountAmount,
  } = useCart();
  const [showDiscountUI, setShowDiscountUI] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState("fixed");
  const [showRedeemUI, setShowRedeemUI] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const [pointsBalance, setPointsBalance] = useState(null);
  const [redemptionRate, setRedemptionRate] = useState(5);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [showRewardUI, setShowRewardUI] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardError, setRewardError] = useState("");

  useEffect(() => {
    if (canRedeemPoints && customer?.id && navigator.onLine) {
      getCustomerPoints(customer.id)
        .then((data) => setPointsBalance(data.balance))
        .catch(() => setPointsBalance(null));
    } else {
      setPointsBalance(null);
    }
  }, [canRedeemPoints, customer?.id]);

  useEffect(() => {
    if (canRedeemPoints && navigator.onLine) {
      getLoyaltyConfig()
        .then((config) => setRedemptionRate(parseFloat(config.redemption_rate_kes)))
        .catch(() => {});
    }
  }, [canRedeemPoints]);

  useEffect(() => {
    if (canRedeemPoints && navigator.onLine) getRewards().then(setRewards).catch(() => setRewards([]));
  }, [canRedeemPoints]);

  const handleRedeem = async () => {
    const points = parseInt(redeemInput);
    if (isNaN(points) || points <= 0) {
      setRedeemError("Enter a valid number of points");
      return;
    }
    if (pointsBalance !== null && points > pointsBalance) {
      setRedeemError(`Insufficient points. Balance: ${pointsBalance}`);
      return;
    }
    const kesValue = (points * redemptionRate).toFixed(2);
    if (parseFloat(kesValue) > total) {
      setRedeemError(`Redemption value KES ${kesValue} exceeds total KES ${total.toFixed(2)}`);
      return;
    }

    setRedeemLoading(true);
    setRedeemError("");
    try {
      const kesValue = parseFloat((points * redemptionRate).toFixed(2));
      const result = await redeemLocalPoints(saleLocalId, customer.id, points, kesValue);
      if (result && result.sale) {
        setDiscountAmount(parseFloat(result.sale.discount_amount));
        setPointsBalance(pointsBalance - points);
        setShowRedeemUI(false);
        setRedeemInput("");
      }
    } catch (err) {
      setRedeemError(err.message || "Failed to redeem points");
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleApplyDiscount = async () => {
    const amount = parseFloat(discountInput);
    if (isNaN(amount) || amount < 0) {
      alert("Invalid discount amount");
      return;
    }

    let finalDiscount = amount;
    if (discountType === "percentage") {
      finalDiscount = (subtotal * amount) / 100;
    }

    if (finalDiscount > subtotal) {
      alert("Discount exceeds subtotal");
      return;
    }

    try {
      await applySaleDiscount(saleId, saleLocalId, finalDiscount);
      applyDiscount(finalDiscount);
      setShowDiscountUI(false);
      setDiscountInput("");
    } catch (err) {
      alert(err.message || "Failed to apply discount");
    }
  };

  const handleRewardRedeem = async (reward) => {
    setRewardLoading(true); setRewardError("");
    try {
      const result = await redeemReward(reward.id, customer.id);
      setPointsBalance(result.balanceAfter);
      setRewards((current) => current.map((item) => item.id === reward.id ? { ...item, stock_qty: item.stock_qty - 1 } : item));
      setRewardError(`${reward.name} redeemed and handed to the customer.`);
    } catch (err) { setRewardError(err.message || "Could not redeem reward."); }
    finally { setRewardLoading(false); }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h2 className="text-textSecondary text-xs font-semibold uppercase tracking-wide mb-4">
        Cart
      </h2>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-textMuted py-8">
          <span className="text-4xl mb-3">🛒</span>
          <p className="text-sm font-medium">Cart is empty</p>
          <p className="text-xs mt-1">Add products to get started</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 pr-1 mb-4">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                saleId={saleId}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-textSecondary">Subtotal</span>
                <span className="text-textPrimary font-medium">{formatKes(subtotal)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-warning">Discount</span>
                  <span className="text-warning font-medium">
                    -{formatKes(discountAmount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-base pt-2 border-t border-borderColor">
                <span className="text-textPrimary font-bold">Total</span>
                <span className="text-textPrimary font-bold text-lg">{formatKes(total)}</span>
              </div>
            </div>

            {showDiscountUI ? (
              <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 px-3 py-2 rounded-xl bg-surface2 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary text-sm"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-surface2 border border-borderColor text-textPrimary text-sm focus:outline-none focus:border-primary">
                    <option value="fixed">KES</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyDiscount}
                    className="flex-1 py-2 rounded-xl bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors active:scale-[0.98]">
                    Apply
                  </button>
                  <button
                    onClick={() => setShowDiscountUI(false)}
                    className="flex-1 py-2 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors active:scale-[0.98]">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDiscountUI(true)}
                className="w-full py-2.5 rounded-xl border border-borderColor bg-surface1 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors active:scale-[0.98]">
                Apply Discount
              </button>
            )}

            {canRedeemPoints && customer?.id && pointsBalance !== null && pointsBalance > 0 && (
              showRedeemUI ? (
                <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-2">
                  <div className="flex justify-between text-xs text-textMuted">
                    <span>Available: {pointsBalance} pts</span>
                    <span>Rate: 1 pt = KES {redemptionRate}</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={pointsBalance}
                    value={redeemInput}
                    onChange={(e) => setRedeemInput(e.target.value)}
                    placeholder="Points to redeem"
                    className="w-full px-3 py-2 rounded-xl bg-surface2 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary text-sm"
                  />
                  {redeemInput && !isNaN(parseInt(redeemInput)) && (
                    <p className="text-textSecondary text-xs">
                      = KES {(parseInt(redeemInput) * redemptionRate).toFixed(2)} discount
                    </p>
                  )}
                  {redeemError && (
                    <p className="text-danger text-xs font-semibold">{redeemError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleRedeem}
                      disabled={redeemLoading}
                      className="flex-1 py-2 rounded-xl bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors disabled:opacity-50 active:scale-[0.98]">
                      {redeemLoading ? "Redeeming..." : "Redeem"}
                    </button>
                    <button
                      onClick={() => { setShowRedeemUI(false); setRedeemInput(""); setRedeemError(""); }}
                      className="flex-1 py-2 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors active:scale-[0.98]">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowRedeemUI(true)}
                  className="w-full py-2.5 rounded-xl border border-borderColor bg-surface1 text-textSecondary text-sm font-semibold hover:bg-surface3 hover:text-textPrimary transition-colors active:scale-[0.98]">
                  Redeem Points ({pointsBalance} pts)
                </button>
              )
            )}

            {canRedeemPoints && customer?.id && pointsBalance !== null && (
              showRewardUI ? (
                <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-2">
                  <div className="flex justify-between text-xs text-textMuted"><span>Rewards catalogue</span><span>{pointsBalance} pts available</span></div>
                  {rewards.filter((reward) => reward.stock_qty > 0).map((reward) => (
                    <button key={reward.id} onClick={() => handleRewardRedeem(reward)} disabled={rewardLoading || pointsBalance < reward.points_cost} className="w-full text-left p-2 rounded-lg bg-surface2 border border-borderColor text-sm disabled:opacity-50">
                      <span className="text-textPrimary font-semibold">{reward.name}</span><span className="text-textMuted"> — {reward.points_cost} pts · {reward.stock_qty} left</span>
                    </button>
                  ))}
                  {rewardError && <p className={rewardError.includes("redeemed") ? "text-success text-xs" : "text-danger text-xs"}>{rewardError}</p>}
                  <button onClick={() => { setShowRewardUI(false); setRewardError(""); }} className="w-full py-2 rounded-xl border border-borderColor text-textSecondary text-sm">Close</button>
                </div>
              ) : (
                <button onClick={() => setShowRewardUI(true)} className="w-full py-2.5 rounded-xl border border-borderColor bg-surface1 text-textSecondary text-sm font-semibold hover:bg-surface3">Redeem a Reward</button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
