import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import type { NextApiRequest, NextApiResponse } from 'next';

const urls = {
  amazon: 'https://www.amazon.co.jp/dp/',
};

function isStringArray(array: unknown): array is string[] {
  return (
    Array.isArray(array) && array.every((item) => typeof item === 'string')
  );
}

function getDomainFromUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function getQuerySelector(
  document: Document
): (selector: string) => string | null {
  return (selector: string) =>
    document?.querySelector(selector)?.getAttribute('content') ?? null;
}

async function getOgData(url: string) {
  return await fetch(url)
    .then((response) => response.text())
    .then((text) => {
      const {
        window: { document },
      } = new JSDOM(text);
      const getContent = getQuerySelector(document);
      const ogTitle = getContent('meta[property="og:title"]');
      const ogDescription = getContent('meta[property="og:description"]');
      const ogImage = getContent('meta[property="og:image"]');
      const ogUrl = getContent('meta[property="og:url"]');
      const twitterTitle = getContent('meta[name="twitter:title"]');
      const twitterDescription = getContent('meta[name="twitter:description"]');
      const twitterImage = getContent('meta[name="twitter:image"]');
      const title = document?.title ?? getContent('meta[name="title"]');
      const description = getContent('meta[name="description"]');
      const amazon = url.includes(urls.amazon)
        ? {
            id: url.replace(urls.amazon, '').split('?')[0],
            price:
              document?.getElementsByClassName('a-price-whole')[0]
                .textContent ?? null,
          }
        : undefined;
      return {
        url: ogUrl ?? url,
        timestamp: new Date().toLocaleString('sv-SE'),
        domain: getDomainFromUrl(ogUrl ?? url),
        title: title ?? ogTitle ?? twitterTitle,
        description: description ?? twitterDescription ?? ogDescription,
        image: twitterImage ?? ogImage,
        amazon,
      };
    });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, headers, body } = req;

  if (headers['Secret-Token'] !== process.env.SECRET_TOKEN) {
    res.status(404).end(`${headers['Secret-Token']}`);
  }

  if (headers['Content-Type']?.includes('application/json')) {
    res.status(404).end('invalid content type');
  }

  if (method !== 'POST') {
    res.status(404).end('invalid http method');
  }

  const urls: string[] = isStringArray(body.urls) ? body.urls : [];

  await Promise.all(
    urls.map(async (url) => {
      return getOgData(url);
    })
  )
    .then((data) => {
      const result = {
        siteOgps: data.filter((ogp) => !ogp.amazon),
        amazonItems: data.filter((ogp) => ogp.amazon),
      };
      res.setHeader('Cache-Control', 's-maxage=86400');
      res.status(200).json({ result });
    })
    .catch(() => {
      res.status(404).end('scraping failed');
    });
}
