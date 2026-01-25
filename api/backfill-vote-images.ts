import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isIP } from 'node:net';

function isPrivateIp(ip: string) {
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('192.168.')) return true;
  const m172 = ip.match(/^172\.(\d+)\./);
  if (m172) {
    const n = Number(m172[1]);
    if (n >= 16 && n <= 31) return true;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80:')) return true;
  return false;
}

function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0') return true;
  return false;
}

function extFromContentType(ct: string) {
  const c = ct.toLowerCase();
  if (c.includes('image/jpeg')) return 'jpg';
  if (c.includes('image/jpg')) return 'jpg';
  if (c.includes('image/png')) return 'png';
  if (c.includes('image/webp')) return 'webp';
  if (c.includes('image/gif')) return 'gif';
  if (c.includes('image/avif')) return 'avif';
  return 'jpg';
}

function safeRandomId() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAlreadyStable(u: string) {
  // Si déjà dans notre bucket public, on ne recopie pas
  return u.includes('/storage/v1/object/public/vote-option-photos/');
}

// Vercel/TS peut être très strict sur les génériques de SupabaseClient.
// Ici on accepte un client “admin” typé large, car on fait surtout storage + from().
async function cacheExternalImage(admin: SupabaseClient<any, any, any, any>, url: string) {
  const u = new URL(url);
  if (isBlockedHost(u.hostname)) return { error: 'Host bloqué' as const };
  const ipType = isIP(u.hostname);
  if (ipType && isPrivateIp(u.hostname)) return { error: 'IP bloquée' as const };

  const upstream = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
      referer: u.origin
    },
    redirect: 'follow'
  });

  if (!upstream.ok) return { error: `Upstream HTTP ${upstream.status}` as const };

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) return { error: 'Not an image' as const };

  const len = Number(upstream.headers.get('content-length') || '0');
  if (len && len > 8 * 1024 * 1024) return { error: 'Too large (>8MB)' as const };

  const ab = await upstream.arrayBuffer();
  if (ab.byteLength > 8 * 1024 * 1024) return { error: 'Too large (>8MB)' as const };

  const ext = extFromContentType(contentType);
  const path = `cached/external/${safeRandomId()}.${ext}`;
  const bucket = admin.storage.from('vote-option-photos');

  const { error: upErr } = await bucket.upload(path, Buffer.from(ab), {
    upsert: false,
    contentType: contentType || undefined,
    cacheControl: '31536000'
  });
  if (upErr) return { error: upErr.message || 'Upload error' as const };

  const { data } = bucket.getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) return { error: 'No public URL' as const };
  return { publicUrl } as const;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = (req.headers['x-backfill-token'] as string) || (req.query.token as string) || '';
    const expected = process.env.BACKFILL_TOKEN || '';
    if (!expected || token !== expected) {
      res.status(401).json({ error: 'Unauthorized (BACKFILL_TOKEN)' });
      return;
    }

    const tripId = (req.query.tripId as string) || '';
    if (!tripId) {
      res.status(400).json({ error: 'Paramètre requis: tripId' });
      return;
    }

    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const dryRun = String(req.query.dryRun || '').toLowerCase() === '1' || String(req.query.dryRun || '').toLowerCase() === 'true';

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRole =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceRole) {
      res.status(500).json({
        error:
          'Variables serveur manquantes: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (à configurer sur Vercel).'
      });
      return;
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-client-info': 'travelu-backfill' } }
    });

    // On filtre par trip via la relation vote_categories
    const { data: rows, error: selErr } = await admin
      .from('vote_options')
      .select('id,image_url,photo_urls,vote_categories!inner(trip_id)')
      .eq('vote_categories.trip_id', tripId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (selErr) {
      res.status(200).json({ error: selErr.message || 'Select error' });
      return;
    }

    const options = Array.isArray(rows) ? rows : [];

    let processed = 0;
    let updated = 0;
    let cachedCount = 0;
    let skippedStable = 0;
    let skippedEmpty = 0;
    const errors: Array<{ optionId: string; url: string; error: string }> = [];

    for (const r of options as any[]) {
      processed++;
      const optionId: string = r.id;
      const imageUrl: string | null = r.image_url || null;
      const photoUrls: string[] = Array.isArray(r.photo_urls) ? r.photo_urls.filter(Boolean) : [];

      const next: { image_url?: string | null; photo_urls?: string[] } = {};

      // image_url
      if (!imageUrl) {
        skippedEmpty++;
      } else if (isAlreadyStable(imageUrl)) {
        skippedStable++;
      } else {
        const out = await cacheExternalImage(admin, imageUrl);
        if ('publicUrl' in out) {
          cachedCount++;
          next.image_url = out.publicUrl;
        } else {
          errors.push({ optionId, url: imageUrl, error: out.error });
        }
      }

      // photo_urls
      if (photoUrls.length > 0) {
        const nextPhotos: string[] = [];
        for (const u of photoUrls) {
          if (!u) continue;
          if (isAlreadyStable(u)) {
            nextPhotos.push(u);
            skippedStable++;
            continue;
          }
          const out = await cacheExternalImage(admin, u);
          if ('publicUrl' in out) {
            cachedCount++;
            nextPhotos.push(out.publicUrl);
          } else {
            errors.push({ optionId, url: u, error: out.error });
            nextPhotos.push(u); // garder l’original si on échoue
          }
        }
        // dédoublonner
        const dedup = Array.from(new Set(nextPhotos));
        next.photo_urls = dedup;
      }

      const willUpdate = typeof next.image_url !== 'undefined' || typeof next.photo_urls !== 'undefined';
      if (willUpdate && !dryRun) {
        const { error: upErr } = await admin.from('vote_options').update(next).eq('id', optionId);
        if (upErr) {
          errors.push({ optionId, url: '(db update)', error: upErr.message || 'Update error' });
        } else {
          updated++;
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      tripId,
      dryRun,
      limit,
      offset,
      processed,
      updated,
      cachedCount,
      skippedStable,
      skippedEmpty,
      errors: errors.slice(0, 50),
      nextOffset: options.length === limit ? offset + limit : null
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Backfill error' });
  }
}

