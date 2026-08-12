import { useEffect, useMemo, useState } from "react";
import {
  listLocations,
  listStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
} from "../lib/api";

const roleOptions = ["cashier", "supervisor", "admin"];
const businessOptions = ["butchery", "gas"];

const inputClass =
  "w-full rounded-lg bg-surface1 border border-borderColor px-3 py-2 text-textPrimary text-sm";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function StaffForm({ locations, editing, onSaved, onCancel }) {
  const defaults = editing || {
    name: "",
    phone: "",
    role: "cashier",
    location_id: locations[0]?.id || "",
    business_access: ["butchery"],
    pin: "",
    can_redeem_points: false,
    can_switch_location: false,
    is_active: true,
  };

  const [name, setName] = useState(defaults.name || "");
  const [phone, setPhone] = useState(defaults.phone || "");
  const [role, setRole] = useState(defaults.role || "cashier");
  const [locationId, setLocationId] = useState(
    defaults.location_id ?? locations[0]?.id ?? "",
  );
  const [businessAccess, setBusinessAccess] = useState(
    defaults.business_access || ["butchery"],
  );
  const [pin, setPin] = useState(defaults.pin || "");
  const [canRedeemPoints, setCanRedeemPoints] = useState(
    !!defaults.can_redeem_points,
  );
  const [canSwitchLocation, setCanSwitchLocation] = useState(
    !!defaults.can_switch_location,
  );
  const [isActive, setIsActive] = useState(Boolean(defaults.is_active));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing && locations[0]) {
      setLocationId(locations[0].id);
    }
  }, [locations, editing]);

  const toggleBusiness = (value) => {
    setBusinessAccess((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!pin && !editing) {
      setError("PIN is required");
      return;
    }
    if (pin && !/^\d{6}$/.test(pin)) {
      setError("PIN must be exactly 6 digits");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        role,
        location_id: locationId ? Number(locationId) : null,
        business_access: businessAccess,
        can_redeem_points: canRedeemPoints,
        can_switch_location: canSwitchLocation,
        is_active: isActive,
      };

      if (pin) payload.pin = pin;

      if (editing) {
        await updateStaff(editing.id, payload);
      } else {
        await createStaff({ ...payload, pin: pin || "" });
      }

      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save staff member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-2xl bg-surface2 border border-borderColor p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-textPrimary text-sm font-semibold">
          {editing ? "Edit staff member" : "Add staff member"}
        </p>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-textMuted text-xs block mb-1">Full name</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-textMuted text-xs block mb-1">Phone</label>
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0712345678"
          />
        </div>
        <div>
          <label className="text-textMuted text-xs block mb-1">Role</label>
          <select
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}>
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-textMuted text-xs block mb-1">Location</label>
          <select
            className={inputClass}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-textMuted text-xs block mb-1">PIN</label>
          <input
            className={inputClass}
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder={editing ? "Leave unchanged" : "123456"}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <label className="flex items-center gap-2 text-xs text-textSecondary">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-xs text-textSecondary">
            <input
              type="checkbox"
              checked={canRedeemPoints}
              onChange={(e) => setCanRedeemPoints(e.target.checked)}
            />
            Can redeem points
          </label>
          {role === "supervisor" && (
            <label className="flex items-center gap-2 text-xs text-textSecondary">
              <input
                type="checkbox"
                checked={canSwitchLocation}
                onChange={(e) => setCanSwitchLocation(e.target.checked)}
              />
              Can switch shops
            </label>
          )}
        </div>
      </div>

      <div>
        <p className="text-textMuted text-xs mb-2">Business access</p>
        <div className="flex flex-wrap gap-2">
          {businessOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleBusiness(option)}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wide ${
                businessAccess.includes(option)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-borderColor bg-surface1 text-textSecondary"
              }`}>
              {option}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-danger text-xs font-semibold">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-onPrimary text-sm font-semibold disabled:opacity-50">
          {saving
            ? editing
              ? "Updating..."
              : "Creating..."
            : editing
              ? "Update staff"
              : "Create staff"}
        </button>
      </div>
    </form>
  );
}

export default function StaffAdmin({ staffRole }) {
  const [locations, setLocations] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [locationRows, staffRows] = await Promise.all([
        listLocations(),
        listStaff(),
      ]);
      setLocations(locationRows);
      setStaffMembers(staffRows);
    } catch (err) {
      setError(err.message || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredStaff = useMemo(() => {
    return staffMembers.filter((staff) => {
      const q = search.toLowerCase();
      const matchesText =
        !q ||
        staff.name?.toLowerCase().includes(q) ||
        staff.phone?.toLowerCase().includes(q) ||
        staff.role?.toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || staff.role === roleFilter;
      const matchesLocation =
        locationFilter === "all" ||
        String(staff.location_id) === String(locationFilter);
      return matchesText && matchesRole && matchesLocation;
    });
  }, [search, roleFilter, locationFilter, staffMembers]);

  const deactivate = async (staffId) => {
    try {
      await deactivateStaff(staffId);
      fetchData();
    } catch (err) {
      setError(err.message || "Failed to deactivate staff");
    }
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">Staff</h1>
          <p className="text-textSecondary text-sm mt-1">
            Role, access, branch and PIN management for the multi-shop POS.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 text-danger px-3 py-2 text-xs font-medium">
          {error}
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-onPrimary font-semibold text-sm">
          + Add staff member
        </button>
      )}
      {showForm && (
        <>
          <StaffForm
            locations={locations}
            editing={editing}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
              fetchData();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setEditing(null);
            }}
            className="mt-3 px-4 py-2 rounded-lg border border-borderColor bg-surface2 text-textSecondary font-semibold text-sm hover:bg-surface3 hover:text-textPrimary">
            Cancel
          </button>
        </>
      )}

      <div className="mt-6 rounded-2xl bg-surface2 border border-borderColor p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            className={inputClass}
            placeholder="Search staff"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={inputClass}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="all">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-textMuted text-xs">Loading staff...</p>
        ) : (
          <div className="space-y-2">
            {filteredStaff.length === 0 ? (
              <p className="text-textMuted text-xs">
                No staff match the current filters.
              </p>
            ) : (
              filteredStaff.map((member) => (
                <div key={member.id}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-borderColor bg-surface1 p-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-textPrimary font-semibold text-sm">
                          {member.name}
                        </p>
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
                          {member.role}
                        </span>
                        {!member.is_active && (
                          <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger text-[10px] font-semibold uppercase tracking-wide">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-textMuted text-xs mt-1">
                        {member.phone || "No phone"} ·{" "}
                        {member.location_name || "Unassigned location"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(member.business_access || []).map((access) => (
                          <span
                            key={access}
                            className="px-2 py-0.5 rounded-full bg-surface3 text-textSecondary text-[10px] font-semibold uppercase tracking-wide">
                            {access}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setExpandedId((current) =>
                            current === member.id ? null : member.id,
                          );
                          setEditing(member);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">
                        {expandedId === member.id ? "Close" : "Edit"}
                      </button>
                      {member.is_active && (
                        <button
                          onClick={() => deactivate(member.id)}
                          className="px-3 py-1.5 rounded-lg border border-borderColor bg-surface2 text-textSecondary text-xs font-semibold hover:bg-surface3">
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedId === member.id && (
                    <div className="mt-2">
                      <StaffForm
                        locations={locations}
                        editing={editing}
                        onSaved={() => {
                          setExpandedId(null);
                          setEditing(null);
                          fetchData();
                        }}
                        onCancel={() => {
                          setExpandedId(null);
                          setEditing(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
