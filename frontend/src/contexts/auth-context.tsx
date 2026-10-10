'use client';

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { connectWallet, ensureHederaNetwork, signMessage } from '@/lib/wallet';
import { walletLinkMessage } from '@/lib/wallet-message';

interface AuthContextValue {
  configured: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Returns true when the project requires email confirmation before the first sign-in. */
  signUpWithEmail: (email: string, password: string, displayName: string, organization?: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (changes: Partial<Pick<Profile, 'display_name' | 'organization'>>) => Promise<void>;
  /** Connects MetaMask, proves ownership with a signature and links the wallet to this account. */
  linkWallet: () => Promise<Profile>;
  unlinkWallet: () => Promise<void>;
  /** The sign-in dialog, rendered once by the navbar and openable from anywhere. */
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setIsLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (active) setIsLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Supabase warns against awaiting other Supabase calls inside this callback.
      setTimeout(() => loadProfile(next?.user.id), 0);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const userId = session?.user.id;
    return {
      configured: supabaseConfigured,
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      isAuthenticated: Boolean(session),

      async signInWithEmail(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },

      async signUpWithEmail(email, password, displayName, organization) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session && organization) {
          await supabase.from('profiles').update({ organization }).eq('id', data.session.user.id);
        }
        return { needsConfirmation: !data.session };
      },

      async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
      },

      async signOut() {
        await supabase.auth.signOut();
        setProfile(null);
      },

      async refreshProfile() {
        await loadProfile(userId);
      },

      async updateProfile(changes) {
        if (!userId) throw new Error('Not signed in');
        const { data, error } = await supabase.from('profiles').update(changes).eq('id', userId).select('*').single<Profile>();
        if (error) throw error;
        setProfile(data);
      },

      async linkWallet() {
        if (!userId) throw new Error('Not signed in');
        const address = await connectWallet();
        await ensureHederaNetwork();
        const issuedAt = new Date().toISOString();
        const signature = await signMessage(address, walletLinkMessage(userId, address, issuedAt));
        const { profile: updated } = await api<{ profile: Profile }>('/api/wallet', { body: { address, issuedAt, signature } });
        setProfile(updated);
        return updated;
      },

      async unlinkWallet() {
        const { profile: updated } = await api<{ profile: Profile }>('/api/wallet', { method: 'DELETE' });
        setProfile(updated);
      },

      authModalOpen,
      openAuthModal: () => setAuthModalOpen(true),
      closeAuthModal: () => setAuthModalOpen(false),
    };
  }, [session, profile, isLoading, loadProfile, authModalOpen]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
