import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/useTheme';
import { useActiveLocation } from '../contexts/LocationContext';
import { MODULE_CATALOG, effectiveModules } from '../lib/modules';
import { getBusinessConfig, listRefillRequests } from '../lib/api';
import {
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconCashRegister,
  IconChartBar,
  IconChevronDown,
  IconGift,
  IconIdBadge2,
  IconLayoutDashboard,
  IconLogout,
  IconMapPin,
  IconMoon,
  IconPackage,
  IconReceipt,
  IconSettings,
  IconShieldCheck,
  IconSpeakerphone,
  IconSun,
  IconUsers,
  IconX,
} from '@tabler/icons-react';

function HamburgerIcon({ open, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1={open ? 3 : 2} y1="5" x2={open ? 17 : 18} y2={open ? 15 : 5} />
      <line x1="2" y1="10" x2="18" y2="10" style={{ opacity: open ? 0 : 1, transition: 'opacity 0.15s' }} />
      <line x1={open ? 3 : 2} y1="15" x2={open ? 17 : 18} y2={open ? 5 : 15} />
    </svg>
  );
}

function PowerIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M10 2v7" />
      <path d="M6.1 5.2a7 7 0 1 0 7.8 0" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.5" />
      <line x1="10" y1="1.5" x2="10" y2="3.5" />
      <line x1="10" y1="16.5" x2="10" y2="18.5" />
      <line x1="1.5" y1="10" x2="3.5" y2="10" />
      <line x1="16.5" y1="10" x2="18.5" y2="10" />
      <line x1="3.9" y1="3.9" x2="5.3" y2="5.3" />
      <line x1="14.7" y1="14.7" x2="16.1" y2="16.1" />
      <line x1="16.1" y1="3.9" x2="14.7" y2="5.3" />
      <line x1="5.3" y1="14.7" x2="3.9" y2="16.1" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.2 11.2A7.5 7.5 0 1 1 8.8 2.8a6 6 0 0 0 8.4 8.4z" />
    </svg>
  );
}

