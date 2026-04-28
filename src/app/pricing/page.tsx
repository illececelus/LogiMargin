import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

const plans = [
  { name: 'Starter', price: '$29', features: ['1 truck', 'Load analyzer', 'Detention timer'] },
  { name: 'Pro', price: '$59', features: ['Up to 5 trucks', 'AI document review', 'Broker scorecards'] },
  { name: 'Fleet', price: '$149', features: ['Unlimited trucks', 'IFTA reports', 'Priority support'] },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">Pricing</p>
          <h1 className="mt-3 text-4xl font-black">Plans for owner-operators and fleets</h1>
          <p className="mt-3 text-slate-400">Billing activation is coming in the next product phase.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map(plan => (
            <div key={plan.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <p className="mt-2 font-mono text-4xl font-black text-emerald-300">{plan.price}<span className="text-sm text-slate-400">/mo</span></p>
              <ul className="mt-6 space-y-2">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link href="/signup" className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300">
            Start trial setup
          </Link>
        </div>
      </div>
    </main>
  );
}
