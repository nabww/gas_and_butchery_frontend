import { useTheme } from '../lib/useTheme';

// Nav items per role, per build plan Section 5b. The nav only renders
// what a person can access -- no greyed-out items cluttering a screen
// built for speed.
const NAV_BY_ROLE = {
  cashier: [{ label: 'Till', path: '/till' }],
  supervisor: [
    { label: 'Till', path: '/till' },
    { label: 'Overrides', path: '/overrides' },
    { label: 'Stock', path: '/stock' },
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
    { label: 'Stock', path: '/stock' },
    { label: 'Settings', path: '/settings' },
  ],
};

export default function RoleNav({ staff, currentPath, onNavigate, onSignOut }) {
  const items = NAV_BY_ROLE[staff.role] || [];
  const showQuickSell = staff.role === 'admin' || staff.role === 'supervisor';
  const { theme, toggleTheme } = useTheme();

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--surface-2)',
      }}
    >
      <span style={{ fontWeight: 600, marginRight: 16, color: 'var(--text-primary)' }}>
        TeziPOS
      </span>

      {items.map((item) => (
        <button
          key={item.path}
          onClick={() => onNavigate(item.path)}
          style={{
            border: 'none',
            background: currentPath === item.path ? 'var(--bg-accent)' : 'transparent',
            color: currentPath === item.path ? 'var(--text-accent)' : 'var(--text-secondary)',
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          {item.label}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {/* Quick "Sell" access -- text-only, always visible, lets an admin/
          supervisor jump straight to the till without leaving their
          normal dashboard-first flow (build plan Section 5b). */}
      {showQuickSell && currentPath !== '/till' && (
        <button
          onClick={() => onNavigate('/till')}
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
    </nav>
  );
}
