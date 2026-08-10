import { createContentLoader } from 'vitepress'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { SiteConfig } from 'vitepress'

interface FeedItem {
  title: string
  date: string
  url: string
  description: string
  html: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toRfc822(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  return parsed.toUTCString()
}

function toDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  return ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function generateRss(siteConfig: SiteConfig): Promise<void> {
  const contentLoader = createContentLoader('daily/*/*/*.md', {
    render: true,
    excerpt: true
  })
  const data = await contentLoader.load()

  const items = data
    .filter(({ frontmatter }) => frontmatter.listed !== false)
    .map(({ frontmatter, url, html }) => {
      const date = toDateString(frontmatter.date)
      const title = typeof frontmatter.title === 'string' ? frontmatter.title : ''
      const description = typeof frontmatter.description === 'string' ? frontmatter.description : ''

      return { title, date, url, description, html: html || '' } as FeedItem
    })
    .filter((item) => item.date && item.title)
    .sort((a, b) => b.date.localeCompare(a.date))

  const host = 'https://liquidweb9.github.io'
  const base = siteConfig.site.base || '/blog/'

  const channel = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(siteConfig.site.title)}</title>
    <link>${host}${base}</link>
    <description>${escapeXml(siteConfig.site.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${host}${base}rss.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${host}${base}${item.url.replace(/^\//, '')}</link>
      <guid>${host}${base}${item.url.replace(/^\//, '')}</guid>
      <pubDate>${toRfc822(item.date)}</pubDate>
      <description>${escapeXml(item.description || stripHtml(item.html).slice(0, 500))}</description>
      <content:encoded><![CDATA[${item.html}]]></content:encoded>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>
`

  const outDir = siteConfig.outDir
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'rss.xml'), channel, 'utf-8')
}
