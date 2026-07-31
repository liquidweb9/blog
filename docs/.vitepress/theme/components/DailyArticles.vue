<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { data as articles } from '../../daily.data'

const props = withDefaults(defineProps<{
  archiveLimit?: number
  latestLimit?: number
  mode: 'archive' | 'latest' | 'tags'
}>(), {
  archiveLimit: 100,
  latestLimit: 20
})

const latestArticles = computed(() => articles.slice(0, props.latestLimit))

const archiveArticles = computed(() => articles.slice(0, props.archiveLimit))

const archiveMonths = computed(() => {
  const months = new Map<string, typeof articles>()

  for (const article of archiveArticles.value) {
    const group = months.get(article.month) ?? []
    group.push(article)
    months.set(article.month, group)
  }

  return [...months.entries()]
})

const tagGroups = computed(() => {
  const tags = new Map<string, typeof articles>()

  for (const article of articles) {
    for (const tag of article.tags) {
      const group = tags.get(tag) ?? []
      group.push(article)
      tags.set(tag, group)
    }
  }

  return [...tags.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
})

function formatMonth(month: string): string {
  const [year, value] = month.split('-')
  return `${year} 年 ${Number(value)} 月`
}

function articleLink(url: string): string {
  return withBase(url)
}
</script>

<template>
  <template v-if="mode === 'latest'">
    <article v-for="article in latestArticles" :key="article.url" class="daily-article">
      <h3><a :href="articleLink(article.url)">{{ article.title }}</a></h3>
      <p class="daily-meta">
        <code>{{ article.date }}</code><span v-for="tag in article.tags" :key="tag"> · <code>{{ tag }}</code></span>
      </p>
      <p>{{ article.description }}</p>
    </article>
  </template>

  <template v-else-if="mode === 'archive'">
    <p>按时间倒序展示最新 {{ archiveLimit }} 篇文章。</p>
    <section v-for="[month, monthArticles] in archiveMonths" :key="month">
      <h2>{{ formatMonth(month) }}</h2>
      <ul>
        <li v-for="article in monthArticles" :key="article.url">
          <code>{{ article.date }}</code> <a :href="articleLink(article.url)">{{ article.title }}</a>
        </li>
      </ul>
    </section>
  </template>

  <template v-else>
    <section v-for="[tag, tagArticles] in tagGroups" :key="tag">
      <h2>{{ tag }}</h2>
      <ul>
        <li v-for="article in tagArticles" :key="article.url">
          <code>{{ article.date }}</code> <a :href="articleLink(article.url)">{{ article.title }}</a>
        </li>
      </ul>
    </section>
  </template>
</template>
