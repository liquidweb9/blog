import { createContentLoader } from 'vitepress'

export interface Project {
  title: string
  description: string
  tags: string[]
  url: string
  featured: boolean
}

export default createContentLoader('projects/*.md', {
  excerpt: true,
  transform(data): Project[] {
    return data
      .filter(({ frontmatter }) => frontmatter.listed !== false)
      .map(({ frontmatter, url, excerpt }) => ({
        title: typeof frontmatter.title === 'string' ? frontmatter.title : url,
        description:
          typeof frontmatter.description === 'string'
            ? frontmatter.description
            : (excerpt || '').replace(/\s+/g, ' ').trim(),
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        url,
        featured: frontmatter.featured === true
      }))
  }
})
