import { createContentLoader } from 'vitepress'

export interface RecentItem {
  date: string
  title: string
  description: string
  url: string
  kind: 'daily' | 'devlog' | 'notes' | 'projects'
}

function formatDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  return ''
}

export default createContentLoader(['daily/*/*/*.md', 'devlog/*/*/*.md', 'notes/*/*.md', 'projects/*.md'], {
  excerpt: true,
  transform(data): RecentItem[] {
    const items: RecentItem[] = []

    for (const { frontmatter, url, excerpt } of data) {
      if (frontmatter.listed === false) continue

      let date = formatDate(frontmatter.date)

      const kind = url.startsWith('/daily/')
        ? 'daily'
        : url.startsWith('/devlog/')
          ? 'devlog'
          : url.startsWith('/projects/')
            ? 'projects'
            : 'notes'

      if (!date && kind === 'devlog') {
        const match = url.match(/(\d{4})-(\d{2})-(\d{2})/)
        if (match) date = `${match[1]}-${match[2]}-${match[3]}`
      }

      if (!date) continue

      const title =
        typeof frontmatter.title === 'string'
          ? frontmatter.title
          : url.split('/').filter(Boolean).pop() || url

      const description =
        typeof frontmatter.description === 'string'
          ? frontmatter.description
          : (excerpt || '').replace(/\s+/g, ' ').trim()

      items.push({ date, title, description, url, kind })
    }

    return items.sort((a, b) => b.date.localeCompare(a.date))
  }
})
