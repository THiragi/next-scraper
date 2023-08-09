import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import type { NextApiRequest, NextApiResponse } from 'next';

function getDomainFromUrl(url: string) {
  const match = url.match(
    /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?=]+)/im
  );
  return match ? match[1] : undefined;
}

async function getOgData(url: string) {
  const options = { url, onlyGetOpenGraphInfo: true };
  return openGraphScraper(options).then((data) => {
    const {
      success,
      ogUrl,
      ogDescription,
      ogTitle,
      ogSiteName,
      ogImage,
      twitterImage,
    } = data.result;
    const domain = ogUrl ? getDomainFromUrl(ogUrl) : '';
    const image = Array.isArray(ogImage)
      ? ogImage[0]
      : typeof ogImage === 'string'
      ? undefined
      : ogImage;
    const twitterOgImage = Array.isArray(twitterImage)
      ? twitterImage[0]
      : typeof twitterImage === 'string'
      ? undefined
      : twitterImage;
    return {
      success,
      url: ogUrl ?? url,
      domain,
      title: ogTitle ?? ogSiteName ?? domain,
      description: ogDescription ?? url,
      ogImageSrc: image?.url ?? twitterOgImage?.url,
    };
  });
}

type OgData = Awaited<ReturnType<typeof getOgData>>;

type Data = {
  result: OgData[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const { method, headers, body } = req;

  switch (method) {
    case 'POST':
      if (headers['x-api-key'] !== process.env.API_KEY_OGS) {
        res.status(404).end('invalid api key');
      }
      const urls: string[] = Array.isArray(body.urls) ? body.urls : [];

      const result = await Promise.all(
        urls.map(async (url) => {
          return getOgData(url);
        })
      );
      res.setHeader('Cache-Control', 's-maxage=86400');
      res.status(200).json({ result });
      break;
    default:
      res.status(404).end('');
      break;
  }
}
