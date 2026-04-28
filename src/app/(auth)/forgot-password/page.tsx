'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/utils/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setMessage('Password reset link sent if this email exists.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <Card className="w-full max-w-md bg-white/[0.04] backdrop-blur-md">
        <CardHeader className="text-center">
          <Mail className="mx-auto h-8 w-8 text-emerald-300" />
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {message && <p className="rounded-lg border border-profit/30 bg-profit/10 p-3 text-sm text-profit">{message}</p>}
            {error && <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full">Send Reset Link</Button>
          </form>
          <Link href="/login" className="mt-4 block text-center text-xs text-emerald-300 hover:underline">Back to login</Link>
        </CardContent>
      </Card>
    </main>
  );
}
