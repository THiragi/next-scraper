import type { NextApiRequest, NextApiResponse } from 'next'
import openGraphScraper from 'open-graph-scraper'

export function getDomainFromUrl(url: string) {
  const match = url.match(
    /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?=]+)/im
  )
  return match ? match[1] : undefined
}

export async function getOgData(url: string) {
  const options = { url, onlyGetOpenGraphInfo: true }
  return openGraphScraper(options).then((data) => {
    const { success, ogUrl, ogDescription, ogTitle, ogImage } = data.result
    const domain = ogUrl ? getDomainFromUrl(ogUrl) : ''
    const image = Array.isArray(ogImage)
      ? ogImage[0]
      : typeof ogImage === 'string'
      ? undefined
      : ogImage
    return {
      success,
      url: ogUrl ?? '',
      domain,
      title: ogTitle ?? '',
      description: ogDescription ?? '',
      ogImageSrc: image?.url ?? '',
    }
  })
}

type OgData = Awaited<ReturnType<typeof getOgData>>

type Data = {
  result: OgData[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const { method, headers, body } = req

  switch (method) {
    case 'POST':
      if (headers['x-api-key'] !== process.env.API_KEY_OGS) {
        res.status(404).end('invalid api key')
      }
      const urls: string[] =
        body?.urls && typeof body.urls === 'string' ? body.urls.split(',') : []

      const result = await Promise.all(
        urls.map(async (url) => {
          return getOgData(url)
        })
      )

      res.status(200).json({ result })
      break
    default:
      res.status(404).end('')
      break
  }
}
