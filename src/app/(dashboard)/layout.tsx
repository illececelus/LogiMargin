'use client';
// ============================================================
// LogiMargin v7 — Dashboard Layout
// Mobile-first nav + floating Upload shortcut button
// ============================================================
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef } from 'react';
import { LayoutDashboard, Truck, DollarSign, Wrench, Timer, Star, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/supabase-auth';

const NAV = [
  { href: '/',            label: 'Dashboard',  Icon: LayoutDashboard },
  { href: '/loads',       label: 'Loads',      Icon: Truck           },
  { href: '/factoring',   label: 'Factoring',  Icon: DollarSign      },
  { href: '/brokers',     label: 'Brokers',    Icon: Star            },
  { href: '/maintenance', label: 'Mechanic',   Icon: Wrench          },
  { href: '/detention',   label: 'Detention',  Icon: Timer           },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('docType', 'ratecon');
    try {
      const res  = await authFetch('/api/upload-draft', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Upload failed. Try again.');
      }
      if (!json.redirectTo) {
        throw new Error('Upload succeeded but no draft redirect was returned.');
      }
      router.push(json.redirectTo);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed. Try again.');
    }
    e.target.value = '';
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.1),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1.5">
            <span className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-lg font-black tracking-tight text-emerald-300 shadow-lg shadow-emerald-950/30">LOGI</span>
            <span className="text-lg font-black tracking-tight text-slate-100">MARGIN</span>
            <span className="ml-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              TX v7
            </span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
              return (
                <Link key={href} href={href} className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                  active
                    ? 'border border-emerald-400/30 bg-emerald-400/15 text-emerald-200 shadow-sm shadow-emerald-950/40'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                )}>
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 pb-32 pt-6 sm:px-6">
        {children}
      </main>

      <nav className="fixed inset-x-3 bottom-4 z-50 grid grid-cols-6 rounded-2xl border border-white/10 bg-slate-950/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl md:hidden">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-all',
                active
                  ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/25'
                  : 'text-slate-500 hover:text-slate-200'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Floating Upload Button — Zero-UI entry point */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className={cn(
          'fixed bottom-24 right-5 z-50 md:bottom-6',
          'h-16 w-16 rounded-full shadow-2xl shadow-emerald-950/60',
          'bg-emerald-400 text-slate-950',
          'flex items-center justify-center',
          'active:scale-95 transition-transform',
          'hover:bg-emerald-300',
        )}
        title="Upload RateCon / BOL"
        aria-label="Upload document"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
