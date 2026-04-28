'use client';
import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/utils/supabase/client';

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage('Password updated. Redirecting to login...');
    setTimeout(() => router.replace('/login'), 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <Card className="w-full max-w-md bg-white/[0.04] backdrop-blur-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
            <KeyRound className="h-6 w-6 text-emerald-300" />
          </div>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <p className="text-sm text-slate-400">Enter a new password after opening the Supabase reset link.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
            {message && <p className="rounded-lg border border-profit/30 bg-profit/10 p-3 text-sm text-profit">{message}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
