import { Fragment, useEffect, useState } from "react";
import {
  getBusinessConfig,
  updateBusinessConfig,
  uploadBusinessLogo,
  getLoyaltyConfig,
  updateLoyaltyConfig,
  listLocations,
  createLocation,
  updateLocation,
  getLocationMpesaConfig,
  saveLocationMpesaConfig,
  resetLocationMpesaConfig,
  getStoredStaff,
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

function ShopsSettingsSection({ setMessage }) {
  const staff = getStoredStaff();
  const isAdmin = staff?.role === "admin";

  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", address: "", is_active: true, business_types: [] });
  const [saving, setSaving] = useState(false);
  const [mpesaForm, setMpesaForm] = useState({
    environment: "sandbox",
    shortcode: "",
    consumerKey: "",
    consumerSecret: "",
    passkey: "",
  });
  const [selectedMpesaLocationId, setSelectedMpesaLocationId] = useState(null);
  const [mpesaLoading, setMpesaLoading] = useState(false);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const rows = await listLocations();
      setLocations(rows);
    } catch (err) {
      setMessage(err.message || "Failed to load shops.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const startAdd = () => {
    setEditingId("new");
    setForm({ name: "", address: "", is_active: true, business_types: [], business_type_labels: {} });
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name || "",
      address: loc.address || "",
      is_active: !!loc.is_active,
      business_types: loc.business_types || [],
      business_type_labels: loc.business_type_labels || {},
    });
  };

  const cancel = () => {
    setEditingId(null);
    setForm({ name: "", address: "", is_active: true, business_types: [], business_type_labels: {} });
  };

  const toggleBusinessType = (type) => {
    setForm((prev) => {
      const has = prev.business_types.includes(type);
      return {
        ...prev,
        business_types: has
          ? prev.business_types.filter((t) => t !== type)
          : [...prev.business_types, type],
      };
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setMessage("Only admins can manage shops.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (editingId === "new") {
        await createLocation(form);
      } else {
        await updateLocation(editingId, form);
      }
      // The shop switcher (nav) and Till's business-type restrictions read
      // from LocationContext, which is only loaded once on app mount --
      // without a reload, a saved shop's new/changed businesses wouldn't
      // take effect anywhere except this settings list until the next
      // manual refresh.
      window.location.reload();
    } catch (err) {
      setMessage(err.message || "Failed to save shop.");
      setSaving(false);
    }
  };

  const loadMpesaConfig = async (locationId) => {
    setSelectedMpesaLocationId(locationId);
    setMpesaLoading(true);
    setMessage("");
    try {
      const cfg = await getLocationMpesaConfig(locationId);
      setMpesaForm({
        environment: cfg.environment || "sandbox",
        shortcode: cfg.shortcode || "",
        consumerKey: cfg.consumerKey || "",
        consumerSecret: cfg.consumerSecret || "",
        passkey: cfg.passkey || "",
      });
    } catch (err) {
      setMessage(err.message || "Failed to load M-Pesa config.");
    } finally {
      setMpesaLoading(false);
    }
  };

  const saveMpesaConfig = async (e) => {
    e.preventDefault();
    if (!isAdmin || !selectedMpesaLocationId) return;
    setMpesaLoading(true);
    setMessage("");
    try {
      await saveLocationMpesaConfig(selectedMpesaLocationId, mpesaForm);
      setMessage("M-Pesa config saved.");
    } catch (err) {
      setMessage(err.message || "Failed to save M-Pesa config.");
    } finally {
      setMpesaLoading(false);
    }
  };

  const clearMpesaConfig = async () => {
    if (!isAdmin || !selectedMpesaLocationId) return;
    if (!confirm("Remove this shop's dedicated M-Pesa config and fall back to global .env settings?")) return;
    setMpesaLoading(true);
    setMessage("");
    try {
      await resetLocationMpesaConfig(selectedMpesaLocationId);
      setMpesaForm({
        environment: "sandbox",
        shortcode: "",
        consumerKey: "",
        consumerSecret: "",
        passkey: "",
      });
      setMessage("M-Pesa config reset to global fallback.");
    } catch (err) {
      setMessage(err.message || "Failed to reset M-Pesa config.");
    } finally {
      setMpesaLoading(false);
    }
  };

  const closeMpesaConfig = () => {
    setSelectedMpesaLocationId(null);
    setMpesaForm({
      environment: "sandbox",
      shortcode: "",
      consumerKey: "",
      consumerSecret: "",
      passkey: "",
    });
  };

  const input =
    "w-full mt-2 px-3 py-2 rounded-lg bg-surface1 border border-borderColor text-textPrimary text-sm focus:outline-none focus:border-primary";
  const label = "text-textPrimary font-semibold text-sm";

  if (loading) return <div className="text-textSecondary">Loading shops…</div>;

  return (
    <section className="rounded-2xl bg-surface2 border border-borderColor p-5 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-textPrimary font-bold">Shops / Branches</h2>
        {isAdmin && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 rounded-lg bg-primary text-onPrimary text-sm font-semibold">
            + Add shop
          </button>
        )}
      </div>

      {editingId && (
        <form onSubmit={save} className="rounded-xl bg-surface1 border border-borderColor p-4 space-y-4">
          <h3 className="text-textPrimary font-semibold text-sm">
            {editingId === "new" ? "Add shop" : "Edit shop"}
          </h3>
          <div>
            <label className={label}>Name</label>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              disabled={!isAdmin || saving}
            />
          </div>
          <div>
            <label className={label}>Address</label>
            <input
              className={input}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              disabled={!isAdmin || saving}
            />
          </div>
          <label className="flex items-center gap-2 text-textPrimary text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              disabled={!isAdmin || saving}
            />
            Active
          </label>
          <div>
            <label className={label}>Businesses run at this shop</label>
            <p className="text-textMuted text-xs mt-1 mb-2">
              Leave both unchecked to allow every business (default). Gas refills have their
              own stock/exchange workflow, so branches that don't sell gas can hide it entirely.
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-textPrimary text-sm">
                <input
                  type="checkbox"
                  checked={form.business_types.includes("butchery")}
                  onChange={() => toggleBusinessType("butchery")}
                  disabled={!isAdmin || saving}
                />
                Retail
              </label>
              <label className="flex items-center gap-2 text-textPrimary text-sm">
                <input
                  type="checkbox"
                  checked={form.business_types.includes("gas")}
                  onChange={() => toggleBusinessType("gas")}
                  disabled={!isAdmin || saving}
                />
                Gas
              </label>
            </div>
            {form.business_types.includes("butchery") && (
              <div className="mt-3">
                <label className={label}>Custom name for this business (optional)</label>
                <input
                  className={input}
                  value={form.business_type_labels.butchery || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      business_type_labels: { ...form.business_type_labels, butchery: e.target.value },
                    })
                  }
                  placeholder="Retail"
                  disabled={!isAdmin || saving}
                />
                <p className="text-textMuted text-xs mt-1">
                  Renames "Retail" to whatever this shop actually sells (e.g. "Butchery",
                  "Bakery", "Hardware") wherever it's shown at the till. Leave blank to keep "Retail".
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
                {saving ? "Saving…" : "Save shop"}
              </button>
            )}
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl overflow-hidden border border-borderColor">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface1 text-textSecondary">
              <tr>
                <th className="p-3 text-left font-semibold">Name</th>
                <th className="p-3 text-left font-semibold">Address</th>
                <th className="p-3 text-left font-semibold">Businesses</th>
                <th className="p-3 text-left font-semibold">Status</th>
                <th className="p-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-textMuted text-sm">
                    No shops yet.
                  </td>
                </tr>
              ) : (
                locations.map((loc) => (
                  <Fragment key={loc.id}>
                    <tr className="border-t border-borderColor text-textPrimary">
                      <td className="p-3 font-semibold">{loc.name}</td>
                      <td className="p-3 text-textSecondary">{loc.address || "No address"}</td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-surface2 text-textSecondary capitalize">
                          {loc.business_types && loc.business_types.length > 0
                            ? loc.business_types
                                .map((t) => loc.business_type_labels?.[t] || (t === "butchery" ? "Retail" : t))
                                .join(" & ")
                            : "Retail & Gas"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            loc.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                          }`}>
                          {loc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && (
                            <button
                              onClick={() => startEdit(loc)}
                              className="px-3 py-1 rounded-lg border border-borderColor text-textSecondary text-xs hover:bg-surface2">
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() =>
                              selectedMpesaLocationId === loc.id
                                ? closeMpesaConfig()
                                : loadMpesaConfig(loc.id)
                            }
                            className="px-3 py-1 rounded-lg border border-borderColor text-primary text-xs hover:bg-surface2">
                            {selectedMpesaLocationId === loc.id ? "Close" : "M-Pesa config"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {selectedMpesaLocationId === loc.id && (
                      <tr className="border-t border-borderColor">
                        <td colSpan={5} className="p-4 bg-surface1">
                          <form onSubmit={saveMpesaConfig} className="space-y-4">
                <p className="text-textPrimary font-semibold text-sm">M-Pesa config for {loc.name}</p>
                <p className="text-textMuted text-xs">
                  Leave fields blank to use the global .env M-Pesa configuration.
                </p>
                <div>
                  <label className={label}>Environment</label>
                  <select
                    className={input}
                    value={mpesaForm.environment}
                    onChange={(e) => setMpesaForm({ ...mpesaForm, environment: e.target.value })}
                    disabled={mpesaLoading || !isAdmin}>
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Shortcode</label>
                  <input
                    className={input}
                    value={mpesaForm.shortcode}
                    onChange={(e) => setMpesaForm({ ...mpesaForm, shortcode: e.target.value })}
                    disabled={mpesaLoading || !isAdmin}
                  />
                </div>
                <div>
                  <label className={label}>Consumer Key</label>
                  <input
                    className={input}
                    type="password"
                    value={mpesaForm.consumerKey}
                    onChange={(e) => setMpesaForm({ ...mpesaForm, consumerKey: e.target.value })}
                    disabled={mpesaLoading || !isAdmin}
                  />
                </div>
                <div>
                  <label className={label}>Consumer Secret</label>
                  <input
                    className={input}
                    type="password"
                    value={mpesaForm.consumerSecret}
                    onChange={(e) => setMpesaForm({ ...mpesaForm, consumerSecret: e.target.value })}
                    disabled={mpesaLoading || !isAdmin}
                  />
                </div>
                <div>
                  <label className={label}>Passkey</label>
                  <input
                    className={input}
                    type="password"
                    value={mpesaForm.passkey}
                    onChange={(e) => setMpesaForm({ ...mpesaForm, passkey: e.target.value })}
                    disabled={mpesaLoading || !isAdmin}
                  />
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={mpesaLoading}
                      className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
                      {mpesaLoading ? "Saving…" : "Save M-Pesa config"}
                    </button>
                    <button
                      type="button"
                      onClick={clearMpesaConfig}
                      disabled={mpesaLoading}
                      className="px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-danger text-sm font-semibold">
                      Reset to global
                    </button>
                    <button
                      type="button"
                      onClick={closeMpesaConfig}
                      disabled={mpesaLoading}
                      className="px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-sm font-semibold">
                      Cancel
                    </button>
                  </div>
                )}
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
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

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: "business", label: "Business" },
          { key: "shops", label: "Shops" },
          { key: "loyalty", label: "Loyalty" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === key
                ? "bg-primary text-onPrimary"
                : "border border-borderColor bg-surface2 text-textSecondary hover:bg-surface3 hover:text-textPrimary"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "business" ? (
        <BusinessConfigSection message={message} setMessage={setMessage} />
      ) : tab === "shops" ? (
        <ShopsSettingsSection message={message} setMessage={setMessage} />
      ) : (
        <LoyaltySettingsSection message={message} setMessage={setMessage} />
      )}
    </main>
  );
}
