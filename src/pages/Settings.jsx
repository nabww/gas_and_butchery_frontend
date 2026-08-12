import { useEffect, useState } from "react";
import {
  getBusinessConfig,
  updateBusinessConfig,
  uploadBusinessLogo,
  getLoyaltyConfig,
  updateLoyaltyConfig,
} from "../lib/api";

const formatKes = (amount) =>
  `KES ${Number(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function BusinessConfigSection({ message, setMessage }) {
  const [config, setConfig] = useState({
    business_name: "TeziPOS",
    business_tagline: "",
    business_logo_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getBusinessConfig()
      .then(setConfig)
      .catch((err) => setMessage(err.message || "Failed to load business config."))
      .finally(() => setLoading(false));
  }, [setMessage]);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateBusinessConfig({
        business_name: config.business_name,
        business_tagline: config.business_tagline,
        business_logo_url: config.business_logo_url,
      });
      setConfig(updated);
      setMessage("Business settings saved.");
    } catch (err) {
      setMessage(err.message || "Failed to save business settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const updated = await uploadBusinessLogo(file);
      setConfig(updated);
      setMessage("Logo uploaded.");
    } catch (err) {
      setMessage(err.message || "Failed to upload logo.");
    } finally {
      setUploading(false);
    }
  };

  const input =
    "w-full mt-2 px-3 py-2 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm focus:outline-none focus:border-primary";

  if (loading) {
    return <div className="text-textSecondary">Loading business settings…</div>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!saving) save();
      }}
      className="rounded-2xl bg-surface2 border border-borderColor p-5 space-y-5">
      <div>
        <label htmlFor="business-name" className="text-textPrimary font-semibold text-sm">
          Business name
        </label>
        <input
          id="business-name"
          className={input}
          value={config.business_name}
          onChange={(e) => setConfig({ ...config, business_name: e.target.value })}
          placeholder="e.g. TeziPOS"
        />
      </div>

      <div className="border-t border-borderColor pt-5">
        <label htmlFor="business-tagline" className="text-textPrimary font-semibold text-sm">
          Tagline
        </label>
        <input
          id="business-tagline"
          className={input}
          value={config.business_tagline}
          onChange={(e) =>
            setConfig({ ...config, business_tagline: e.target.value })
          }
          placeholder="e.g. Butchery & Gas"
        />
      </div>

      <div className="border-t border-borderColor pt-5">
        <label className="text-textPrimary font-semibold text-sm">
          Logo
        </label>
        {config.business_logo_url && (
          <div className="mt-2 flex items-center gap-3">
            <img
              src={config.business_logo_url}
              alt="Logo preview"
              className="h-12 w-12 rounded-lg border border-borderColor bg-surface1 object-contain"
            />
            <p className="text-textSecondary text-xs truncate max-w-xs">
              {config.business_logo_url}
            </p>
          </div>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,image/webp"
          onChange={(e) => handleLogoUpload(e.target.files?.[0])}
          disabled={uploading}
          className="mt-2 block w-full text-sm text-textSecondary
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-primary file:text-onPrimary
            hover:file:bg-primary/90
            disabled:opacity-50"
        />
        <p className="text-textMuted text-sm mt-2">
          Upload a PNG, JPG, GIF, SVG, or WebP image (max 2 MB). Or paste a URL below.
        </p>
        <input
          className={`${input} mt-2`}
          value={config.business_logo_url}
          onChange={(e) =>
            setConfig({ ...config, business_logo_url: e.target.value })
          }
          placeholder="https://... or /uploads/logos/logo.png"
        />
      </div>

      <div className="border-t border-borderColor pt-5 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
          {saving ? "Saving..." : "Save business settings"}
        </button>
      </div>
    </form>
  );
}

function LoyaltySettingsSection({ message, setMessage }) {
  const [earnRate, setEarnRate] = useState("");
  const [redemptionRate, setRedemptionRate] = useState("");
  const [cashbackMax, setCashbackMax] = useState("");
  const [maxRedemptionPercent, setMaxRedemptionPercent] = useState("");
  const [savedConfig, setSavedConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
  }, [setMessage]);

  const parsedEarnRate = Number(earnRate);
  const parsedRedemptionRate = Number(redemptionRate);
  const parsedCashbackMax = Number(cashbackMax);
  const parsedMaxRedemptionPercent = Number(maxRedemptionPercent);
  const isValid =
    earnRate !== "" &&
    redemptionRate !== "" &&
    Number.isFinite(parsedEarnRate) &&
    parsedEarnRate >= 0 &&
    Number.isFinite(parsedRedemptionRate) &&
    parsedRedemptionRate > 0;
  const cashbackValid =
    Number.isFinite(parsedCashbackMax) &&
    parsedCashbackMax >= 0 &&
    parsedCashbackMax % 50 === 0;
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
    )
      return;

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

  const input =
    "w-full mt-2 px-3 py-2 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm focus:outline-none focus:border-primary";

  // This section autosaves on blur rather than a Save button; Enter should
  // save immediately too instead of making someone click elsewhere first.
  const handleFieldKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
      saveIfChanged();
    }
  };

  if (loading) {
    return <div className="text-textSecondary">Loading loyalty settings…</div>;
  }

  return (
    <section className="rounded-2xl bg-surface2 border border-borderColor p-5 space-y-5">
      <div>
        <label htmlFor="earn-rate" className="text-textPrimary font-semibold text-sm">
          Points earned per KES 100
        </label>
        <input
          id="earn-rate"
          className={input}
          type="number"
          min="0"
          max="9999.99"
          step="0.01"
          value={earnRate}
          onChange={(e) => setEarnRate(e.target.value)}
          onBlur={saveIfChanged}
          onKeyDown={handleFieldKeyDown}
          disabled={saving}
        />
        <p className="text-textMuted text-sm mt-2">
          A {formatKes(1000)} sale earns{" "}
          <span className="text-primary font-semibold">
            {isValid ? Math.floor((1000 / 100) * parsedEarnRate) : 0} points
          </span>
          .
        </p>
      </div>

      <div className="border-t border-borderColor pt-5">
        <label htmlFor="redemption-rate" className="text-textPrimary font-semibold text-sm">
          KES value of one point
        </label>
        <input
          id="redemption-rate"
          className={input}
          type="number"
          min="0.01"
          max="9999.99"
          step="0.01"
          value={redemptionRate}
          onChange={(e) => setRedemptionRate(e.target.value)}
          onBlur={saveIfChanged}
          onKeyDown={handleFieldKeyDown}
          disabled={saving}
        />
        <p className="text-textMuted text-sm mt-2">
          100 points are worth{" "}
          <span className="text-primary font-semibold">
            {formatKes(isValid ? 100 * parsedRedemptionRate : 0)}
          </span>{" "}
          at checkout.
        </p>
      </div>

      <div className="border-t border-borderColor pt-5">
        <label htmlFor="cashback-max" className="text-textPrimary font-semibold text-sm">
          Maximum cashback payout (KES)
        </label>
        <input
          id="cashback-max"
          className={input}
          type="number"
          min="0"
          step="50"
          value={cashbackMax}
          onChange={(e) => setCashbackMax(e.target.value)}
          onBlur={saveIfChanged}
          onKeyDown={handleFieldKeyDown}
          disabled={saving}
        />
        <p className="text-textMuted text-sm mt-2">
          Cashback wins are randomized in KES 50 steps from KES 50 to this maximum. Set to 0 to disable.
        </p>
      </div>

      <div className="border-t border-borderColor pt-5">
        <label htmlFor="max-redemption-percent" className="text-textPrimary font-semibold text-sm">
          Maximum % of sale coverable by points
        </label>
        <input
          id="max-redemption-percent"
          className={input}
          type="number"
          min="1"
          max="100"
          step="1"
          value={maxRedemptionPercent}
          onChange={(e) => setMaxRedemptionPercent(e.target.value)}
          onBlur={saveIfChanged}
          onKeyDown={handleFieldKeyDown}
          disabled={saving}
        />
        <p className="text-textMuted text-sm mt-2">
          On a {formatKes(1000)} sale, customers can redeem points for up to{" "}
          <span className="text-primary font-semibold">
            {formatKes(
              maxRedemptionPercentValid ? (1000 * parsedMaxRedemptionPercent) / 100 : 0,
            )}
          </span>{" "}
          of the total.
        </p>
      </div>
    </section>
  );
}

export default function Settings() {
  const [tab, setTab] = useState("business");
  const [message, setMessage] = useState("");

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-textPrimary text-2xl font-bold">Settings</h1>
        <p className="text-textSecondary text-sm mt-1">
          Manage business branding and loyalty program configuration.
        </p>
      </header>

      {message && (
        <p
          className={`mb-4 p-3 rounded-xl text-sm ${
            message.includes("saved") || message.includes("Saved")
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}>
          {message}
        </p>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("business")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            tab === "business"
              ? "bg-primary text-onPrimary"
              : "border border-borderColor bg-surface2 text-textSecondary hover:bg-surface3 hover:text-textPrimary"
          }`}>
          Business
        </button>
        <button
          onClick={() => setTab("loyalty")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            tab === "loyalty"
              ? "bg-primary text-onPrimary"
              : "border border-borderColor bg-surface2 text-textSecondary hover:bg-surface3 hover:text-textPrimary"
          }`}>
          Loyalty
        </button>
      </div>

      {tab === "business" ? (
        <BusinessConfigSection message={message} setMessage={setMessage} />
      ) : (
        <LoyaltySettingsSection message={message} setMessage={setMessage} />
      )}
    </main>
  );
}
