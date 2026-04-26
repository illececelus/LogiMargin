'use client';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Star, Clock, DollarSign, BarChart2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import type { BrokerScore } from '@/app/api/broker-scores/route';

function GradeBadge({ grade, color }: { grade: string; color: string }) {
  const cls =
    color === 'profit'  ? 'bg-profit/15 text-profit border-profit/30' :
    color === 'primary' ? 'bg-primary/15 text-primary border-primary/30' :
    color === 'warning' ? 'bg-warning/15 text-warning border-warning/30' :
                          'bg-danger/15 text-danger border-danger/30';
  return (
    <span className={cn('inline-flex items-center justify-center w-9 h-9 rounded-full border-2 font-black text-lg', cls)}>
      {grade}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-profit' :
    score >= 55 ? 'bg-primary' :
    score >= 35 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

export function BrokerScorecard() {
  const { data: brokers, isLoading, error, refetch } = useQuery<BrokerScore[]>({
    queryKey: ['broker-scores'],
    queryFn: async () => {
      const res = await fetch('/api/broker-scores');
      if (!res.ok) throw new Error('Failed to load broker scores');
      return res.json();
    },
    staleTime: 60_000,
  });

  const gradeCount = (g: string) => brokers?.filter(b => b.grade === g).length ?? 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" /> Broker Skor Kartı
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Geçmiş yüklere göre broker güven analizi — margin, ödeme hızı ve dispute oranı.
        </p>
      </div>

      {/* Özet banner */}
      {brokers && brokers.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(['A', 'B', 'C', 'D'] as const).map(g => {
            const colors = { A: 'text-profit', B: 'text-primary', C: 'text-warning', D: 'text-danger' };
            return (
              <Card key={g} className="text-center py-3">
                <p className={cn('text-2xl font-black', colors[g])}>{gradeCount(g)}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Grade {g}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-danger mb-2" />
          <p className="text-sm text-danger font-medium">Broker verileri yüklenemedi.</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-primary underline">Tekrar dene</button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && brokers?.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-2">
            <BarChart2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Henüz yeterli broker verisi yok</p>
            <p className="text-sm text-muted-foreground">RateCon yükleyip yük onayladıkça burada skor kartları oluşacak.</p>
          </CardContent>
        </Card>
      )}

      {/* Broker kartları */}
      {brokers && brokers.length > 0 && (
        <div className="space-y-3">
          {brokers.map(b => (
            <Card key={b.brokerName} className={cn(
              'border',
              b.grade === 'A' ? 'border-profit/20' :
              b.grade === 'B' ? 'border-primary/20' :
              b.grade === 'C' ? 'border-warning/20' : 'border-danger/20'
            )}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  {/* Grade circle */}
                  <GradeBadge grade={b.grade} color={b.gradeColor} />

                  <div className="flex-1 min-w-0">
                    {/* Broker adı + skor */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm truncate">{b.brokerName}</p>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{b.score}/100</span>
                    </div>
                    <ScoreBar score={b.score} />

                    {/* Metrikler */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Yük
                        </p>
                        <p className="text-sm font-semibold mt-0.5">{b.totalLoads}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Ort. Gross
                        </p>
                        <p className="text-sm font-semibold mt-0.5">{fmt.currency(b.avgGrossPay, 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ort. Margin</p>
                        <p className={cn('text-sm font-semibold mt-0.5',
                          b.avgMarginPct >= 20 ? 'text-profit' :
                          b.avgMarginPct >= 12 ? 'text-warning' : 'text-danger'
                        )}>
                          {b.avgMarginPct.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Ödeme
                        </p>
                        <p className={cn('text-sm font-semibold mt-0.5',
                          b.avgPaymentDays === null ? 'text-muted-foreground' :
                          b.avgPaymentDays <= 30 ? 'text-profit' :
                          b.avgPaymentDays <= 45 ? 'text-warning' : 'text-danger'
                        )}>
                          {b.avgPaymentDays !== null ? `${b.avgPaymentDays} gün` : '—'}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Tavsiye + dispute */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {b.grade === 'A' || b.grade === 'B'
                          ? <CheckCircle2 className="h-4 w-4 text-profit shrink-0" />
                          : <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                        }
                        <p className="text-xs text-muted-foreground">{b.recommendation}</p>
                      </div>
                      {b.disputeCount > 0 && (
                        <Badge variant="danger" className="text-[10px] shrink-0">
                          {b.disputeCount} dispute
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
