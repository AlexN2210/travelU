import type { VercelRequest, VercelResponse } from '@vercel/node';

type Preview = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url?: string;
};

function pickMeta(html: string, key: string): string | undefined {
  // Match: <meta property="og:image" content="...">
  // or:    <meta name="description" content="...">
  const re = new RegExp(
    `<meta\\s+(?:property|name)=["']${key}["']\\s+content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const m = html.match(re);
  return m?.[1];
}

function pickTitleTag(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim();
}

function normalizeUrl(maybeUrl: string | undefined, baseUrl: string): string | undefined {
  if (!maybeUrl) return undefined;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractJsonLd(html: string): any[] {
  const blocks: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // ignore invalid json-ld
    }
  }
  return blocks;
}

function pickFromJsonLd(blocks: any[]): { title?: string; description?: string; image?: string } {
  // Try to find something with common keys: name/description/image
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    const title = typeof b.name === 'string' ? b.name : undefined;
    const description = typeof b.description === 'string' ? b.description : undefined;
    let image: string | undefined;
    if (typeof b.image === 'string') image = b.image;
    else if (Array.isArray(b.image) && typeof b.image[0] === 'string') image = b.image[0];
    else if (b.image && typeof b.image === 'object' && typeof b.image.url === 'string') image = b.image.url;

    if (title || description || image) return { title, description, image };

    // Some sites wrap in @graph
    if (Array.isArray(b['@graph'])) {
      const inner = pickFromJsonLd(b['@graph']);
      if (inner.title || inner.description || inner.image) return inner;
    }
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = (req.query.url as string) || '';
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: 'Paramètre url invalide' });
      return;
    }

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        // user-agent “browser-like” pour éviter certains refus
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });

    if (!resp.ok) {
      res.status(200).json({ url, error: `HTTP ${resp.status}` });
      return;
    }

    const html = await resp.text();

    const jsonLdBlocks = extractJsonLd(html);
    const jsonLd = pickFromJsonLd(jsonLdBlocks);

    const preview: Preview = {
      url,
      title:
        pickMeta(html, 'og:title') ||
        pickMeta(html, 'twitter:title') ||
        jsonLd.title ||
        pickTitleTag(html),
      description:
        pickMeta(html, 'og:description') ||
        pickMeta(html, 'twitter:description') ||
        pickMeta(html, 'description') ||
        jsonLd.description,
      image:
        pickMeta(html, 'og:image') ||
        pickMeta(html, 'og:image:secure_url') ||
        pickMeta(html, 'twitter:image') ||
        pickMeta(html, 'twitter:image:src') ||
        jsonLd.image,
      siteName: pickMeta(html, 'og:site_name')
    };

    // Normalize image URL if relative
    preview.image = normalizeUrl(preview.image, url);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(preview);
  } catch (e: any) {
    res.status(200).json({ error: e?.message || 'Erreur link preview' });
  }
}

