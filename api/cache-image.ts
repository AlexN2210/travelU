import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = (req.query.url as string) || '';
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: 'Paramètre url invalide' });
      return;
    }

    const u = new URL(url);
    if (isBlockedHost(u.hostname)) {
      res.status(400).json({ error: 'Host bloqué' });
      return;
    }
    const ipType = isIP(u.hostname);
    if (ipType && isPrivateIp(u.hostname)) {
      res.status(400).json({ error: 'IP bloquée' });
      return;
    }

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
      global: { headers: { 'x-client-info': 'travelu-api' } }
    });

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
        // Certains serveurs hotlink: referrer “propre”
        referer: u.origin
      },
      redirect: 'follow'
    });

    if (!upstream.ok) {
      res.status(200).json({ error: `Upstream HTTP ${upstream.status}` });
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      res.status(200).json({ error: 'URL ne pointe pas vers une image' });
      return;
    }

    const len = Number(upstream.headers.get('content-length') || '0');
    if (len && len > 8 * 1024 * 1024) {
      res.status(200).json({ error: 'Image trop lourde (> 8MB)' });
      return;
    }

    const ab = await upstream.arrayBuffer();
    if (ab.byteLength > 8 * 1024 * 1024) {
      res.status(200).json({ error: 'Image trop lourde (> 8MB)' });
      return;
    }

    const ext = extFromContentType(contentType);
    const path = `cached/external/${safeRandomId()}.${ext}`;
    const bucket = admin.storage.from('vote-option-photos');

    const { error: upErr } = await bucket.upload(path, Buffer.from(ab), {
      upsert: false,
      contentType: contentType || undefined,
      cacheControl: '31536000'
    });
    if (upErr) {
      res.status(200).json({ error: upErr.message || 'Erreur upload storage' });
      return;
    }

    const { data } = bucket.getPublicUrl(path);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ publicUrl: data?.publicUrl || null });
  } catch (e: any) {
    res.status(200).json({ error: e?.message || 'Erreur cache-image' });
  }
}

