import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isIP } from 'node:net';

function isPrivateIp(ip: string) {
  // IPv4 private ranges + loopback + link-local
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('192.168.')) return true;
  const m172 = ip.match(/^172\.(\d+)\./);
  if (m172) {
    const n = Number(m172[1]);
    if (n >= 16 && n <= 31) return true;
  }

  // IPv6 loopback + unique local + link-local
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7
  if (lower.startsWith('fe80:')) return true; // link-local

  return false;
}

function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0') return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = (req.query.url as string) || '';
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).send('Bad url');
      return;
    }

    const u = new URL(url);
    if (isBlockedHost(u.hostname)) {
      res.status(400).send('Blocked host');
      return;
    }

    const ipType = isIP(u.hostname);
    if (ipType && isPrivateIp(u.hostname)) {
      res.status(400).send('Blocked ip');
      return;
    }

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        // user-agent “browser-like” pour éviter certains refus / hotlink protections
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });

    if (!upstream.ok) {
      res.status(404).send(`Upstream ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      res.status(415).send('Not an image');
      return;
    }

    const ab = await upstream.arrayBuffer();
    const buf = Buffer.from(ab);

    res.setHeader('Content-Type', contentType);
    // Cache côté CDN (Vercel) pour limiter les hits upstream
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(buf);
  } catch (e: any) {
    res.status(500).send(e?.message || 'Image proxy error');
  }
}

