import { useEffect, useState } from "react";
import { initiateM2pesa, getSaleReceipt } from "../lib/api";
import { recordCashSale } from "../lib/saleOperations";
import { syncPendingSales } from "../lib/db/syncQueue";
import { isOfflineSalesEnabled } from "../lib/settings";
import { useCart } from "../contexts/CartContext";

const formatKes = (amount) =>
  `KES ${parseFloat(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PaymentUI() {
  const {
    items,
    total,
    saleId,
    saleLocalId,
    customer,
    paymentMethod,
    discountAmount,
    setPaymentMethod,
    resetCart,
  } = useCart();
  const [paymentPhone, setPaymentPhone] = useState(customer?.phone || "");
  const [phoneManuallyEdited, setPhoneManuallyEdited] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!isOnline && paymentMethod === "mpesa") {
      setPaymentMethod("cash");
    }
  }, [isOnline, paymentMethod, setPaymentMethod]);

  useEffect(() => {
    if (paymentMethod === "mpesa" && !phoneManuallyEdited) {
      setPaymentPhone(customer?.phone || "");
    }
  }, [paymentMethod, customer?.phone, phoneManuallyEdited]);

  if (items.length === 0) {
    return null;
  }

  const handleProcessPayment = async () => {
    if (!saleId || !saleLocalId) {
      setError("No active sale");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (!navigator.onLine && !isOfflineSalesEnabled()) {
        setError("Offline sales are disabled. Please connect to the network.");
        setLoading(false);
        return;
      }

      if (paymentMethod === "cash") {
        const amount = parseFloat(cashReceived);
        if (isNaN(amount) || amount < total) {
          setError(`Insufficient payment. Required: ${formatKes(total)}`);
          setLoading(false);
          return;
        }
        // Always record locally first; helper also tries server when online.
        await recordCashSale(saleId, saleLocalId, amount);
      } else if (paymentMethod === "mpesa") {
        if (!navigator.onLine) {
          setError("M-Pesa requires an internet connection");
          setLoading(false);
          return;
        }
        if (!paymentPhone) {
          setError("Phone number required for M-Pesa");
          setLoading(false);
          return;
        }
        await initiateM2pesa(paymentPhone, total);
        setError("STK push sent. Awaiting customer input...");
        setLoading(false);
        return;
      }

      if (navigator.onLine) {
        try {
          const syncResult = await syncPendingSales();
          const serverSaleId =
            syncResult?.saleServerIds?.[saleLocalId] || saleId;
          const receiptText =
            serverSaleId && serverSaleId !== saleLocalId
              ? await getSaleReceipt(serverSaleId)
              : "Receipt will print after sync.";
          setReceipt(receiptText);
          setShowReceipt(true);
        } catch (syncErr) {
          setError(
            "Sale saved locally. It will sync when the connection is stable.",
          );
        }
      } else {
        setError(
          "You are offline. Sale saved locally and will sync when connection returns.",
        );
      }

      setTimeout(() => {
        resetCart();
        setShowReceipt(false);
        setReceipt("");
      }, 3000);
    } catch (err) {
      setError(err.message || "Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;
    const printWindow = window.open("", "_blank", "width=400,height=700");
    printWindow.document.write(
      `<!DOCTYPE html>
<html>
<head>
<title>Receipt</title>
<style>
  body { font-family: monospace; font-size: 14px; margin: 20px; white-space: pre; }
</style>
</head>
<body>${receipt.replace(/</g, "&lt;")}</body>
</html>`,
    );
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 200);
  };

  const canCheckout =
    !loading &&
    (paymentMethod === "mpesa" ||
      (paymentMethod === "cash" &&
        cashReceived &&
        !isNaN(parseFloat(cashReceived)) &&
        parseFloat(cashReceived) >= total));

  return (
    <div className="flex flex-col">
      <h2 className="text-textSecondary text-xs font-semibold uppercase tracking-wide mb-4">
        Checkout
      </h2>

      {showReceipt ? (
        <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-3">
          <pre className="text-textPrimary text-xs whitespace-pre-wrap font-mono">
            {receipt}
          </pre>
          <button
            onClick={handlePrintReceipt}
            className="w-full py-2.5 rounded-xl bg-surface2 border border-borderColor text-textPrimary font-semibold hover:bg-surface3 transition-colors active:scale-[0.98]">
            Print Receipt
          </button>
          <p className="text-textSecondary text-sm text-center">
            Sale completed. New transaction starting...
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 rounded-2xl bg-surface1 border border-borderColor">
            <span className="text-textSecondary font-medium">Total due</span>
            <span className="text-textPrimary text-xl font-bold">{formatKes(total)}</span>
          </div>

          <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-3">
            <p className="text-textSecondary text-xs font-semibold uppercase tracking-wide">
              Payment method
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === "cash"
                    ? "bg-primary/15 border-primary text-textPrimary"
                    : "bg-surface2 border-borderColor text-textSecondary hover:border-borderStrong"
                }`}>
                <input
                  type="radio"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="sr-only"
                />
                <span className="text-lg">💵</span>
                <span className="font-semibold text-sm">Cash</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border cursor-pointer transition-all ${
                  !isOnline
                    ? "opacity-40 cursor-not-allowed bg-surface2 border-borderColor text-textMuted"
                    : paymentMethod === "mpesa"
                      ? "bg-primary/15 border-primary text-textPrimary"
                      : "bg-surface2 border-borderColor text-textSecondary hover:border-borderStrong"
                }`}>
                <input
                  type="radio"
                  value="mpesa"
                  checked={paymentMethod === "mpesa"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={!isOnline}
                  className="sr-only"
                />
                <span className="text-lg">📱</span>
                <span className="font-semibold text-sm">M-Pesa</span>
              </label>
            </div>
            {!isOnline && (
              <p className="text-textMuted text-xs">M-Pesa requires an internet connection.</p>
            )}
          </div>

          {paymentMethod === "cash" && (
            <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-2">
              <label className="text-textSecondary text-xs font-semibold uppercase tracking-wide">
                Amount received (KES)
              </label>
              <input
                type="number"
                min={total}
                step="1"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Enter amount received"
                className="w-full px-3 py-2.5 rounded-xl bg-surface2 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              />
              {cashReceived &&
                !isNaN(parseFloat(cashReceived)) &&
                parseFloat(cashReceived) >= total && (
                  <div className="text-success text-sm font-semibold">
                    Change: {formatKes(parseFloat(cashReceived) - total)}
                  </div>
                )}
            </div>
          )}

          {paymentMethod === "mpesa" && (
            <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-2">
              <label className="text-textSecondary text-xs font-semibold uppercase tracking-wide">
                Phone number
              </label>
              <input
                type="tel"
                value={paymentPhone}
                onChange={(e) => {
                  setPhoneManuallyEdited(true);
                  setPaymentPhone(e.target.value);
                }}
                placeholder="+254712345678"
                className="w-full px-3 py-2.5 rounded-xl bg-surface2 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              />
              <p className="text-textMuted text-xs">STK push will be sent to this number.</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-sm font-semibold">
              {error}
            </div>
          )}

          <button
            onClick={handleProcessPayment}
            disabled={!canCheckout}
            className="w-full rounded-xl bg-primary text-onPrimary font-bold py-4 px-4 text-base shadow-card transition-all duration-150 hover:bg-primaryDark hover:shadow-card-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Processing..." : "Checkout"}
          </button>
        </div>
      )}
    </div>
  );
}
