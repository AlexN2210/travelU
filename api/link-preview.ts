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
        accept: 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });

    if (!resp.ok) {
      res.status(200).json({ url, error: `HTTP ${resp.status}` });
      return;
    }

    const html = await resp.text();

    const preview: Preview = {
      url,
      title: pickMeta(html, 'og:title') || pickMeta(html, 'twitter:title'),
      description:
        pickMeta(html, 'og:description') ||
        pickMeta(html, 'twitter:description') ||
        pickMeta(html, 'description'),
      image: pickMeta(html, 'og:image') || pickMeta(html, 'twitter:image'),
      siteName: pickMeta(html, 'og:site_name')
    };

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(preview);
  } catch (e: any) {
    res.status(200).json({ error: e?.message || 'Erreur link preview' });
  }
}

