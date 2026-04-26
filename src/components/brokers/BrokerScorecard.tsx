'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Star, Clock, DollarSign, BarChart2,
  Filter, ArrowUpDown, StickyNote,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn, fmt } from '@/lib/utils';
import type { BrokerScore } from '@/app/api/broker-scores/route';

type Grade = 'A' | 'B' | 'C' | 'D';
type SortKey = 'score' | 'totalLoads' | 'avgMarginPct' | 'avgPaymentDays';

function GradeBadge({ grade, color }: { grade: string; color: string }) {
  const cls =
    color === 'profit'  ? 'bg-profit/15 text-profit border-profit/30' :
    color === 'primary' ? 'bg-primary/15 text-primary border-primary/30' :
    color === 'warning' ? 'bg-warning/15 text-warning border-warning/30' :
                          'bg-danger/15 text-danger border-danger/30';
  return (
    <span className={cn('inline-flex items-center justify-center w-9 h-9 rounded-full border-2 font-black text-lg shrink-0', cls)}>
      {grade}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-profit' : score >= 55 ? 'bg-primary' :
    score >= 35 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

export function BrokerScorecard() {
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const { data: brokers, isLoading, error, refetch } = useQuery<BrokerScore[]>({
    queryKey: ['broker-scores'],
    queryFn: async () => {
      const res = await fetch('/api/broker-scores');
      if (!res.ok) throw new Error('Failed to load broker scores');
      return res.json();
    },
    staleTime: 60_000,
  });

  const gradeCount = (g: Grade) => brokers?.filter(b => b.grade === g).length ?? 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const filtered = (brokers ?? [])
    .filter(b => gradeFilter === 'all' || b.grade === gradeFilter)
    .sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });

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

      {/* Grade summary */}
      {brokers && brokers.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(['A', 'B', 'C', 'D'] as Grade[]).map(g => {
            const colors = { A: 'text-profit', B: 'text-primary', C: 'text-warning', D: 'text-danger' };
            const active = gradeFilter === g;
            return (
              <Card
                key={g}
                className={cn('text-center py-3 cursor-pointer transition-all hover:border-primary/40',
                  active ? 'border-primary ring-1 ring-primary/30' : ''
                )}
                onClick={() => setGradeFilter(active ? 'all' : g)}
              >
                <p className={cn('text-2xl font-black', colors[g])}>{gradeCount(g)}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Grade {g}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters & Sort */}
      {brokers && brokers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {gradeFilter !== 'all' && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => setGradeFilter('all')}>
              Grade {gradeFilter} ✕
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">Sırala:</span>
          {([
            { key: 'score' as SortKey,          label: 'Skor'     },
            { key: 'totalLoads' as SortKey,     label: 'Yük'      },
            { key: 'avgMarginPct' as SortKey,   label: 'Margin'   },
            { key: 'avgPaymentDays' as SortKey, label: 'Ödeme'    },
          ]).map(({ key, label }) => (
            <Button
              key={key}
              variant={sortKey === key ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => toggleSort(key)}
            >
              {label}
              {sortKey === key && <ArrowUpDown className="h-3 w-3 ml-1" />}
            </Button>
          ))}
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
            <p className="font-semibold">Henüz broker verisi yok</p>
            <p className="text-sm text-muted-foreground">RateCon yükleyip yük onayladıkça skor kartları oluşacak.</p>
          </CardContent>
        </Card>
      )}

      {/* Broker cards */}
      <div className="space-y-3">
        {filtered.map(b => (
          <Card key={b.brokerName} className={cn('border',
            b.grade === 'A' ? 'border-profit/20' : b.grade === 'B' ? 'border-primary/20' :
            b.grade === 'C' ? 'border-warning/20' : 'border-danger/30'
          )}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-4">
                <GradeBadge grade={b.grade} color={b.gradeColor} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm truncate">{b.brokerName}</p>
                    <span className="text-xs font-mono text-muted-foreground shrink-0">{b.score}/100</span>
                  </div>
                  <ScoreBar score={b.score} />

                  {/* Metrics */}
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
                        b.avgMarginPct >= 20 ? 'text-profit' : b.avgMarginPct >= 12 ? 'text-warning' : 'text-danger'
                      )}>{b.avgMarginPct.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Ödeme
                      </p>
                      <p className={cn('text-sm font-semibold mt-0.5',
                        b.avgPaymentDays === null ? 'text-muted-foreground' :
                        b.avgPaymentDays <= 30 ? 'text-profit' : b.avgPaymentDays <= 45 ? 'text-warning' : 'text-danger'
                      )}>{b.avgPaymentDays !== null ? `${b.avgPaymentDays} gün` : '—'}</p>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  {/* Recommendation + note */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {b.grade === 'A' || b.grade === 'B'
                          ? <CheckCircle2 className="h-4 w-4 text-profit shrink-0" />
                          : <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                        }
                        <p className="text-xs text-muted-foreground">{b.recommendation}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {b.grade === 'D' && (
                          <Badge variant="danger" className="text-[10px]">⚠️ Riskli</Badge>
                        )}
                        {b.disputeCount > 0 && (
                          <Badge variant="danger" className="text-[10px]">{b.disputeCount} dispute</Badge>
                        )}
                        <button
                          onClick={() => {
                            setEditingNote(editingNote === b.brokerName ? null : b.brokerName);
                            setNoteInput(notes[b.brokerName] ?? '');
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Not ekle"
                        >
                          <StickyNote className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Note display */}
                    {notes[b.brokerName] && editingNote !== b.brokerName && (
                      <div className="rounded-lg bg-warning/5 border border-warning/20 px-3 py-2">
                        <p className="text-xs text-warning">📝 {notes[b.brokerName]}</p>
                      </div>
                    )}

                    {/* Note editor */}
                    {editingNote === b.brokerName && (
                      <div className="flex gap-2">
                        <input
                          className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Bu broker hakkında not ekle…"
                          value={noteInput}
                          onChange={e => setNoteInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              setNotes(n => ({ ...n, [b.brokerName]: noteInput }));
                              setEditingNote(null);
                            }
                            if (e.key === 'Escape') setEditingNote(null);
                          }}
                          autoFocus
                        />
                        <Button size="sm" className="h-7 text-xs" onClick={() => {
                          setNotes(n => ({ ...n, [b.brokerName]: noteInput }));
                          setEditingNote(null);
                        }}>Kaydet</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
