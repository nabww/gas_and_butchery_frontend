import { Fragment, useEffect, useMemo, useState } from "react";
import {
  listLocations,
  listStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
} from "../lib/api";
import { MODULE_CATALOG, ROLE_DEFAULT_MODULES } from "../lib/modules";

const roleOptions = ["cashier", "supervisor", "admin"];
const businessOptions = ["butchery", "gas"];

// Modules a given role never needs listed as "extra" grants, since
// they're already included by default -- see lib/modules.js.
function extraGrantableModules(role) {
  const defaults = ROLE_DEFAULT_MODULES[role] || [];
  return MODULE_CATALOG.filter((module) => !defaults.includes(module.key));
}

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
  // Inactive shops shouldn't be offered for a new/changed assignment, but a
  // staff member already assigned to one that's since gone inactive still
  // needs their current location visible here so editing them doesn't
  // silently reassign them to somewhere else.
  const assignableLocations = locations.filter(
    (loc) => loc.is_active || String(loc.id) === String(editing?.location_id),
  );

  const defaults = editing || {
    name: "",
    phone: "",
    role: "cashier",
    location_id: assignableLocations[0]?.id || "",
    business_access: ["butchery"],
    module_access: [],
    pin: "",
    can_redeem_points: false,
    can_switch_location: false,
    is_active: true,
  };

  const [name, setName] = useState(defaults.name || "");
  const [phone, setPhone] = useState(defaults.phone || "");
  const [role, setRole] = useState(defaults.role || "cashier");
  const [locationId, setLocationId] = useState(
    defaults.location_id ?? assignableLocations[0]?.id ?? "",
  );
  const [businessAccess, setBusinessAccess] = useState(
    defaults.business_access || ["butchery"],
  );
  const [moduleAccess, setModuleAccess] = useState(
    defaults.module_access || [],
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
    if (!editing && assignableLocations[0]) {
      setLocationId(assignableLocations[0].id);
    }
  }, [locations, editing]);

  const toggleBusiness = (value) => {
    setBusinessAccess((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const toggleModule = (key) => {
    setModuleAccess((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const grantableModules = extraGrantableModules(role);

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
        module_access: moduleAccess,
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
            {assignableLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
                {!location.is_active ? " (inactive)" : ""}
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

      <div>
        <p className="text-textMuted text-xs mb-2">
          Extra module access
          <span className="ml-1 text-textMuted/70">
            (beyond what the {role} role already gets by default)
          </span>
        </p>
        {grantableModules.length === 0 ? (
          <p className="text-textMuted text-xs">
            The {role} role already has every module -- nothing extra to grant.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {grantableModules.map((module) => (
              <button
                key={module.key}
                type="button"
                onClick={() => toggleModule(module.key)}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                  moduleAccess.includes(module.key)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-borderColor bg-surface1 text-textSecondary"
                }`}>
                {module.label}
              </button>
            ))}
          </div>
        )}
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
          <div className="rounded-2xl overflow-hidden border border-borderColor">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface1 text-textSecondary">
                  <tr>
                    <th className="p-3 text-left font-semibold">Name</th>
                    <th className="p-3 text-left font-semibold">Role</th>
                    <th className="p-3 text-left font-semibold">Phone</th>
                    <th className="p-3 text-left font-semibold">Location</th>
                    <th className="p-3 text-left font-semibold">Business access</th>
                    <th className="p-3 text-left font-semibold">Extra modules</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-textMuted text-xs">
                        No staff match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((member) => (
                      <Fragment key={member.id}>
                        <tr className="border-t border-borderColor text-textPrimary">
                          <td className="p-3 font-semibold">{member.name}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
                              {member.role}
                            </span>
                          </td>
                          <td className="p-3 text-textSecondary">{member.phone || "No phone"}</td>
                          <td className="p-3 text-textSecondary">
                            {member.location_name || "Unassigned location"}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {(member.business_access || []).map((access) => (
                                <span
                                  key={access}
                                  className="px-2 py-0.5 rounded-full bg-surface3 text-textSecondary text-[10px] font-semibold uppercase tracking-wide">
                                  {access}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {extraGrantableModules(member.role)
                                .filter((module) =>
                                  (member.module_access || []).includes(module.key),
                                )
                                .map((module) => (
                                  <span
                                    key={module.key}
                                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
                                    {module.label}
                                  </span>
                                ))}
                              {extraGrantableModules(member.role).filter((module) =>
                                (member.module_access || []).includes(module.key),
                              ).length === 0 && (
                                <span className="text-textMuted text-[10px]">Role default only</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {member.is_active ? (
                              <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-semibold uppercase tracking-wide">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger text-[10px] font-semibold uppercase tracking-wide">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
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
                          </td>
                        </tr>
                        {expandedId === member.id && (
                          <tr className="border-t border-borderColor">
                            <td colSpan={8} className="p-3 bg-surface1">
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
        )}
      </div>
    </main>
  );
}
