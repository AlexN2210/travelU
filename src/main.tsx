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
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // check toutes les 30 minutes
    window.setInterval(() => {
      registration.update().catch(() => {});
    }, 30 * 60 * 1000);
  },
  onNeedRefresh() {
    // Appliquer la MAJ immédiatement
    updateSW(true);
  }
});
