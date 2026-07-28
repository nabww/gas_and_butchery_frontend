/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface1: 'var(--surface-1)',
        surface2: 'var(--surface-2)',
        surface3: 'var(--surface-3)',
        border: 'var(--border)',
        borderColor: 'var(--border-color)',
        borderStrong: 'var(--border-strong)',
        borderAccent: 'var(--border-accent)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        textMuted: 'var(--text-muted)',
        textAccent: 'var(--text-accent)',
        primary: 'var(--primary)',
        primaryDark: 'var(--primary-dark)',
        primaryLight: 'var(--primary-light)',
        onPrimary: 'var(--on-primary)',
        success: 'var(--status-success)',
        warning: 'var(--status-warning)',
        danger: 'var(--status-error)',
        info: 'var(--status-info)',
        butchery: 'var(--category-butchery)',
        gas: 'var(--category-gas)',
        loyalty: 'var(--category-loyalty)',
      },
      boxShadow: {
        card: 'var(--shadow-md)',
        'card-hover': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
