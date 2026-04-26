import { NextRequest, NextResponse } from 'next/server';
import { runFreightAudit, parseRateConfirmation } from '@/lib/claude-audit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mode = formData.get('mode') as string;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    let ocrText: string;
    try { ocrText = await file.text(); } catch { ocrText = `[${file.name}, ${(file.size / 1024).toFixed(1)}KB — OCR required]`; }
    if (mode === 'ratecon') return NextResponse.json(await parseRateConfirmation(ocrText));
    const rateConText = formData.get('rateConText') as string | null;
    const expectedAmount = formData.get('expectedAmount');
    return NextResponse.json(await runFreightAudit(ocrText, rateConText ?? undefined, expectedAmount ? Number(expectedAmount) : undefined));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Audit failed' }, { status: 500 });
  }
}
