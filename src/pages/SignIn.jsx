import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/useTheme';
import { login, getBusinessConfig } from '../lib/api';
import BrandFooter from '../components/BrandFooter';

const PIN_LENGTH = 6;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function SignIn({ onSignedIn, businessName = "George's Butchery & Gas", branch = 'Main branch · Till 1' }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [businessConfig, setBusinessConfig] = useState(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    getBusinessConfig()
      .then(setBusinessConfig)
      .catch((err) => console.warn('Failed to load business config for login screen', err));
  }, []);

  const handleKey = (key) => {
    setError(null);
    if (key === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === '' || pin.length >= PIN_LENGTH) return;

    const next = pin + key;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      submit(next);
    }
  };

  const submit = async (fullPin) => {
    setSubmitting(true);
    try {
      const result = await login(fullPin);
      onSignedIn?.(result);
    } catch (err) {
      setError(err.message || 'Invalid PIN');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  // Kiosk touch keypad is the primary input, but anyone on a laptop/desktop
  // should be able to type their PIN on a physical keyboard too -- number
  // row, numpad, Backspace, and Enter to submit early once 6 digits are in.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (submitting) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKey('del');
      } else if (e.key === 'Enter' && pin.length === PIN_LENGTH) {
        e.preventDefault();
        submit(pin);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, submitting]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-1)',
      }}
    >
      <div
        style={{
          background: 'var(--surface-1)',
          borderRadius: 12,
          padding: '32px 24px',
          border: '0.5px solid var(--border)',
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {businessConfig?.business_logo_url && (
          <img
            src={businessConfig.business_logo_url}
            alt={businessConfig?.business_name || businessName}
            style={{
              maxHeight: 80,
              maxWidth: '100%',
              margin: '0 auto 16px',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        )}
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px' }}>
          {businessConfig?.business_name || businessName}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 28px' }}>
          {businessConfig?.business_tagline || branch}
        </p>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
          Enter your PIN
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                display: 'inline-block',
                background: i < pin.length ? 'var(--text-accent)' : 'transparent',
                border: i < pin.length ? 'none' : '1.5px solid var(--border-strong)',
              }}
            />
          ))}
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--text-danger)', margin: '0 0 12px' }}>
            {error}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            maxWidth: 280,
            margin: '0 auto',
          }}
        >
          {KEYPAD.map((key, i) =>
            key === '' ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                onClick={() => handleKey(key)}
                disabled={submitting}
                style={{ height: 60, fontSize: key === 'del' ? 16 : 20 }}
              >
                {key === 'del' ? '⌫' : key}
              </button>
            )
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 24,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <span>{navigator.onLine ? 'Online' : 'Offline — queued locally'}</span>
          <span style={{ margin: '0 4px' }}>·</span>
          <button
            onClick={toggleTheme}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              fontSize: 12,
              color: 'var(--text-secondary)',
              textDecoration: 'underline',
              height: 'auto',
            }}
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>
      <BrandFooter />
    </div>
  );
}
