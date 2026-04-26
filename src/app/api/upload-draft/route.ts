// ============================================================
// LogiMargin — /api/upload-draft
// Upload file → Supabase Storage → Claude parse → load_drafts
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 45;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PARSE_PROMPT = `You are a freight document parser for a trucking TMS. Extract ALL data from this document.

Return ONLY valid JSON with this exact structure:
{
  "docType": "ratecon" | "bol" | "fuel_receipt" | "other",
  "brokerName": "string or null",
  "loadNumber": "string or null",
  "grossPay": number or null,
  "loadedMiles": number or null,
  "origin": "string or null",
  "destination": "string or null",
  "equipmentType": "dry_van" | "flatbed" | "reefer" | "step_deck" | "other",
  "pickupDate": "YYYY-MM-DD or null",
  "deliveryDate": "YYYY-MM-DD or null",
  "fuelSurcharge": number or null,
  "detentionRate": number or null,
  "paymentTerms": "string or null",
  "lineItems": [{"description": "string", "amount": number}],
  "hasSignature": boolean,
  "hasSeal": boolean,
  "warnings": ["string"],
  "confidence": number between 0 and 1,
  "notes": "string or null"
}

Rules:
- If BOL: check for signature field (hasSignature) and seal number (hasSeal)
- warnings array: add "Missing Signature" if BOL has no signature, "Missing Seal" if no seal, "Hidden Fee Detected" for any accessorial charges not in gross pay
- confidence: 0.9+ if all key fields found, 0.5-0.9 if partial, <0.5 if unclear document`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const docType = (formData.get('docType') as string) ?? 'ratecon';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const db = createServerClient();

    // ── 1. Get authenticated user ─────────────────────────────
    const { data: { user }, error: authErr } = await db.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ── 2. Upload to Supabase Storage ─────────────────────────
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { data: storageData, error: storageErr } = await db.storage
      .from('logistics_docs')
      .upload(fileName, fileBytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (storageErr) {
      console.error('[upload-draft] storage error:', storageErr);
      return NextResponse.json({ error: `Storage upload failed: ${storageErr.message}` }, { status: 500 });
    }

    const { data: { publicUrl } } = db.storage
      .from('logistics_docs')
      .getPublicUrl(storageData.path);

    // ── 3. Extract text for Claude ────────────────────────────
    let docText: string;
    try {
      docText = await file.text();
      if (docText.includes('%PDF') || docText.length < 50) {
        docText = `[Binary/scanned document: ${file.name}, ${(file.size / 1024).toFixed(1)}KB. Type: ${docType}. Extract what you can from the filename and context.]`;
      }
    } catch {
      docText = `[Could not extract text from: ${file.name}]`;
    }

    // ── 4. Claude parse ───────────────────────────────────────
    let rawAiData: Record<string, unknown> = {};
    let confidence = 0;
    let hasWarnings = false;
    let warnings: string[] = [];

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: [{ type: 'text', text: PARSE_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Parse this ${docType} document:\n\n${docText}` }],
      });

      const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      rawAiData = JSON.parse(cleaned);
      confidence = typeof rawAiData.confidence === 'number' ? rawAiData.confidence : 0.5;
      warnings = Array.isArray(rawAiData.warnings) ? rawAiData.warnings as string[] : [];
      hasWarnings = warnings.length > 0;
    } catch (e) {
      console.error('[upload-draft] Claude parse error:', e);
      rawAiData = { parseError: true, fileName: file.name };
      confidence = 0;
    }

    // ── 5. Save draft to database ─────────────────────────────
    const { data: draft, error: dbErr } = await db
      .from('load_drafts')
      .insert({
        user_id: user.id,
        file_url: publicUrl,
        file_name: file.name,
        raw_ai_data: rawAiData,
        status: 'pending',
        confidence,
        has_warnings: hasWarnings,
        warnings,
      })
      .select()
      .single();

    if (dbErr) {
      console.error('[upload-draft] db error:', dbErr);
      return NextResponse.json({ error: `Database error: ${dbErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      draftId: draft.id,
      fileUrl: publicUrl,
      parsedData: rawAiData,
      confidence,
      hasWarnings,
      warnings,
      redirectTo: `/drafts/${draft.id}`,
    });
  } catch (err) {
    console.error('[upload-draft]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
