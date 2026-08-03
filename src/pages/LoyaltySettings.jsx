import { useEffect, useState } from "react";
import { getLoyaltyConfig, updateLoyaltyConfig } from "../lib/api";

const formatKes = (amount) =>
  `KES ${Number(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function LoyaltySettings() {
  const [earnRate, setEarnRate] = useState("");
  const [redemptionRate, setRedemptionRate] = useState("");
  const [cashbackMax, setCashbackMax] = useState("");
  const [maxRedemptionPercent, setMaxRedemptionPercent] = useState("");
  const [savedConfig, setSavedConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getLoyaltyConfig()
      .then((config) => {
        setEarnRate(String(config.earn_rate_per_100));
        setRedemptionRate(String(config.redemption_rate_kes));
        setCashbackMax(String(config.cashback_max_kes || 0));
        setMaxRedemptionPercent(String(config.max_redemption_percent ?? 50));
        setSavedConfig(config);
      })
      .catch((err) => setMessage(err.message || "Failed to load loyalty settings."))
      .finally(() => setLoading(false));
  }, []);

  const parsedEarnRate = Number(earnRate);
  const parsedRedemptionRate = Number(redemptionRate);
  const parsedCashbackMax = Number(cashbackMax);
  const parsedMaxRedemptionPercent = Number(maxRedemptionPercent);
  const isValid =
    earnRate !== "" && redemptionRate !== "" &&
    Number.isFinite(parsedEarnRate) && parsedEarnRate >= 0 &&
    Number.isFinite(parsedRedemptionRate) && parsedRedemptionRate > 0;
  const cashbackValid = Number.isFinite(parsedCashbackMax) && parsedCashbackMax >= 0 && parsedCashbackMax % 50 === 0;
  const maxRedemptionPercentValid =
    maxRedemptionPercent !== "" &&
    Number.isFinite(parsedMaxRedemptionPercent) &&
    parsedMaxRedemptionPercent > 0 &&
    parsedMaxRedemptionPercent <= 100;

  const saveIfChanged = async () => {
    if (!isValid || !cashbackValid || !maxRedemptionPercentValid || !savedConfig) return;
    if (
      parsedEarnRate === Number(savedConfig.earn_rate_per_100) &&
      parsedRedemptionRate === Number(savedConfig.redemption_rate_kes) &&
      parsedCashbackMax === Number(savedConfig.cashback_max_kes || 0) &&
      parsedMaxRedemptionPercent === Number(savedConfig.max_redemption_percent ?? 50)
    ) return;

    setSaving(true);
    setMessage("");
    try {
      const updated = await updateLoyaltyConfig({
        earn_rate_per_100: parsedEarnRate,
        redemption_rate_kes: parsedRedemptionRate,
        cashback_max_kes: parsedCashbackMax,
        max_redemption_percent: parsedMaxRedemptionPercent,
      });
      setSavedConfig(updated);
      setEarnRate(String(updated.earn_rate_per_100));
      setRedemptionRate(String(updated.redemption_rate_kes));
      setCashbackMax(String(updated.cashback_max_kes || 0));
      setMaxRedemptionPercent(String(updated.max_redemption_percent ?? 50));
      setMessage("Loyalty settings saved.");
    } catch (err) {
      setMessage(err.message || "Failed to save loyalty settings.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full mt-2 px-3 py-2 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm focus:outline-none focus:border-primary";

  if (loading) {
    return <div className="p-6 text-textSecondary">Loading loyalty settings…</div>;
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-textPrimary text-2xl font-bold">Loyalty Settings</h1>
        <p className="text-textSecondary text-sm mt-1">
          Changes save when you finish editing a field and apply to future sales.
        </p>
      </header>

      {message && (
        <p className={`mb-4 p-3 rounded-xl text-sm ${message.includes("saved") ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message}
        </p>
      )}

      <section className="rounded-2xl bg-surface2 border border-borderColor p-5 space-y-5">
        <div>
          <label htmlFor="earn-rate" className="text-textPrimary font-semibold text-sm">
            Points earned per KES 100
          </label>
          <input
            id="earn-rate"
            className={inputClass}
            type="number"
            min="0"
            max="9999.99"
            step="0.01"
            value={earnRate}
            onChange={(event) => setEarnRate(event.target.value)}
            onBlur={saveIfChanged}
            disabled={saving}
          />
          <p className="text-textMuted text-sm mt-2">
            A {formatKes(1000)} sale earns <span className="text-primary font-semibold">{isValid ? Math.floor((1000 / 100) * parsedEarnRate) : 0} points</span>.
          </p>
        </div>

        <div className="border-t border-borderColor pt-5">
          <label htmlFor="redemption-rate" className="text-textPrimary font-semibold text-sm">
            KES value of one point
          </label>
          <input
            id="redemption-rate"
            className={inputClass}
            type="number"
            min="0.01"
            max="9999.99"
            step="0.01"
            value={redemptionRate}
            onChange={(event) => setRedemptionRate(event.target.value)}
            onBlur={saveIfChanged}
            disabled={saving}
          />
          <p className="text-textMuted text-sm mt-2">
            100 points are worth <span className="text-primary font-semibold">{formatKes(isValid ? 100 * parsedRedemptionRate : 0)}</span> at checkout.
          </p>
        </div>

        <div className="border-t border-borderColor pt-5">
          <label htmlFor="cashback-max" className="text-textPrimary font-semibold text-sm">Maximum cashback payout (KES)</label>
          <input id="cashback-max" className={inputClass} type="number" min="0" step="50" value={cashbackMax} onChange={(event) => setCashbackMax(event.target.value)} onBlur={saveIfChanged} disabled={saving} />
          <p className="text-textMuted text-sm mt-2">Cashback wins are randomized in KES 50 steps from KES 50 to this maximum. Set to 0 to disable cashback wins.</p>
        </div>

        <div className="border-t border-borderColor pt-5">
          <label htmlFor="max-redemption-percent" className="text-textPrimary font-semibold text-sm">
            Maximum % of sale coverable by points
          </label>
          <input
            id="max-redemption-percent"
            className={inputClass}
            type="number"
            min="1"
            max="100"
            step="1"
            value={maxRedemptionPercent}
            onChange={(event) => setMaxRedemptionPercent(event.target.value)}
            onBlur={saveIfChanged}
            disabled={saving}
          />
          <p className="text-textMuted text-sm mt-2">
            On a {formatKes(1000)} sale, customers can redeem points for up to{" "}
            <span className="text-primary font-semibold">
              {formatKes(maxRedemptionPercentValid ? (1000 * parsedMaxRedemptionPercent) / 100 : 0)}
            </span>{" "}
            of the total.
          </p>
        </div>
      </section>
    </main>
  );
}
