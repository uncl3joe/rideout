import { NextResponse } from 'next/server';
import { runCleanup } from '@/lib/cleanup';

export const dynamic = 'force-dynamic';

// Der Zeitplan-Job stößt diese Route regelmäßig an (z. B. alle 15 Min über
// die GitHub-Action). Geschützt mit CRON_SECRET, damit sie niemand sonst auslöst.
function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const key =
    url.searchParams.get('key') ||
    req.headers.get('x-cron-key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return key === secret;
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const r = await runCleanup();
  return NextResponse.json(r);
}

export const POST = GET;
