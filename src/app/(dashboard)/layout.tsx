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
      const res  = await fetch('/api/upload-draft', { method: 'POST', body: form });
      const json = await res.json();
      if (json.redirectTo) router.push(json.redirectTo);
    } catch {
      alert('Upload failed. Try again.');
    }
    e.target.value = '';
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black tracking-tight text-primary">LOGI</span>
            <span className="text-lg font-black tracking-tight">MARGIN</span>
            <span className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30">
              TX v7
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
              return (
                <Link key={href} href={href} className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 sm:px-6">
        {children}
      </main>

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
          'fixed bottom-6 right-5 z-50',
          'w-16 h-16 rounded-full shadow-lg',
          'bg-primary text-primary-foreground',
          'flex items-center justify-center',
          'active:scale-95 transition-transform',
          'hover:bg-primary/90',
        )}
        title="Upload RateCon / BOL"
        aria-label="Upload document"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
