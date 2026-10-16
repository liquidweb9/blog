import { createContentLoader } from 'vitepress'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createHash } from 'node:crypto'
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

function prepareFeedHtml(html: string, url: string, siteUrl: string, siteConfig: SiteConfig): string {
  const pageUrl = new URL(url.replace(/^\//, ''), siteUrl)
  const base = new URL(siteUrl).pathname

  // Markdown images are bundled by Vite for pages, but the content loader keeps source paths.
  // Publish a stable feed copy so RSS readers can load the same local figures.
  const content = html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (match, prefix, src, suffix) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src)) return match

    const imageUrl = new URL(src, pageUrl)
    const relativePath = decodeURIComponent(imageUrl.pathname.startsWith(base)
      ? imageUrl.pathname.slice(base.length)
      : imageUrl.pathname.replace(/^\//, ''))
    const sourcePath = join(siteConfig.srcDir, relativePath)
    const publicPath = join(siteConfig.srcDir, 'public', relativePath)
    const filePath = existsSync(sourcePath) ? sourcePath : publicPath
    if (!existsSync(filePath)) return match

    const image = readFileSync(filePath)
    const hash = createHash('sha256').update(image).digest('hex').slice(0, 16)
    const name = `${hash}${extname(filePath)}`
    const outDir = join(siteConfig.outDir, 'rss-assets')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, name), image)
    return `${prefix}${new URL(`rss-assets/${name}`, siteUrl).href}${suffix}`
  })

  return content.replace(/(<(?:a|img)\b[^>]*?\s)(href|src)="([^"]+)"/g, (match, prefix, attribute, value) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return match
    return `${prefix}${attribute}="${new URL(value, pageUrl).href}"`
  })
}

export async function generateRss(siteConfig: SiteConfig): Promise<void> {
  const host = 'https://liquidweb9.github.io'
  const base = siteConfig.site.base || '/blog/'
  const siteUrl = `${host}${base}`
  const contentLoader = createContentLoader(['daily/*/*/*.md', 'papers/*/*.md'], {
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

      return { title, date, url, description, html: prepareFeedHtml(html || '', url, siteUrl, siteConfig) } as FeedItem
    })
    .filter((item) => item.date && item.title)
    .sort((a, b) => b.date.localeCompare(a.date))

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
