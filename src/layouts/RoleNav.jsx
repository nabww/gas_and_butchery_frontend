import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/useTheme';
import { useActiveLocation } from '../contexts/LocationContext';

function HamburgerIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1={open ? 3 : 2} y1="5" x2={open ? 17 : 18} y2={open ? 15 : 5} />
      <line x1="2" y1="10" x2="18" y2="10" style={{ opacity: open ? 0 : 1, transition: 'opacity 0.15s' }} />
      <line x1={open ? 3 : 2} y1="15" x2={open ? 17 : 18} y2={open ? 5 : 15} />
    </svg>
  );
}

// Nav items per role, per build plan Section 5b. The nav only renders
// what a person can access -- no greyed-out items cluttering a screen
// built for speed.
const NAV_BY_ROLE = {
  cashier: [{ label: 'Till', path: '/till' }],
  supervisor: [
    { label: 'Till', path: '/till' },
    { label: 'Overrides', path: '/overrides' },
    { label: 'Catalog', path: '/catalog' },
  ],
  admin: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Till', path: '/till' },
    { label: 'Reports', path: '/reports' },
    { label: 'Customers', path: '/customers' },
    { label: 'Staff', path: '/staff' },
    { label: 'Catalog', path: '/catalog' },
    { label: 'Rewards', path: '/rewards' },
    { label: 'Promos', path: '/promotions' },
    { label: 'Corporate', path: '/corporate' },
    { label: 'Settings', path: '/settings' },
  ],
};

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
        <span>{active?.name || 'Select shop'}</span>
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

function NavItem({ item, currentPath, onClick, mobile }) {
  const active = currentPath === item.path;
  return (
    <button
      onClick={onClick}
      style={{
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
    </button>
  );
}

export default function RoleNav({ staff, currentPath, onNavigate, onSignOut }) {
  const items = NAV_BY_ROLE[staff.role] || [];
  const showQuickSell = staff.role === 'admin' || staff.role === 'supervisor';
  const showLocationSwitcher =
    staff.role === 'admin' || (staff.role === 'supervisor' && staff.canSwitchLocation);
  const { theme, toggleTheme } = useTheme();
  const { locations, activeLocationId, setActiveLocationId } = useActiveLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (path) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--surface-2)',
        position: 'relative',
        zIndex: 100,
      }}
    >
      <span style={{ fontWeight: 600, marginRight: 16, color: 'var(--text-primary)' }}>
        TeziPOS
      </span>

      {/* Desktop nav links */}
      <div className="hidden md:flex items-center gap-1">
        {items.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            currentPath={currentPath}
            onClick={() => handleNav(item.path)}
            mobile={false}
          />
        ))}

        {showLocationSwitcher && locations.length > 0 && (
          <LocationSwitcher
            locations={locations}
            activeLocationId={activeLocationId}
            onChange={setActiveLocationId}
          />
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Desktop right controls */}
      <div className="hidden md:flex items-center gap-3">
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
        className="md:hidden"
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

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          className="md:hidden"
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
                mobile
              />
            ))}
          </div>

          {showLocationSwitcher && locations.length > 0 && (
            <div className="pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <LocationSwitcher
                locations={locations}
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
