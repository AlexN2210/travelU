import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  
  throw new Error(
    `Variables d'environnement Supabase manquantes: ${missingVars.join(', ')}\n` +
    'Créez un fichier .env à la racine du projet avec:\n' +
    'VITE_SUPABASE_URL=https://votre-projet.supabase.co\n' +
    'VITE_SUPABASE_ANON_KEY=votre-clé-anon-ici\n\n' +
    'Récupérez ces valeurs depuis: https://app.supabase.com/project/_/settings/api'
  );
}

// Vérifier que l'URL et la clé ne sont pas les valeurs par défaut
if (supabaseUrl.includes('votre-projet') || supabaseAnonKey.includes('votre-clé')) {
  console.warn('⚠️ Les variables d\'environnement Supabase semblent être des valeurs par défaut. Vérifiez votre fichier .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-client-info': 'travelu-app',
    },
  },
});

// Logger pour débogage (seulement en développement)
if (import.meta.env.DEV) {
  console.log('✅ Client Supabase initialisé:', {
    url: supabaseUrl.substring(0, 30) + '...',
    hasKey: !!supabaseAnonKey,
    keyLength: supabaseAnonKey?.length || 0
  });
  
  // Vérifier la connexion
  supabase.auth.getSession().then(({ error }) => {
    if (error) {
      console.warn('⚠️ Erreur lors de la vérification de session:', error);
    }
  });
}
