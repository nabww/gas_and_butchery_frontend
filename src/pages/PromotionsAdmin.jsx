import { Fragment, useEffect, useState } from "react";
import {
  createPromoRule,
  getPromoPayouts,
  getPromoRules,
  markPromoPayoutPaid,
  markPromoPayoutUnfulfilled,
  updatePromoRule,
} from "../lib/api";
import PayoutActionModal from "../components/PayoutActionModal";
const blank = {
  type: "cashback",
  trigger_type: "nth_sale",
  trigger_value: "13",
  daily_cap_kes: "",
  monthly_cap_kes: "",
  max_prize_value: "",
  milestone_variance: "3",
  active: true,
};
export default function PromotionsAdmin() {
  const [rules, setRules] = useState([]),
    [payouts, setPayouts] = useState([]),
    [selectedPayout, setSelectedPayout] = useState(null),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState(null),
    [message, setMessage] = useState(""),
    [showForm, setShowForm] = useState(false),
    [statusFilter, setStatusFilter] = useState("active");
  const load = () =>
    Promise.all([getPromoRules(true), getPromoPayouts()])
      .then(([nextRules, nextPayouts]) => {
        setRules(nextRules);
        setPayouts(nextPayouts);
      })
      .catch((err) => setMessage(err.message));
  useEffect(() => {
    load();
  }, []);
  const handleIssuePayout = async () => {
    if (!selectedPayout) return;
    try {
      await markPromoPayoutPaid(selectedPayout.id);
      setSelectedPayout(null);
      load();
    } catch (err) {
      setMessage(err.message || "Failed to mark payout as paid.");
    }
  };
  const handleUnfulfilledPayout = async () => {
    if (!selectedPayout) return;
    try {
      await markPromoPayoutUnfulfilled(selectedPayout.id);
      setSelectedPayout(null);
      load();
    } catch (err) {
      setMessage(err.message || "Failed to mark payout as unfulfilled.");
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        trigger_value: Number(form.trigger_value),
        daily_cap_kes: form.daily_cap_kes || null,
        monthly_cap_kes: form.monthly_cap_kes || null,
        max_prize_value:
          form.type === "prize" ? Number(form.max_prize_value) : null,
        milestone_variance: Number(form.milestone_variance),
      };
      editing
        ? await updatePromoRule(editing, payload)
        : await createPromoRule(payload);
      setForm(blank);
      setEditing(null);
      setShowForm(false);
      setMessage("Promotion rule saved.");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };
  const edit = (rule) => {
    setEditing(rule.id);
    setForm({
      ...rule,
      daily_cap_kes: rule.daily_cap_kes || "",
      monthly_cap_kes: rule.monthly_cap_kes || "",
      max_prize_value: rule.max_prize_value || "",
    });
    setShowForm(true);
  };
  const cancelForm = () => {
    setForm(blank);
    setEditing(null);
    setShowForm(false);
  };
  const visibleRules = rules.filter((r) =>
    statusFilter === "all" ? true : statusFilter === "active" ? r.active : !r.active,
  );
  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";
  const renderForm = () => (
    <form
      onSubmit={submit}
      className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl bg-surface2 border border-borderColor p-4">
      <select
        className={input}
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}>
        <option value="cashback">Cashback</option>
        <option value="prize">Prize</option>
      </select>
      <select
        className={input}
        value={form.trigger_type}
        onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}>
        <option value="nth_sale">Customer milestone</option>
        <option value="probability">Probability per sale</option>
      </select>
      <input
        className={input}
        type="number"
        min="0.0001"
        step="0.0001"
        value={form.trigger_value}
        onChange={(e) => setForm({ ...form, trigger_value: e.target.value })}
        placeholder={
          form.trigger_type === "nth_sale" ? "Average sales" : "Chance (0–1)"
        }
      />
      {form.trigger_type === "nth_sale" && (
        <input
          className={input}
          type="number"
          min="0"
          value={form.milestone_variance}
          onChange={(e) =>
            setForm({ ...form, milestone_variance: e.target.value })
          }
          placeholder="Milestone variance"
        />
      )}
      {form.type === "prize" && (
        <input
          className={input}
          type="number"
          min="0"
          step="0.01"
          value={form.max_prize_value}
          onChange={(e) =>
            setForm({ ...form, max_prize_value: e.target.value })
          }
          placeholder="Maximum prize value (KES)"
        />
      )}
      <input
        className={input}
        type="number"
        min="0"
        step="0.01"
        value={form.daily_cap_kes}
        onChange={(e) => setForm({ ...form, daily_cap_kes: e.target.value })}
        placeholder="Daily cap (KES, optional)"
      />
      <input
        className={input}
        type="number"
        min="0"
        step="0.01"
        value={form.monthly_cap_kes}
        onChange={(e) =>
          setForm({ ...form, monthly_cap_kes: e.target.value })
        }
        placeholder="Monthly cap (KES, optional)"
      />
      <label className="text-textSecondary text-sm flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />{" "}
        Active
      </label>
      <div className="md:col-span-2 flex gap-2">
        <button className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          {editing ? "Update rule" : "Add rule"}
        </button>
        <button
          type="button"
          onClick={cancelForm}
          className="px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary font-semibold text-sm hover:bg-surface3 hover:text-textPrimary">
          Cancel
        </button>
      </div>
    </form>
  );
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-textPrimary">
        Promotions & Cashback
      </h1>
      <p className="text-textSecondary text-sm mt-1">
        Milestone draws use a hidden, randomized customer target around the
        configured average.
      </p>
      {message && (
        <p className="mt-4 p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-sm">
          {message}
        </p>
      )}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-6 px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          + Add rule
        </button>
      )}
      {showForm && !editing && renderForm()}
      {rules.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-textPrimary">Promotion rules</h2>
            <div className="flex gap-1 rounded-lg bg-surface1 border border-borderColor p-1">
              {["active", "inactive", "all"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                    statusFilter === f
                      ? "bg-primary text-onPrimary"
                      : "text-textSecondary hover:text-textPrimary"
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border border-borderColor">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface1 text-textSecondary">
                  <tr>
                    <th className="p-3 text-left font-semibold">Type</th>
                    <th className="p-3 text-left font-semibold">Trigger</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-textMuted text-sm">
                        No {statusFilter !== "all" ? statusFilter : ""} rules.
                      </td>
                    </tr>
                  ) : (
                    visibleRules.map((rule) => (
                      <Fragment key={rule.id}>
                        <tr className="border-t border-borderColor text-textPrimary">
                          <td className="p-3 capitalize">{rule.type}</td>
                          <td className="p-3">
                            {rule.trigger_type === "nth_sale"
                              ? `about every ${rule.trigger_value} customer sales (±${rule.milestone_variance})`
                              : `${Number(rule.trigger_value) * 100}% per sale`}
                          </td>
                          <td className="p-3">
                            {rule.active ? (
                              <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-semibold">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-textMuted/20 text-textMuted text-xs font-semibold">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary"
                              onClick={() => (editing === rule.id ? cancelForm() : edit(rule))}>
                              {editing === rule.id ? "Close" : "Edit"}
                            </button>
                          </td>
                        </tr>
                        {editing === rule.id && (
                          <tr className="border-t border-borderColor">
                            <td colSpan={4} className="p-3 bg-surface1">
                              {renderForm()}
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
      )}
      {payouts.filter((p) => p.type === "cashback").length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-textPrimary mb-3">
            Pending cashback payouts
          </h2>
          <div className="rounded-2xl overflow-hidden border border-borderColor">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface1 text-textSecondary">
                  <tr>
                    <th className="p-3 text-left font-semibold">Customer</th>
                    <th className="p-3 text-left font-semibold">Branch</th>
                    <th className="p-3 text-right font-semibold">Amount</th>
                    <th className="p-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts
                    .filter((p) => p.type === "cashback")
                    .map((p) => (
                      <tr key={p.id} className="border-t border-borderColor text-textPrimary">
                        <td className="p-3">{p.customer_name || p.customer_phone}</td>
                        <td className="p-3 text-textSecondary">{p.location_name || "Unknown branch"}</td>
                        <td className="p-3 text-right">KES {Number(p.cashback_amount).toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPayout(p)}
                            className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                            Action
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <PayoutActionModal
        payout={selectedPayout}
        onClose={() => setSelectedPayout(null)}
        onIssue={handleIssuePayout}
        onUnfulfilled={handleUnfulfilledPayout}
      />
    </main>
  );
}
