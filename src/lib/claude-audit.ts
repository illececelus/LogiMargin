import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';
import type { FreightAuditResult, AuditError } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FREIGHT_AUDIT_SYSTEM_PROMPT = `You are LogiMargin's Freight Audit AI. Audit OCR text from freight documents and identify billing errors.
Detect: rate discrepancies, mileage errors, unauthorized fees, fuel surcharge miscalculations, duplicate line items.
Output ONLY valid JSON:
{
  "invoiceNumber": "string", "invoicedAmount": number, "expectedAmount": number,
  "discrepancyAmount": number, "hasErrors": boolean, "confidence": number,
  "errors": [{ "field": "string", "invoicedValue": "string", "expectedValue": "string", "difference": number, "severity": "critical"|"warning"|"info", "description": "string" }],
  "summary": "string", "recommendation": "string"
}`;

const RATECON_PARSE_PROMPT = `You are a freight document parser. Extract structured data from RateCon documents.
Return ONLY valid JSON: { "brokerName": "string", "loadNumber": "string", "grossPay": number, "loadedMiles": number|null, "lineItems": [{"description":"string","amount":number}], "paymentTerms": "string", "confidence": number }`;

function firstTextBlockText(content: Message['content'], fallback = '') {
  return content.find(block => block.type === 'text')?.text ?? fallback;
}

export async function runFreightAudit(ocrText: string, rateConOcrText?: string, expectedAmount?: number): Promise<FreightAuditResult> {
  let userContent = `Audit this freight invoice:\n\n=== INVOICE ===\n${ocrText}\n`;
  if (rateConOcrText) userContent += `\n=== RATE CONFIRMATION ===\n${rateConOcrText}\n`;
  if (expectedAmount !== undefined) userContent += `\n=== EXPECTED AMOUNT ===\n$${expectedAmount.toFixed(2)}\n`;
  userContent += `\nReturn ONLY the JSON audit result.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1024,
    system: [{ type: 'text', text: FREIGHT_AUDIT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  });

  const raw = firstTextBlockText(response.content);
  return parseAuditResponse(raw);
}

export async function parseRateConfirmation(ocrText: string) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1024,
    system: [{ type: 'text', text: RATECON_PARSE_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Parse this rate confirmation:\n\n${ocrText}` }],
  });
  const raw = firstTextBlockText(response.content, '{}');
  try { return JSON.parse(raw); } catch { return { error: 'Failed to parse', rawText: raw }; }
}

export async function batchFreightAudit(invoices: Array<{ ocrText: string; rateConText?: string; expectedAmount?: number; id: string }>) {
  const BATCH_SIZE = 5;
  const results = [];
  for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
    const batch = invoices.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async inv => ({ ...await runFreightAudit(inv.ocrText, inv.rateConText, inv.expectedAmount), id: inv.id }))
    );
    results.push(...batchResults);
  }
  return results;
}

function parseAuditResponse(rawText: string): FreightAuditResult {
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const errors: AuditError[] = (parsed.errors ?? []).map((e: Partial<AuditError>) => ({
      field: e.field ?? 'unknown', invoicedValue: e.invoicedValue ?? '', expectedValue: e.expectedValue ?? '',
      difference: typeof e.difference === 'number' ? e.difference : 0,
      severity: (['critical', 'warning', 'info'].includes(e.severity ?? '') ? e.severity : 'warning') as AuditError['severity'],
      description: e.description ?? '',
    }));
    return {
      invoiceNumber: parsed.invoiceNumber ?? 'UNKNOWN', invoicedAmount: parsed.invoicedAmount ?? 0,
      expectedAmount: parsed.expectedAmount ?? 0, discrepancyAmount: parsed.discrepancyAmount ?? 0,
      hasErrors: parsed.hasErrors ?? errors.length > 0, confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
      errors, summary: parsed.summary ?? 'Audit completed.', recommendation: parsed.recommendation ?? 'Review manually.',
    };
  } catch {
    return { invoiceNumber: 'PARSE_ERROR', invoicedAmount: 0, expectedAmount: 0, discrepancyAmount: 0, hasErrors: false, confidence: 0, errors: [], summary: 'Failed to parse AI response.', recommendation: 'Review manually.' };
  }
}
