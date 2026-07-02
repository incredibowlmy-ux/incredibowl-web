/**
 * Shared helpers for /api/admin/* routes called by the standalone dashboard.
 *
 * The dashboard is served from a different origin (file:// or a separate host)
 * and authenticates with the admin's Firebase ID token. Every admin route needs
 * the same CORS preflight + Bearer-token verification, so it lives here once
 * instead of being copy-pasted per route. Mirrors the inline logic that
 * /api/admin/daily-prep already uses.
 */
import { NextRequest, NextResponse } from 'next/server';

export const ADMIN_EMAILS = ['hello@incredibowl.my', 'incredibowl.my@gmail.com'];

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function corsify(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

/** JSON response with CORS headers attached. */
export function adminJson(body: unknown, status = 200): NextResponse {
  return corsify(NextResponse.json(body, { status }));
}

/**
 * Verify the request carries a valid admin Firebase ID token; return the admin's
 * email (for audit trails) or null if not an authorized admin.
 */
export async function verifyAdminEmail(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    getAdminDb(); // ensure the admin app is initialized before getAuth()
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.email && ADMIN_EMAILS.includes(decoded.email) ? decoded.email : null;
  } catch {
    return null;
  }
}

/** Verify the request carries a valid admin Firebase ID token. */
export async function verifyAdmin(req: NextRequest): Promise<boolean> {
  return (await verifyAdminEmail(req)) !== null;
}
