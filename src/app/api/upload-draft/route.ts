// ============================================================
// LogiMargin v7 — /api/upload-draft
// PDF Vision → Real Profit → Broker Risk → Enriched Draft
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/supabase-auth';
import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam, Message } from '@anthropic-ai/sdk/resources/messages';
import {
  AiParsedDocSchema,
  calcRealProfit,
  evaluateBrokerRisk,
  type BrokerDbRow,
} from '@/lib/logimargin-engine';

export const runtime  = 'nodejs';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

function firstTextContent(response: Message) {
  return response.content.find(block => block.type === 'text')?.text ?? '{}';
}

function parseJsonContent(raw: string): Record<string, unknown> {
  return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

const SYSTEM_PROMPT = `You are an elite freight document parser for a trucking TMS (LogiMargin).
Your job: extract ALL data from rate confirmations, BOLs, and freight receipts with maximum accuracy.

Return ONLY valid JSON — no markdown, no explanation, no extra text. Match this exact schema:
{
  "docType": "ratecon" | "bol" | "fuel_receipt" | "other",
  "brokerName": string | null,
  "mcNumber": string | null,
  "loadNumber": string | null,
  "grossPay": number | null,
  "loadedMiles": number | null,
  "deadheadMiles": number | null,
  "origin": "City, ST" | null,
  "destination": "City, ST" | null,
  "equipmentType": "dry_van" | "flatbed" | "reefer" | "step_deck" | "lowboy" | "tanker" | "car_hauler" | "other",
  "pickupDate": "YYYY-MM-DD" | null,
  "deliveryDate": "YYYY-MM-DD" | null,
  "fuelSurcharge": number | null,
  "detentionRate": number | null,
  "paymentTerms": string | null,
  "lineItems": [{"description": string, "amount": number}],
  "hasSignature": boolean,
  "hasSeal": boolean,
  "warnings": string[],
  "confidence": number,
  "notes": string | null
}

Rules:
- grossPay: total pay including all accessorials UNLESS a fee is NOT in the stated total (then add to warnings)
- warnings: ["Missing Signature"] if BOL unsigned, ["Hidden Fee Detected: $X"] for undisclosed accessorials, ["Low Rate: $X.XX/mi"] if RPM < $1.80
- confidence: 0.95 if all critical fields found, 0.7 if 1-2 missing, 0.4 if document unclear
- equipmentType: infer from any trailer/equipment mentions
- DO NOT invent data. Use null if not found.`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const docTypeHint = (formData.get('docType') as string) ?? 'ratecon';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const db = createServerClient();

    // ── 1. Auth ───────────────────────────────────────────────
    const user = await getAuthenticatedUser(db, req);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // ── 2. Upload to Supabase Storage ─────────────────────────
    const fileBuffer   = await file.arrayBuffer();
    const fileBytes    = new Uint8Array(fileBuffer);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath  = `${user.id}/${Date.now()}-${safeFileName}`;

    const { data: storageData, error: storageErr } = await db.storage
      .from('logistics_docs')
      .upload(storagePath, fileBytes, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });

    if (storageErr) return NextResponse.json({ error: `Storage: ${storageErr.message}` }, { status: 500 });

    const { data: { publicUrl } } = db.storage.from('logistics_docs').getPublicUrl(storageData.path);

    // ── 3. Claude AI Parse — PDF Vision or Text ───────────────
    let rawAiData: Record<string, unknown> = {};

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const base64 = Buffer.from(fileBuffer).toString('base64');
        const documentBlock: ContentBlockParam = {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        };
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{
            role: 'user',
            content: [
              documentBlock,
              { type: 'text', text: `Parse this ${docTypeHint}. Return only JSON.` },
            ],
          }],
        });
        rawAiData = parseJsonContent(firstTextContent(response));
      } else {
        const text = await file.text();
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: `Parse this ${docTypeHint}:\n\n${text.slice(0, 8000)}` }],
        });
        rawAiData = parseJsonContent(firstTextContent(response));
      }
    } catch (e) {
      console.error('[upload-draft] AI parse error:', e);
      rawAiData = { parseError: true, fileName: file.name, confidence: 0 };
    }

    // ── 4. Zod validation ─────────────────────────────────────
    const parseResult = AiParsedDocSchema.safeParse(rawAiData);
    const parsed = parseResult.success
      ? parseResult.data
      : AiParsedDocSchema.parse({
          ...rawAiData,
          confidence: 0.3,
          warnings: [
            ...(Array.isArray(rawAiData.warnings) ? rawAiData.warnings : []),
            'Parse validation failed — review fields manually',
          ],
        });

    // ── 5. Real Profit Calculation ────────────────────────────
    let realProfitData = null;
    if (parsed.grossPay && parsed.loadedMiles) {
      realProfitData = calcRealProfit({
        grossPay: parsed.grossPay,
        loadedMiles: parsed.loadedMiles,
        deadheadMiles: parsed.deadheadMiles ?? 0,
      });
      if (realProfitData.rpmGross < 1.80) {
        parsed.warnings.push(`Low Rate: $${realProfitData.rpmGross.toFixed(2)}/mi — below $1.80 minimum`);
      }
      if (realProfitData.realMarginPct < 10) {
        parsed.warnings.push(`Thin Margin: ${realProfitData.realMarginPct.toFixed(1)}% after estimated costs`);
      }
    }

    // ── 6. Broker Risk Intelligence ───────────────────────────
    let brokerRisk = null;
    if (parsed.brokerName) {
      try {
        const { data: brokerRow } = await db
          .from('broker_scores')
          .select('*')
          .ilike('broker_name', parsed.brokerName)
          .single();
        brokerRisk = evaluateBrokerRisk(brokerRow as BrokerDbRow | null, parsed.brokerName);
        if (brokerRisk.isHighRisk) {
          parsed.warnings.push(`⚠️ HIGH RISK BROKER: ${parsed.brokerName} — ${brokerRisk.riskReason}`);
        }
      } catch {
        brokerRisk = evaluateBrokerRisk(null, parsed.brokerName);
      }
    }

    // ── 7. Build enriched payload ─────────────────────────────
    const enrichedData = {
      ...parsed,
      realProfit:        realProfitData?.realProfit ?? null,
      realMarginPct:     realProfitData?.realMarginPct ?? null,
      estimatedFuelCost: realProfitData?.estimatedFuelCost ?? null,
      estimatedMaintCost: realProfitData?.estimatedMaintCost ?? null,
      rpmGross:          realProfitData?.rpmGross ?? null,
      rpmNet:            realProfitData?.rpmNet ?? null,
      brokerRisk,
      verdict:           realProfitData?.verdict ?? null,
      aiAction:          realProfitData?.aiAction ?? null,
    };

    // ── 8. Save to DB ─────────────────────────────────────────
    const { data: draft, error: dbErr } = await db
      .from('load_drafts')
      .insert({
        user_id:      user.id,
        file_url:     publicUrl,
        file_name:    file.name,
        raw_ai_data:  enrichedData,
        status:       'pending',
        confidence:   parsed.confidence,
        has_warnings: parsed.warnings.length > 0,
        warnings:     parsed.warnings,
      })
      .select()
      .single();

    if (dbErr) return NextResponse.json({ error: `DB: ${dbErr.message}` }, { status: 500 });

    return NextResponse.json({
      draftId:     draft.id,
      fileUrl:     publicUrl,
      parsedData:  enrichedData,
      confidence:  parsed.confidence,
      hasWarnings: parsed.warnings.length > 0,
      warnings:    parsed.warnings,
      realProfit:  realProfitData,
      brokerRisk,
      redirectTo:  `/drafts/${draft.id}`,
    });

  } catch (err) {
    console.error('[upload-draft]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 500 });
  }
}
