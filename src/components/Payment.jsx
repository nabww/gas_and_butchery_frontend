import { useEffect, useRef, useState } from "react";
import {
  initiateM2pesa,
  getM2pesaStatus,
  linkM2pesaToSale,
  getSaleReceipt,
  completeAccountSale,
  verifyApprovalPin,
  approvePromoPayout,
} from "../lib/api";
import { recordCashSale, recordMpesaSale, recordAccountSale } from "../lib/saleOperations";
import { syncPendingSales } from "../lib/db/syncQueue";
import { isOfflineSalesEnabled } from "../lib/settings";
import { useCart } from "../contexts/CartContext";
import Checkmark from "./Checkmark";
import PromoWinModal from "./PromoWinModal";

const formatKes = (amount) =>
  `KES ${parseFloat(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PaymentUI({ onSaleCompleted, onNewMpesaCustomer }) {
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
  const [promoMessage, setPromoMessage] = useState("");
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [pendingPromoWins, setPendingPromoWins] = useState([]);
  const [receiptSaleId, setReceiptSaleId] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingAccountCharge, setPendingAccountCharge] = useState(null);
  const [approvalPin, setApprovalPin] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [mpesaTransaction, setMpesaTransaction] = useState(null);
  const [mpesaStatus, setMpesaStatus] = useState(null); // null | "pending" | "timeout" | "failed"
  const [mpesaSuccess, setMpesaSuccess] = useState(false);
  const mpesaSuccessTimeoutRef = useRef(null);
  const mpesaPollRef = useRef(null);

  const stopMpesaPolling = () => {
    if (mpesaPollRef.current) {
      clearInterval(mpesaPollRef.current);
      mpesaPollRef.current = null;
    }
  };

  useEffect(() => stopMpesaPolling, []);

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
    if (
      paymentMethod === "account" &&
      (!isOnline || !customer?.corporate_account_id)
    ) {
      setPaymentMethod("cash");
    }
  }, [isOnline, paymentMethod, customer?.corporate_account_id, setPaymentMethod]);

  useEffect(() => {
    if (paymentMethod === "mpesa" && !phoneManuallyEdited) {
      setPaymentPhone(customer?.phone || "");
    }
  }, [paymentMethod, customer?.phone, phoneManuallyEdited]);

  // Clear stale promo/receipt state when the sale or customer changes.
  useEffect(() => {
    setShowPromoModal(false);
    setPendingPromoWins([]);
    setReceiptSaleId(null);
    setPromoMessage("");
    setShowReceipt(false);
    setReceipt("");
    setMpesaSuccess(false);
    setError("");
    setPendingAccountCharge(null);
    setApprovalPin("");
    setApprovalError("");
  }, [saleLocalId, customer?.id]);

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
        const transaction = await initiateM2pesa(paymentPhone, total);
        setMpesaTransaction(transaction);
        setMpesaStatus("pending");
        setLoading(false);
        startMpesaPolling(transaction.mpesa_transaction_id);
        return;
      } else if (paymentMethod === "account") {
        if (!navigator.onLine) {
          setError("Account sales require an internet connection");
          setLoading(false);
          return;
        }
        if (!customer?.corporate_account_id) {
          setError("Select a corporate customer to charge this sale to their account");
          setLoading(false);
          return;
        }

        // Recording locally marks the sale completed (like cash/mpesa) so
        // the normal offline-sync path picks it up, assigns a real server
        // id, and runs stock/loyalty/promo side effects exactly once.
        await recordAccountSale(saleId, saleLocalId, total);

        let realSaleId = saleId;
        const syncResult = await syncPendingSales();
        realSaleId = syncResult?.saleServerIds?.[saleLocalId] || realSaleId;
        if (typeof realSaleId !== "number") {
          setError("Could not sync this sale to the server. Try again.");
          setLoading(false);
          return;
        }

        try {
          await completeAccountSale(realSaleId, customer.corporate_account_id);
        } catch (err) {
          if (err.data?.requiresApproval) {
            setPendingAccountCharge({
              saleId: realSaleId,
              corporateAccountId: customer.corporate_account_id,
              creditCheck: err.data.creditCheck,
            });
            setLoading(false);
            return;
          }
          throw err;
        }

        const promo = syncResult?.promoWins?.find(
          (entry) => entry.saleId === realSaleId,
        );
        if (promo?.wins?.length) {
          setReceiptSaleId(realSaleId);
          setPendingPromoWins(promo.wins);
          setShowPromoModal(true);
        } else {
          const receiptText = await getSaleReceipt(realSaleId);
          setReceipt(receiptText);
          setShowReceipt(true);
          setTimeout(() => {
            resetCart();
            setShowReceipt(false);
            setReceipt("");
            setPromoMessage("");
            onSaleCompleted?.();
          }, 3000);
        }
        setLoading(false);
        return;
      }

      if (navigator.onLine) {
        try {
          const syncResult = await syncPendingSales();
          const serverSaleId =
            syncResult?.saleServerIds?.[saleLocalId] || saleId;
          const promo = syncResult?.promoWins?.find(
            (entry) => entry.saleId === serverSaleId,
          );
          if (promo?.wins?.length && serverSaleId && serverSaleId !== saleLocalId) {
            setReceiptSaleId(serverSaleId);
            setPendingPromoWins(promo.wins);
            setShowPromoModal(true);
          } else {
            const receiptText =
              serverSaleId && serverSaleId !== saleLocalId
                ? await getSaleReceipt(serverSaleId)
                : "Receipt will print after sync.";
            setReceipt(receiptText);
            setShowReceipt(true);
            setTimeout(() => {
              resetCart();
              setShowReceipt(false);
              setReceipt("");
              setPromoMessage("");
              onSaleCompleted?.();
            }, 3000);
          }
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

    } catch (err) {
      setError(err.message || "Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  const MPESA_POLL_INTERVAL_MS = 3000;
  const MPESA_MAX_POLLS = 20; // ~60s, then show a "still waiting" state

  const startMpesaPolling = (mpesaTransactionId) => {
    stopMpesaPolling();
    let pollCount = 0;
    mpesaPollRef.current = setInterval(async () => {
      pollCount += 1;
      try {
        const status = await getM2pesaStatus(mpesaTransactionId);
        if (status.pending) {
          if (pollCount >= MPESA_MAX_POLLS) {
            stopMpesaPolling();
            setMpesaStatus("timeout");
          }
          return;
        }
        stopMpesaPolling();
        if (status.resultCode === "0") {
          await finalizeMpesaSale(mpesaTransactionId);
        } else {
          setMpesaTransaction(null);
          setMpesaStatus(null);
          setError(status.resultDesc || "Payment was not completed.");
        }
      } catch (err) {
        stopMpesaPolling();
        setMpesaTransaction(null);
        setMpesaStatus(null);
        setError(err.message || "Failed to check M-Pesa payment status");
      }
    }, MPESA_POLL_INTERVAL_MS);
  };

  const finalizeMpesaSale = async (mpesaTransactionId) => {
    setLoading(true);
    setError("");
    try {
      // Only recorded/completed locally now that STK success is confirmed
      // — marks the sale completed (like cash), so the normal offline-sync
      // path picks it up and runs stock/loyalty/promo side effects exactly
      // once.
      await recordMpesaSale(saleId, saleLocalId, total);

      const syncResult = await syncPendingSales();
      const realSaleId = syncResult?.saleServerIds?.[saleLocalId] || saleId;
      if (typeof realSaleId !== "number") {
        setError("Could not sync this sale to the server. Try again.");
        setLoading(false);
        return;
      }

      const { payer } = await linkM2pesaToSale(mpesaTransactionId, realSaleId);
      if (payer && payer.registered_via === "mpesa_auto" && !payer.consent_given_at) {
        onNewMpesaCustomer?.(payer);
      }

      const promo = syncResult?.promoWins?.find(
        (entry) => entry.saleId === realSaleId,
      );
      if (promo?.wins?.length) {
        setReceiptSaleId(realSaleId);
        setPendingPromoWins(promo.wins);
        setShowPromoModal(true);
      } else {
        const receiptText = await getSaleReceipt(realSaleId);
        setMpesaSuccess(true);
        setReceipt(receiptText);
        setShowReceipt(true);
        if (mpesaSuccessTimeoutRef.current) {
          clearTimeout(mpesaSuccessTimeoutRef.current);
        }
        mpesaSuccessTimeoutRef.current = setTimeout(() => {
          setMpesaSuccess(false);
        }, 1500);
      }
      setMpesaTransaction(null);
      setMpesaStatus(null);
      if (!promo?.wins?.length) {
        setTimeout(() => {
          resetCart();
          setShowReceipt(false);
          setReceipt("");
          setPromoMessage("");
          onSaleCompleted?.();
        }, 3000);
      }
    } catch (err) {
      setError(err.message || "Failed to finalize M-Pesa payment");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMpesaAgain = async () => {
    if (!mpesaTransaction) return;
    setLoading(true);
    setError("");
    try {
      const status = await getM2pesaStatus(mpesaTransaction.mpesa_transaction_id);
      if (status.pending) {
        setLoading(false);
        return;
      }
      if (status.resultCode === "0") {
        await finalizeMpesaSale(mpesaTransaction.mpesa_transaction_id);
      } else {
        setMpesaTransaction(null);
        setMpesaStatus(null);
        setError(status.resultDesc || "Payment was not completed.");
      }
    } catch (err) {
      setError(err.message || "Failed to check M-Pesa payment status");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMpesa = () => {
    stopMpesaPolling();
    setMpesaTransaction(null);
    setMpesaStatus(null);
    setError("");
  };

  const handleApproveCreditOverride = async () => {
    if (!pendingAccountCharge) return;
    setApprovalLoading(true);
    setApprovalError("");
    try {
      const { staff } = await verifyApprovalPin(approvalPin);
      await completeAccountSale(
        pendingAccountCharge.saleId,
        pendingAccountCharge.corporateAccountId,
        staff.id,
      );
      const receiptText = await getSaleReceipt(pendingAccountCharge.saleId);
      setReceipt(receiptText);
      setShowReceipt(true);
      setPendingAccountCharge(null);
      setApprovalPin("");
      setTimeout(() => {
        resetCart();
        setShowReceipt(false);
        setReceipt("");
        setPromoMessage("");
        onSaleCompleted?.();
      }, 3000);
    } catch (err) {
      setApprovalError(err.message || "Approval failed");
    } finally {
      setApprovalLoading(false);
    }
  };

  const handlePromoClose = () => {
    setShowPromoModal(false);
    setPendingPromoWins([]);
    setReceiptSaleId(null);
    if (!receiptSaleId) return;
    getSaleReceipt(receiptSaleId)
      .then((receiptText) => {
        setReceipt(receiptText);
        setMpesaSuccess(paymentMethod === "mpesa");
        setShowReceipt(true);
        setTimeout(() => {
          resetCart();
          setShowReceipt(false);
          setReceipt("");
          setPromoMessage("");
          setMpesaSuccess(false);
          onSaleCompleted?.();
        }, 3000);
      })
      .catch((err) => setError(err.message || "Failed to load receipt"));
  };

  const handlePromoConfirm = async (decisions, pin) => {
    const issuedIds = Object.entries(decisions)
      .filter(([, decision]) => decision === "issued")
      .map(([id]) => Number(id));

    if (issuedIds.length > 0 && !pin) {
      throw new Error("PIN required to issue promo wins");
    }

    if (issuedIds.length > 0) {
      await Promise.all(
        issuedIds.map((id) => approvePromoPayout(id, pin)),
      );
    }

    setShowPromoModal(false);
    setPendingPromoWins([]);
    if (!receiptSaleId) {
      setReceiptSaleId(null);
      return;
    }
    const receiptText = await getSaleReceipt(receiptSaleId);
    setReceipt(receiptText);
    setMpesaSuccess(paymentMethod === "mpesa");
    setShowReceipt(true);
    setReceiptSaleId(null);
    setTimeout(() => {
      resetCart();
      setShowReceipt(false);
      setReceipt("");
      setPromoMessage("");
      setMpesaSuccess(false);
      onSaleCompleted?.();
    }, 3000);
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
      paymentMethod === "account" ||
      (paymentMethod === "cash" &&
        cashReceived &&
        !isNaN(parseFloat(cashReceived)) &&
        parseFloat(cashReceived) >= total));

  return (
    <div className="flex flex-col">
      {showPromoModal && (
        <PromoWinModal
          wins={pendingPromoWins}
          customerName={customer?.name}
          onClose={handlePromoClose}
          onConfirm={handlePromoConfirm}
        />
      )}

      <h2 className="text-textSecondary text-xs font-semibold uppercase tracking-wide mb-4">
        Checkout
      </h2>

      {mpesaStatus ? (
        <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-3 text-center">
          <div className="text-4xl">📱</div>
          {mpesaStatus === "pending" ? (
            <>
              <p className="text-textPrimary font-semibold text-sm">
                Awaiting customer PIN entry on {paymentPhone}...
              </p>
              <p className="text-textMuted text-xs">
                STK push sent for {formatKes(total)}. This will update automatically.
              </p>
            </>
          ) : (
            <p className="text-warning font-semibold text-sm">
              Still waiting for a response. The customer may need more time, or the
              request may have expired.
            </p>
          )}
          {error && (
            <p className="text-danger text-xs font-semibold">{error}</p>
          )}
          <div className="flex gap-2">
            {mpesaStatus === "timeout" && (
              <button
                onClick={handleCheckMpesaAgain}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors disabled:opacity-50">
                {loading ? "Checking..." : "Check again"}
              </button>
            )}
            <button
              onClick={handleCancelMpesa}
              className="flex-1 py-2.5 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3">
              Cancel
            </button>
          </div>
        </div>
      ) : pendingAccountCharge ? (
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/30 space-y-3">
          <p className="text-warning font-semibold text-sm">
            This sale (KES {total.toFixed(2)}) would exceed the account's available credit
            (KES {pendingAccountCharge.creditCheck.availableCredit.toFixed(2)} left). A
            supervisor or admin must approve to continue.
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={approvalPin}
            onChange={(e) => setApprovalPin(e.target.value)}
            placeholder="Supervisor/admin PIN"
            className="w-full px-3 py-2.5 rounded-xl bg-surface2 border border-borderColor text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary text-sm"
          />
          {approvalError && (
            <p className="text-danger text-xs font-semibold">{approvalError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleApproveCreditOverride}
              disabled={approvalLoading || approvalPin.length !== 6}
              className="flex-1 py-2.5 rounded-xl bg-primary text-onPrimary text-sm font-semibold hover:bg-primaryDark transition-colors disabled:opacity-50">
              {approvalLoading ? "Verifying..." : "Approve & Charge"}
            </button>
            <button
              onClick={() => {
                setPendingAccountCharge(null);
                setApprovalPin("");
                setApprovalError("");
              }}
              className="flex-1 py-2.5 rounded-xl border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold hover:bg-surface3">
              Cancel
            </button>
          </div>
        </div>
      ) : showReceipt ? (
        <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-3">
          {mpesaSuccess && (
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-success">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/20">
                <Checkmark className="w-7 h-7" />
              </span>
              <p className="font-semibold text-sm">Payment received</p>
            </div>
          )}
          <pre className="text-textPrimary text-xs whitespace-pre-wrap font-mono">
            {receipt}
          </pre>
          {promoMessage && <p className="p-3 rounded-xl bg-success/10 text-success text-sm font-semibold">{promoMessage}</p>}
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

              {customer?.corporate_account_id && (
                <label
                  className={`col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl border cursor-pointer transition-all ${
                    !isOnline
                      ? "opacity-40 cursor-not-allowed bg-surface2 border-borderColor text-textMuted"
                      : paymentMethod === "account"
                        ? "bg-primary/15 border-primary text-textPrimary"
                        : "bg-surface2 border-borderColor text-textSecondary hover:border-borderStrong"
                  }`}>
                  <input
                    type="radio"
                    value="account"
                    checked={paymentMethod === "account"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={!isOnline}
                    className="sr-only"
                  />
                  <span className="text-lg">🧾</span>
                  <span className="font-semibold text-sm">Charge to Account</span>
                </label>
              )}
            </div>
            {!isOnline && (
              <p className="text-textMuted text-xs">M-Pesa and Account sales require an internet connection.</p>
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

          {paymentMethod === "account" && customer?.corporate_account_id && (
            <div className="p-4 rounded-2xl bg-surface1 border border-borderColor space-y-1">
              <p className="text-textSecondary text-xs font-semibold uppercase tracking-wide">
                Corporate account
              </p>
              <p className="text-textPrimary text-sm">
                Available credit: KES{" "}
                {(parseFloat(customer.credit_limit) - parseFloat(customer.current_balance)).toFixed(2)}
              </p>
              <p className="text-textMuted text-xs">
                Sales exceeding the limit require supervisor/admin approval.
              </p>
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
