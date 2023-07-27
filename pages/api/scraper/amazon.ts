import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import type { NextApiRequest, NextApiResponse } from 'next'

export async function getAmazonItem(url: string) {
  return await fetch(url)
    .then((data) => data.text())
    .then((text) => {
      const {
        window: { document },
      } = new JSDOM(text)
      const id = url.replace(`https://www.amazon.co.jp/dp/`, '').split('?')[0]
      const title = document.title
      const price =
        document.getElementsByClassName('a-price-whole')[0].textContent
      return {
        result: 'success',
        id,
        url,
        title,
        price: price ?? '',
        timestamp: new Date().toLocaleString('sv-SE'),
      }
    })
}

export type AmazonItem = Awaited<ReturnType<typeof getAmazonItem>>

type Data = {
  result: AmazonItem[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const { method, headers, body } = req
  switch (method) {
    case 'POST':
      if (headers['x-api-key'] !== process.env.API_KEY_AMAZON) {
        res.status(404).end('invalid api key')
      }
      const urls: string[] = Array.isArray(body.urls) ? body.urls : []

      const filteredUrls = urls.filter((url) =>
        url.includes(`https://www.amazon.co.jp/dp/`)
      )

      const promise = filteredUrls.map(async (url) => {
        return getAmazonItem(url)
      })
      const result = await Promise.all(promise)
      res.setHeader('Cache-Control', 's-maxage=86400')
      res.status(200).json({ result })
      break
    default:
      res.status(404).end('')
      break
  }
}
