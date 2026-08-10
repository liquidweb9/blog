<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { data as recentItems } from '../../recent.data'
import { data as projects } from '../../projects.data'

const kindLabel: Record<string, string> = {
  daily: '每日技术',
  devlog: '开发日志',
  notes: '学习笔记',
  projects: '项目'
}

const recent = computed(() => recentItems.slice(0, 8))
const featuredProjects = computed(() => projects.filter((p) => p.featured))
</script>

<template>
  <section class="home-section">
    <h2 class="home-section-title">最近更新</h2>
    <ul class="home-updates">
      <li v-for="item in recent" :key="item.url" class="home-update">
        <code class="home-update-date">{{ item.date }}</code>
        <a :href="withBase(item.url)" class="home-update-title">{{ item.title }}</a>
        <span class="home-update-kind">{{ kindLabel[item.kind] }}</span>
      </li>
    </ul>
  </section>

  <section class="home-section">
    <h2 class="home-section-title">精选项目</h2>
    <div class="home-projects">
      <a v-for="project in featuredProjects" :key="project.url" :href="withBase(project.url)" class="home-project">
        <h3 class="home-project-title">{{ project.title }}</h3>
        <p class="home-project-desc">{{ project.description }}</p>
        <p class="home-project-tags">
          <code v-for="tag in project.tags" :key="tag">{{ tag }}</code>
        </p>
      </a>
    </div>
  </section>
</template>
