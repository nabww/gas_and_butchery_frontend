const TEZI_URL = "https://tezi.co.ke";

/**
 * Subtle, clickable "designed & developed by" credit. Deliberately small
 * and muted -- meant to be noticed if someone looks, not compete with the
 * actual page content on a screen (like the Till) that's used all day.
 */
export default function BrandFooter() {
  return (
    <footer
      style={{
        padding: "8px 16px",
        textAlign: "center",
      }}
    >
      <a
        href={TEZI_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
      >
        Designed &amp; developed by Tezi Technologies Ltd
      </a>
    </footer>
  );
}
