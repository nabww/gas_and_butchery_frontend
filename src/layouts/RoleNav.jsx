import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/useTheme';
import { useActiveLocation } from '../contexts/LocationContext';
import { MODULE_CATALOG, effectiveModules } from '../lib/modules';
import { getBusinessConfig, listRefillRequests } from '../lib/api';

function HamburgerIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1={open ? 3 : 2} y1="5" x2={open ? 17 : 18} y2={open ? 15 : 5} />
      <line x1="2" y1="10" x2="18" y2="10" style={{ opacity: open ? 0 : 1, transition: 'opacity 0.15s' }} />
      <line x1={open ? 3 : 2} y1="15" x2={open ? 17 : 18} y2={open ? 5 : 15} />
    </svg>
  );
}

// Shop switcher — admins can always switch shops; a supervisor only sees
// this if explicitly granted `can_switch_location` (per-staff override,
// same pattern as can_redeem_points). Cashiers never see it.
function LocationSwitcher({ locations, activeLocationId, onChange }) {
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
    <div ref={wrapperRef} style={{ position: 'relative', marginLeft: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Switch active shop"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 999,
          border: '0.5px solid var(--border)',
          background: 'var(--surface-1)',
          color: 'var(--text-primary)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        <span aria-hidden="true">🏬</span>
        <span>{active?.name || 'All locations'}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
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
            <span aria-hidden="true">{!activeLocationId ? '📍' : '🏬'}</span>
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
                <span aria-hidden="true">{isActive ? '📍' : '🏪'}</span>
                {loc.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavItem({ item, currentPath, onClick, onBadgeClick, mobile, badge }) {
  const active = currentPath === item.path || currentPath?.startsWith(`${item.path}?`);
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        border: 'none',
        background: active ? 'var(--bg-accent)' : 'transparent',
        color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
        padding: '8px 12px',
        fontSize: mobile ? 14 : 13,
        textAlign: mobile ? 'left' : 'center',
        width: mobile ? '100%' : 'auto',
        borderRadius: 6,
      }}
    >
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
            background: 'var(--danger, #e55353)',
            color: '#fff',
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [businessConfig, setBusinessConfig] = useState(null);
  // Refill requests are directional: the stock store sees a badge for requests
  // waiting on them; the requesting shop sees a green banner once fulfilled
  // (recent — fulfilled within the last 7 days).
  const [refillWaiting, setRefillWaiting] = useState(0);
  const [refillFulfilled, setRefillFulfilled] = useState(0);
  // Dismissed-count: closing the green banner hides it until another
  // request is fulfilled (count rises above what was dismissed).
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

  useEffect(() => { setDismissedFulfilled(0); }, [activeLocationId]);

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
              style={{ height: 60, maxWidth: 180, objectFit: 'contain' }}
            />
          ) : (
            businessConfig?.business_name || 'TeziPOS'
          )}
        </button>

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
        <div className={collapsed ? 'hidden' : 'flex items-center gap-3'}>
          {showQuickSell && currentPath !== '/till' && (
            <button
              onClick={() => handleNav('/till')}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--text-accent)',
                fontSize: 13,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Sell
            </button>
          )}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              border: 'none',
              background: 'none',
              fontSize: 12,
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{staff.name}</span>
          <button onClick={onSignOut} style={{ border: 'none', background: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className={collapsed ? 'block' : 'hidden'}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            padding: 6,
            borderRadius: 6,
            cursor: 'pointer',
          }}
          aria-label="Toggle navigation"
        >
          <HamburgerIcon open={mobileOpen} />
        </button>
      </div>

      {/* Requesting-shop confirmation: their refill request was fulfilled. */}
      {refillFulfilled > dismissedFulfilled && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(45, 180, 100, 0.12)',
            border: '0.5px solid #2db464',
            color: '#2db464',
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
            {refillFulfilled} refill request{refillFulfilled === 1 ? '' : 's'} fulfilled — cylinders on the way back to this shop.
          </span>
          {(staff.role === 'admin' || staff.role === 'supervisor') && (
            <button
              type="button"
              onClick={() => handleNav('/catalog?tab=refill-requests')}
              style={{
                border: 'none',
                background: '#2db464',
                color: '#fff',
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
            onClick={() => setDismissedFulfilled(refillFulfilled)}
            title="Dismiss"
            style={{
              border: 'none',
              background: 'none',
              color: '#2db464',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--surface-2)',
            borderBottom: '0.5px solid var(--border)',
            padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 99,
          }}
        >
          <div className="space-y-2 mb-4">
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

          {showLocationSwitcher && switchableLocations.length > 0 && (
            <div className="pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <LocationSwitcher
                locations={switchableLocations}
                activeLocationId={activeLocationId}
                onChange={(id) => {
                  setMobileOpen(false);
                  setActiveLocationId(id);
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {showQuickSell && currentPath !== '/till' && (
              <button
                onClick={() => handleNav('/till')}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-accent)',
                  fontSize: 13,
                  textDecoration: 'underline',
                }}
              >
                Sell
              </button>
            )}
            <button
              onClick={toggleTheme}
              style={{ border: 'none', background: 'none', fontSize: 12, color: 'var(--text-muted)' }}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{staff.name}</span>
            <button onClick={onSignOut} style={{ border: 'none', background: 'none', fontSize: 12, color: 'var(--text-muted)' }}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
