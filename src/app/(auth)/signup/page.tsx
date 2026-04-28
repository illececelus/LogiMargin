import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SignupPlaceholderPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <Card className="w-full max-w-md bg-white/[0.04] backdrop-blur-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
            <UserPlus className="h-6 w-6 text-emerald-300" />
          </div>
          <CardTitle className="text-2xl">Signup yakında</CardTitle>
          <p className="text-sm text-slate-400">Tam onboarding akışı bir sonraki fazda tamamlanacak.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/login">Login ekranına dön</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Dashboard demosuna bak</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
