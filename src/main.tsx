import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);

// PWA: mise à jour automatique
// - vérifie périodiquement les updates
// - quand une nouvelle version est dispo, on l’applique + reload (surtout utile en mode PWA installée)
let lastRegistration: ServiceWorkerRegistration | null = null;
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    lastRegistration = registration;

    const check = () => {
      registration.update().catch(() => {});
      // Si une nouvelle version est déjà en attente, on l’applique directement.
      if (registration.waiting) {
        updateSW(true);
        // Fallback iOS: certains cas ne reload pas correctement
        window.setTimeout(() => window.location.reload(), 1200);
      }
    };

    // check toutes les 30 minutes
    window.setInterval(() => {
      check();
    }, 10 * 60 * 1000);

    // iOS/PWA: forcer un check quand l’app redevient visible ou quand le réseau revient
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('online', check);
  },
  onNeedRefresh() {
    // Appliquer la MAJ immédiatement
    updateSW(true);
    // Fallback iOS: certains cas ne reload pas correctement
    window.setTimeout(() => window.location.reload(), 1200);
  }
});

// Sécurité: si l’app charge avant que le SW soit “registered”, on retente une fois au focus
window.addEventListener('focus', () => {
  if (lastRegistration) lastRegistration.update().catch(() => {});
});
