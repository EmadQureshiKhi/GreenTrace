'use client';

import { Building2, Chrome, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';

function Field({
  id,
  label,
  icon: Icon,
  ...input
}: { id: string; label: string; icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} className="pl-10" {...input} />
      </div>
    </div>
  );
}

/** Asks Supabase which sign-in providers are enabled, so the dialog never offers one that will fail. */
function useGoogleEnabled(active: boolean): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!active || !url || !key) return;
    let cancelled = false;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((res) => (res.ok ? res.json() : null))
      .then((settings: { external?: Record<string, boolean> } | null) => {
        if (!cancelled) setEnabled(Boolean(settings?.external?.google));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active]);
  return enabled;
}

export function AuthModal() {
  const { authModalOpen, closeAuthModal, signInWithEmail, signUpWithEmail, signInWithGoogle, configured } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [form, setForm] = useState({ email: '', password: '', displayName: '', organization: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const googleEnabled = useGoogleEnabled(authModalOpen);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tab === 'signin') {
        await signInWithEmail(form.email.trim(), form.password);
        toast({ title: 'Signed in' });
        closeAuthModal();
      } else {
        const { needsConfirmation } = await signUpWithEmail(form.email.trim(), form.password, form.displayName.trim(), form.organization.trim() || undefined);
        if (needsConfirmation) {
          setConfirmationSentTo(form.email.trim());
        } else {
          toast({ title: 'Account created', description: 'Welcome to GreenTrace.' });
          closeAuthModal();
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const passwordToggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );

  return (
    <Dialog open={authModalOpen} onOpenChange={(open) => (open ? undefined : closeAuthModal())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to GreenTrace</DialogTitle>
          <DialogDescription>Measure, certify and offset your organization&apos;s emissions.</DialogDescription>
        </DialogHeader>

        {!configured ? (
          <Alert>
            <AlertDescription>Accounts are not available yet: the database is not configured on this server.</AlertDescription>
          </Alert>
        ) : confirmationSentTo ? (
          <div className="space-y-4 py-2 text-center">
            <Mail className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <span className="font-medium text-foreground">{confirmationSentTo}</span>. Open it to finish creating your account.
            </p>
            <Button variant="outline" onClick={() => { setConfirmationSentTo(null); setTab('signin'); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => { setTab(v as 'signin' | 'signup'); setError(null); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-4 space-y-4">
              <TabsContent value="signup" className="mt-0 space-y-4">
                <Field id="name" label="Your name" icon={User} value={form.displayName} onChange={set('displayName')} placeholder="Jane Doe" required={tab === 'signup'} autoComplete="name" />
                <Field id="organization" label="Organization (optional)" icon={Building2} value={form.organization} onChange={set('organization')} placeholder="Acme Manufacturing" autoComplete="organization" />
              </TabsContent>

              <Field id="email" label="Email" icon={Mail} type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" required autoComplete="email" />

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="pl-10 pr-10"
                    value={form.password}
                    onChange={set('password')}
                    placeholder={tab === 'signup' ? 'At least 8 characters' : 'Your password'}
                    minLength={tab === 'signup' ? 8 : undefined}
                    required
                    autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  />
                  {passwordToggle}
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tab === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            {googleEnabled && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
                  <Chrome className="mr-2 h-4 w-4" /> Continue with Google
                </Button>
              </>
            )}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              By continuing you agree to the{' '}
              <Link href="/terms" className="underline underline-offset-2 hover:text-foreground" onClick={closeAuthModal}>terms of use</Link> and the{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground" onClick={closeAuthModal}>privacy policy</Link>.
            </p>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
