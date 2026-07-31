import { createContentLoader } from 'vitepress'

export interface DailyArticle {
  date: string
  description: string
  month: string
  tags: string[]
  title: string
  url: string
}

function formatDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  throw new Error('Daily article frontmatter requires a date in YYYY-MM-DD format.')
}

export default createContentLoader('daily/*/*/*.md', {
  excerpt: true,
  transform(data): DailyArticle[] {
    return data
      .filter(({ frontmatter }) => frontmatter.listed !== false)
      .map(({ frontmatter, url }) => {
        const date = formatDate(frontmatter.date)

        return {
          date,
          description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
          month: date.slice(0, 7),
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((tag): tag is string => typeof tag === 'string') : [],
          title: typeof frontmatter.title === 'string' ? frontmatter.title : url,
          url
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.url.localeCompare(a.url))
  }
})
