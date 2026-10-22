export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
    return;
  }

  const register = () =>
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.error('Service worker registration failed:', err));

  // Called from an effect, which can run after `load` has already fired.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
