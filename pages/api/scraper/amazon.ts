import type { NextApiRequest, NextApiResponse } from 'next'
import chrome from 'chrome-aws-lambda'
import puppeteer from 'puppeteer-core'
import type { Browser } from 'puppeteer-core'

export async function getAmazonItem(browser: Browser, url: string) {
  const page = await browser.newPage()
  const id = url.replace(`https://www.amazon.co.jp/dp/`, '').split('?')[0]
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (res?.status() !== 200) {
    return {
      result: 'error',
      id,
      url,
      title: '',
      price: '',
      timestamp: '0',
    }
  }
  const title = await page.title()
  const price = await page.evaluate(() => {
    return document.getElementsByClassName('a-price-whole')[0].textContent
  })
  await page.close()
  return {
    result: 'success',
    id,
    url,
    title,
    price: price ?? '',
    timestamp: new Date().toLocaleString('sv-SE'),
  }
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
      const browser = await puppeteer.launch({
        args: chrome.args,
        executablePath: await chrome.executablePath,
        headless: chrome.headless,
      })

      const promise = filteredUrls.map(async (url) => {
        return getAmazonItem(browser, url)
      })
      const result = await Promise.all(promise)
      browser.close()

      res.status(200).json({ result })
      break
    default:
      res.status(404).end('')
      break
  }
}
