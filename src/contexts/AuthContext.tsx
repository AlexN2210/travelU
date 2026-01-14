import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ data: { user: User | null } | null; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
      })();
    });
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Tentative d\'inscription pour:', email);
      if (import.meta.env.DEV) {
        console.log('URL Supabase:', import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...');
      }
      
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            email_verified: false
          }
        }
      });
      
      console.log('Réponse signUp:', { 
        hasError: !!error, 
        errorMessage: error?.message,
        hasUser: !!data?.user,
        userEmail: data?.user?.email,
        sessionExists: !!data?.session
      });
      
      // Si pas d'erreur mais qu'on a besoin de confirmer l'email, on considère ça comme un succès
      // Même si pas de session immédiate (confirmation email requise)
      if (!error && data?.user) {
        console.log('Inscription réussie (email peut nécessiter confirmation)');
        return { data: { user: data.user }, error: null };
      }
      
      if (error) {
        console.error('Erreur Supabase:', {
          message: error.message,
          status: (error as any).status,
          name: error.name,
          fullError: error
        });
      }
      
      return { data: null, error: error as Error | null };
    } catch (error) {
      console.error('Exception lors de l\'inscription:', error);
      return { data: null, error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
