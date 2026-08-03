import { Fragment, useEffect, useState } from "react";
import { createReward, getRewards, updateReward } from "../lib/api";

const blank = {
  name: "",
  points_cost: "",
  cost_value: "",
  stock_qty: "",
  active: true,
};

export default function RewardsAdmin() {
  const [rewards, setRewards] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const load = () =>
    getRewards(true)
      .then(setRewards)
      .catch((err) => setMessage(err.message));
  useEffect(() => {
    load();
  }, []);
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    const payload = {
      ...form,
      points_cost: Number(form.points_cost),
      cost_value: Number(form.cost_value),
      stock_qty: Number(form.stock_qty),
    };
    try {
      editingId
        ? await updateReward(editingId, payload)
        : await createReward(payload);
      setForm(blank);
      setEditingId(null);
      setShowForm(false);
      setMessage("Reward saved.");
      load();
    } catch (err) {
      setMessage(err.message || "Unable to save reward.");
    }
  };
  const edit = (reward) => {
    setEditingId(reward.id);
    setForm({
      name: reward.name,
      points_cost: reward.points_cost,
      cost_value: reward.cost_value,
      stock_qty: reward.stock_qty,
      active: Boolean(reward.active),
    });
    setShowForm(true);
  };
  const cancelForm = () => {
    setEditingId(null);
    setForm(blank);
    setShowForm(false);
  };
  const visibleRewards = rewards.filter((r) =>
    statusFilter === "all" ? true : statusFilter === "active" ? r.active : !r.active,
  );
  const input =
    "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";
  const renderForm = () => (
    <form
      onSubmit={submit}
      className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl bg-surface2 border border-borderColor p-4">
      <input
        className={input}
        placeholder="Reward name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        className={input}
        type="number"
        min="1"
        placeholder="Points cost"
        value={form.points_cost}
        onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
        required
      />
      <input
        className={input}
        type="number"
        min="0"
        step="0.01"
        placeholder="KES cost value"
        value={form.cost_value}
        onChange={(e) => setForm({ ...form, cost_value: e.target.value })}
        required
      />
      <input
        className={input}
        type="number"
        min="0"
        placeholder="Stock quantity"
        value={form.stock_qty}
        onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
        required
      />
      <label className="text-textSecondary text-sm flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />{" "}
        Available
      </label>
      <div className="md:col-span-3 flex gap-2">
        <button className="px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          {editingId ? "Update reward" : "Add reward"}
        </button>
        <button
          type="button"
          onClick={cancelForm}
          className="px-4 py-2 rounded-lg border border-borderColor text-textSecondary text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-textPrimary">Rewards Catalogue</h1>
      <p className="text-textSecondary text-sm mt-1">
        Manage prizes customers can redeem using loyalty points.
      </p>
      {message && (
        <p className="mt-4 p-3 rounded-xl bg-success/10 text-success text-sm">
          {message}
        </p>
      )}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-6 px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          + Add reward
        </button>
      )}
      {showForm && !editingId && renderForm()}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-textPrimary">Rewards</h2>
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
          <table className="w-full text-sm">
            <thead className="bg-surface1 text-textSecondary">
              <tr>
                <th className="p-3 text-left">Reward</th>
                <th>Points</th>
                <th>KES value</th>
                <th>Stock</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRewards.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-textMuted text-sm">
                    No {statusFilter !== "all" ? statusFilter : ""} rewards.
                  </td>
                </tr>
              )}
              {visibleRewards.map((reward) => (
                <Fragment key={reward.id}>
                  <tr className="border-t border-borderColor text-textPrimary">
                    <td className="p-3">{reward.name}</td>
                    <td className="text-center">{reward.points_cost}</td>
                    <td className="text-center">
                      {Number(reward.cost_value).toFixed(2)}
                    </td>
                    <td className="text-center">{reward.stock_qty}</td>
                    <td className="text-center">
                      {reward.active ? "Active" : "Retired"}
                    </td>
                    <td>
                      <button
                        onClick={() => (editingId === reward.id ? cancelForm() : edit(reward))}
                        className="px-3 py-1 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3 hover:text-textPrimary">
                        {editingId === reward.id ? "Close" : "Edit"}
                      </button>
                    </td>
                  </tr>
                  {editingId === reward.id && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        {renderForm()}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
