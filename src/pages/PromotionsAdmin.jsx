import { useEffect, useState } from "react";
import {
  createPromoRule,
  getPromoPayouts,
  getPromoRules,
  markPromoPayoutPaid,
  updatePromoRule,
} from "../lib/api";
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
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState(null),
    [message, setMessage] = useState("");
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
  };
  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";
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
        <p className="mt-4 p-3 rounded-xl bg-success/10 text-success text-sm">
          {message}
        </p>
      )}
      <form
        onSubmit={submit}
        className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl bg-surface2 border border-borderColor p-4">
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
        <div className="md:col-span-2">
          <button className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
            {editing ? "Update rule" : "Add rule"}
          </button>
        </div>
      </form>
      <section className="mt-6">
        <h2 className="text-lg font-bold text-textPrimary mb-3">
          Promotion rules
        </h2>
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="p-3 rounded-xl bg-surface2 border border-borderColor flex justify-between text-sm">
              <span className="text-textPrimary">
                {rule.type} ·{" "}
                {rule.trigger_type === "nth_sale"
                  ? `about every ${rule.trigger_value} customer sales (±${rule.milestone_variance})`
                  : `${Number(rule.trigger_value) * 100}% per sale`}
              </span>
              <button
                className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary"
                onClick={() => edit(rule)}>
                Edit
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-bold text-textPrimary mb-3">
          Pending cashback payouts
        </h2>
        {payouts
          .filter((p) => p.type === "cashback")
          .map((p) => (
            <div
              key={p.id}
              className="p-3 mb-2 rounded-xl bg-surface2 border border-borderColor flex justify-between text-sm">
              <span className="text-textPrimary">
                {p.customer_name || p.customer_phone} — KES{" "}
                {Number(p.cashback_amount).toFixed(2)}
              </span>
              <button
                className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary"
                onClick={async () => {
                  await markPromoPayoutPaid(p.id);
                  load();
                }}>
                Mark paid
              </button>
            </div>
          ))}
      </section>
    </main>
  );
}