const nameInitials = (name) =>
  (name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// Shop switcher — admins can always switch shops; a supervisor only sees
// this if explicitly granted `can_switch_location` (per-staff override,
// same pattern as can_redeem_points). Cashiers never see it.
function LocationSwitcher({ locations, activeLocationId, onChange, fullWidth = false }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const active = locations.find((loc) => String(loc.id) === String(activeLocationId));

  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginLeft: fullWidth ? 0 : 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Switch active shop"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: fullWidth ? 8 : 6,
          width: fullWidth ? '100%' : 'auto',
          minHeight: fullWidth ? 44 : undefined,
          padding: fullWidth ? '8px 12px' : '5px 10px',
          borderRadius: fullWidth ? 10 : 7,
          border: '0.5px solid var(--border-accent)',
          background: fullWidth ? 'var(--surface-1)' : 'transparent',
          color: fullWidth ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: fullWidth ? 14 : 12,
          cursor: 'pointer',
        }}
      >
        <IconBuildingStore size={fullWidth ? 16 : 14} stroke={1.75} aria-hidden="true" />
        <span style={{ flex: fullWidth ? 1 : undefined, textAlign: 'left' }}>
          {active?.name || 'All locations'}
        </span>
        <IconChevronDown size={fullWidth ? 16 : 12} stroke={2} aria-hidden="true" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: fullWidth ? 0 : undefined,
            minWidth: 180,
            background: 'var(--surface-2)',
            border: '0.5px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            zIndex: 2000,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (activeLocationId) onChange("");
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              border: 'none',
              textAlign: 'left',
              padding: '8px 12px',
              background: !activeLocationId ? 'var(--bg-accent)' : 'transparent',
              color: !activeLocationId ? 'var(--text-accent)' : 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {!activeLocationId
              ? <IconMapPin size={14} stroke={1.75} aria-hidden="true" />
              : <IconBuildingStore size={14} stroke={1.75} aria-hidden="true" />}
            All locations
          </button>
          <div style={{ borderTop: '0.5px solid var(--border)', margin: '4px 0' }} />
          {locations.map((loc) => {
            const isActive = String(loc.id) === String(activeLocationId);
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (!isActive) onChange(String(loc.id));
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  border: 'none',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: isActive ? 'var(--bg-accent)' : 'transparent',
                  color: isActive ? 'var(--text-accent)' : 'var(--text-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {isActive
                  ? <IconMapPin size={14} stroke={1.75} aria-hidden="true" />
                  : <IconBuildingStore size={14} stroke={1.75} aria-hidden="true" />}
                {loc.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MODULE_ICONS = {
  dashboard: IconLayoutDashboard,
  till: IconCashRegister,
  reports: IconChartBar,
  customers: IconUsers,
  staff: IconIdBadge2,
  catalog: IconPackage,
  expenses: IconReceipt,
  rewards: IconGift,
  promotions: IconSpeakerphone,
  corporate: IconBuildingSkyscraper,
  settings: IconSettings,
  overrides: IconShieldCheck,
};

function NavItem({ item, currentPath, onClick, onBadgeClick, mobile, badge }) {
  const active = currentPath === item.path || currentPath?.startsWith(`${item.path}?`);
  const Icon = mobile ? MODULE_ICONS[item.key] : null;
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        position: 'relative',
        border: 'none',
        background: active ? 'var(--bg-accent)' : 'transparent',
        color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
        padding: mobile ? '0 12px' : '8px 12px',
        minHeight: mobile ? 44 : undefined,
        display: mobile ? 'flex' : undefined,
        alignItems: 'center',
        gap: 12,
        fontSize: mobile ? 14 : 13,
        fontWeight: mobile && active ? 600 : undefined,
        textAlign: mobile ? 'left' : 'center',
        width: mobile ? '100%' : 'auto',
        borderRadius: mobile ? 10 : 6,
      }}
    >
      {Icon && <Icon size={19} stroke={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />}
      {item.label}
      {badge > 0 && (
        <span
          role="button"
          title={`${badge} refill request${badge === 1 ? '' : 's'} waiting`}
          onClick={(e) => { e.stopPropagation(); onBadgeClick?.(); }}
          style={{
            position: mobile ? 'relative' : 'absolute',
            top: mobile ? undefined : -4,
            right: mobile ? undefined : -4,
            marginLeft: mobile ? 6 : 0,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 999,
            background: 'var(--status-error)',
            color: 'var(--on-primary)',
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default function RoleNav({ staff, currentPath, onNavigate, onSignOut }) {
  // Nav only renders what this person can access -- their role's
  // defaults plus any per-staff extra grants (see lib/modules.js and
  // Staff admin's "Extra module access"). No greyed-out items
  // cluttering a screen built for speed.
  const allowedModules = effectiveModules(staff);
  const items = MODULE_CATALOG.filter((module) => allowedModules.includes(module.key));
  const showQuickSell = staff.role === 'admin' || staff.role === 'supervisor';
  const showLocationSwitcher =
    staff.role === 'admin' || (staff.role === 'supervisor' && staff.canSwitchLocation);
  const { theme, toggleTheme } = useTheme();
  const { locations, activeLocationId, setActiveLocationId } = useActiveLocation();
  // Inactive shops shouldn't be selectable to browse/sell as -- if the
  // currently active one just got deactivated, it still shows as the
  // current selection until the admin explicitly switches away from it.
  const switchableLocations = locations.filter((loc) => loc.is_active);
  const activeLocationName = locations.find((loc) => String(loc.id) === String(activeLocationId))?.name;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [businessConfig, setBusinessConfig] = useState(null);
  // Refill requests are directional: the stock store sees a badge for requests
  // waiting on them; the requesting shop sees a green banner once fulfilled
  // (recent — fulfilled within the last 7 days).
  const [refillWaiting, setRefillWaiting] = useState(0);
  const [refillFulfilled, setRefillFulfilled] = useState(0);
  // Dismissed-count: closing the green banner hides it until another
  // request is fulfilled (count rises above what was dismissed). Persisted
  // per shop so the banner stays closed across navigation/reloads.
  const dismissalKey = `refill-fulfilled-dismissed:${activeLocationId || "all"}`;
  const [dismissedFulfilled, setDismissedFulfilled] = useState(0);
  const topBarRef = useRef(null);
  const navRef = useRef(null);
  const collapsedAt = useRef(0);

  useEffect(() => {
    getBusinessConfig()
      .then(setBusinessConfig)
      .catch((err) => console.warn('Failed to load business config for nav', err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canAct = staff.role === 'admin' || staff.role === 'supervisor';
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const load = async () => {
      if (!navigator.onLine) return;
      try {
        const rows = await listRefillRequests(activeLocationId || undefined);
        if (cancelled) return;
        const waiting = canAct
          ? (rows || []).filter((r) =>
              (r.status === 'pending' || r.status === 'in_progress') &&
              (!activeLocationId || Number(r.stock_store_location_id) === Number(activeLocationId)),
            ).length
          : 0;
        const fulfilled = activeLocationId
          ? (rows || []).filter((r) =>
              r.status === 'fulfilled' &&
              Number(r.requesting_location_id) === Number(activeLocationId) &&
              new Date(r.fulfilled_at).getTime() > weekAgo,
            ).length
          : 0;
        setRefillWaiting(waiting);
        setRefillFulfilled(fulfilled);
      } catch {
        if (!cancelled) { setRefillWaiting(0); setRefillFulfilled(0); }
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [staff.role, activeLocationId]);

  useEffect(() => {
    setDismissedFulfilled(Number(localStorage.getItem(dismissalKey) || 0));
  }, [activeLocationId]);

  const handleNav = (path) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  // Collapse into hamburger whenever the full nav bar does not fit.
  useLayoutEffect(() => {
    const top = topBarRef.current;
    const nav = navRef.current;
    if (!top || !nav) return;
    if (!collapsed && top.scrollWidth > top.clientWidth + 1) {
      collapsedAt.current = nav.clientWidth;
      setCollapsed(true);
    }
  });

  // Try to expand again when the viewport gets meaningfully wider.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => {
      const w = nav.clientWidth;
      if (collapsed && w > collapsedAt.current + 40) {
        setCollapsed(false);
      }
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, [collapsed]);

  // Re-measure if the allowed module list changes.
  useEffect(() => {
    setCollapsed(false);
  }, [items.map((i) => i.key).join(',')]);

  // If the menu is open and we no longer need to be collapsed, close it.
  useEffect(() => {
    if (!collapsed) setMobileOpen(false);
  }, [collapsed]);

  // Close the mobile menu on an outside tap/click -- same pattern as
  // LocationSwitcher above. navRef wraps both the hamburger button and
  // the dropdown overlay, so a click anywhere else counts as "outside".
  useEffect(() => {
    if (!mobileOpen) return;
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileOpen]);

  return (
    <nav
      ref={navRef}
      style={{
        padding: '10px 16px',
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--surface-2)',
        position: 'relative',
        zIndex: 100,
      }}
    >
      <div
        ref={topBarRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          overflow: 'visible',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={() => handleNav(items[0]?.path || "/till")}
          title={businessConfig?.business_name || 'TeziPOS'}
          style={{
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
            marginRight: 16,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            border: 'none',
            background: 'transparent',
            padding: 0,
            fontSize: 'inherit',
            cursor: 'pointer',
          }}>
          {businessConfig?.business_logo_url ? (
            <img
              src={businessConfig.business_logo_url}
              alt={businessConfig?.business_name || 'TeziPOS'}
              className="business-logo-adaptive"
              style={{ height: 36, maxWidth: 140, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            businessConfig?.business_name || 'TeziPOS'
          )}
        </button>

        {collapsed && showLocationSwitcher && switchableLocations.length > 0 && (
          <div className="hidden sm:block absolute left-1/2 -translate-x-1/2">
            <LocationSwitcher
              locations={switchableLocations}
              activeLocationId={activeLocationId}
              onChange={setActiveLocationId}
            />
          </div>
        )}

        {/* Desktop nav links */}
        <div className={collapsed ? 'hidden' : 'flex items-center gap-1'}>
          {items.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              currentPath={currentPath}
              onClick={() => handleNav(item.path)}
              onBadgeClick={() => handleNav('/catalog?tab=refill-requests')}
              mobile={false}
              badge={item.path === '/catalog' ? refillWaiting : 0}
            />
          ))}

          {showLocationSwitcher && switchableLocations.length > 0 && (
            <LocationSwitcher
              locations={switchableLocations}
              activeLocationId={activeLocationId}
              onChange={setActiveLocationId}
            />
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Desktop right controls */}
        <div className={collapsed ? 'hidden' : 'flex items-center gap-2'}>
          {showQuickSell && currentPath !== '/till' && (
            <button
              onClick={() => handleNav('/till')}
              style={{
                border: '0.5px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-accent)',
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 14px',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              Sell
            </button>
          )}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              border: '0.5px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              width: 30,
              height: 30,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 10,
              marginLeft: 4,
              borderLeft: '0.5px solid var(--border)',
            }}
          >
            <span
              role="img"
              aria-label={`Signed in as ${staff.name}`}
              title={`${staff.name} (${staff.role})`}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--surface-3)',
                color: 'var(--text-secondary)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'default',
              }}
            >
              {nameInitials(staff.name)}
            </span>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            style={{
              border: '0.5px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 12,
              padding: '5px 10px',
              borderRadius: 7,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <PowerIcon size={13} /> Sign out
          </button>
        </div>

        {/* Mobile controls */}
        <div className={collapsed ? 'flex items-center gap-2' : 'hidden'}>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              padding: 6,
              borderRadius: 6,
              cursor: 'pointer',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Toggle navigation"
          >
            <HamburgerIcon open={mobileOpen} size={22} />
          </button>
          {/* Initials only here: a sign-out button right next to the menu
              toggle was one mis-tap from logging the cashier out mid-sale.
              Sign out lives at the bottom of the menu instead. */}
          <span
            role="img"
            aria-label={`Signed in as ${staff.name}`}
            title={`${staff.name} (${staff.role})`}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--surface-3)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {nameInitials(staff.name)}
          </span>
        </div>
      </div>

      {/* Requesting-shop confirmation: their refill request was fulfilled. */}
      {refillFulfilled > dismissedFulfilled && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--status-success) 12%, transparent)',
            border: '0.5px solid var(--status-success)',
            color: 'var(--status-success)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span>
            {refillFulfilled} refill request{refillFulfilled === 1 ? '' : 's'} fulfilled. Cylinders are on the way back to this shop.
          </span>
          {(staff.role === 'admin' || staff.role === 'supervisor') && (
            <button
              type="button"
              onClick={() => handleNav('/catalog?tab=refill-requests')}
              style={{
                border: 'none',
                background: 'var(--status-success)',
                color: 'var(--on-primary)',
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              View
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(dismissalKey, String(refillFulfilled));
              setDismissedFulfilled(refillFulfilled);
            }}
            title="Dismiss"
            aria-label="Dismiss"
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--status-success)',
              cursor: 'pointer',
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconX size={16} stroke={2} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div
          role="presentation"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            top: navRef.current?.getBoundingClientRect().bottom || 72,
            right: 0,
            bottom: 0,
            left: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 2000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 'min(82vw, 320px)',
              height: '100%',
              background: 'var(--surface-2)',
              borderLeft: '0.5px solid var(--border)',
              padding: '16px',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.2)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Who is signed in, and where -- the two things a cashier
                needs to confirm before ringing anything up. */}
            <div
              style={{
                padding: 12,
                marginBottom: 12,
                borderRadius: 12,
                background: 'var(--surface-1)',
                border: '0.5px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--bg-accent)',
                    color: 'var(--text-accent)',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {nameInitials(staff.name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {staff.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {staff.role}
                    {!showLocationSwitcher && activeLocationName ? ` · ${activeLocationName}` : ''}
                  </div>
                </div>
              </div>
              {showLocationSwitcher && switchableLocations.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <LocationSwitcher
                    fullWidth
                    locations={switchableLocations}
                    activeLocationId={activeLocationId}
                    onChange={(id) => {
                      setMobileOpen(false);
                      setActiveLocationId(id);
                    }}
                  />
                </div>
              )}
              {showQuickSell && currentPath !== '/till' && (
                <button
                  type="button"
                  onClick={() => handleNav('/till')}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    minHeight: 44,
                    border: 'none',
                    borderRadius: 10,
                    background: 'var(--primary)',
                    color: 'var(--on-primary)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <IconCashRegister size={18} stroke={1.75} aria-hidden="true" /> Open till
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  currentPath={currentPath}
                  onClick={() => handleNav(item.path)}
                  onBadgeClick={() => handleNav('/catalog?tab=refill-requests')}
                  mobile
                  badge={item.path === '/catalog' ? refillWaiting : 0}
                />
              ))}
            </div>

            {/* Pinned to the bottom so it never sits mid-list, and kept
                away from the menu toggle so it can't be hit by accident. */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 12,
                borderTop: '0.5px solid var(--border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={toggleTheme}
                style={{
                  minHeight: 44,
                  border: '0.5px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--surface-1)',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {theme === 'dark'
                  ? <IconSun size={17} stroke={1.75} aria-hidden="true" />
                  : <IconMoon size={17} stroke={1.75} aria-hidden="true" />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                style={{
                  minHeight: 44,
                  border: '0.5px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--surface-1)',
                  color: 'var(--status-error)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <IconLogout size={17} stroke={1.75} aria-hidden="true" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
