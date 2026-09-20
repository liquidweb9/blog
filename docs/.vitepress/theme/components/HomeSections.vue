<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { data as recentItems } from '../../recent.data'
import { data as projects } from '../../projects.data'
import { data as articles } from '../../daily.data'
import SiteIcon from './SiteIcon.vue'

const kindLabel: Record<string, string> = {
  daily: '每日技术',
  devlog: '开发日志',
  notes: '学习笔记',
  projects: '项目'
}

const filter = ref('all')
const filters = [
  { value: 'all', label: '全部' },
  { value: 'daily', label: '每日技术' },
  { value: 'devlog', label: '开发日志' }
]
const recent = computed(() => recentItems.filter((item) => filter.value === 'all' || item.kind === filter.value).slice(0, 5))
const featuredProjects = computed(() => projects.filter((p) => p.featured))

const topics = [
  { icon: 'agent', title: 'Agent Engineering', english: 'INTELLIGENT SYSTEMS', description: '从工具调用到记忆与规划，探索 AI 应用的工程化之路。', link: '/notes/agent-engineering/', color: 'green' },
  { icon: 'server', title: '后端工程', english: 'BACKEND ENGINEERING', description: '理解系统如何运转，构建可靠、可扩展的服务。', link: '/notes/backend/', color: 'blue' },
  { icon: 'eye', title: '计算机视觉', english: 'COMPUTER VISION', description: '从目标检测到视频理解，让算法走进真实场景。', link: '/notes/computer-vision/', color: 'amber' },
  { icon: 'shield', title: '密码学与隐私计算', english: 'CRYPTOGRAPHY & PRIVACY', description: '探索密码协议与隐私保护背后的数学和工程。', link: '/notes/cryptography/', color: 'purple' }
]

function projectIcon(tags: string[]): string {
  if (tags.includes('计算机视觉')) return 'eye'
  if (tags.includes('密码学')) return 'shield'
  return 'code'
}
</script>

<template>
  <main class="garden-home">
    <section class="garden-hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow"><span class="status-dot"></span> A DIGITAL GARDEN · 持续生长的技术手记</p>
        <p class="hero-hello">你好，我是邓厚锐 <span>Hourui Deng</span></p>
        <h1 id="hero-title">在代码与思考之间，<br /><span>持续构建。</span></h1>
        <p class="hero-description">电子科技大学应用密码学硕士研究生。<br class="desktop-break" />关注 AI Agent、后端工程与计算机视觉，在这里记录学习的脉络、工程的细节，以及值得留下的思考。</p>
        <div class="hero-actions">
          <a class="garden-button primary" :href="withBase('/notes/agent-engineering/')">开始阅读 <SiteIcon name="arrow" /></a>
          <a class="garden-button secondary" :href="withBase('/projects/')">探索项目 <SiteIcon name="diagonal" /></a>
        </div>
        <div class="hero-footnote"><span>LEARN</span><i></i><span>BUILD</span><i></i><span>SHARE</span><span class="footnote-line"></span> 保持好奇，认真记录</div>
      </div>

      <div class="engineering-card" role="img" aria-label="工程手记：连接 AI Agent、后端工程、计算机视觉与密码学，从学习到构建，再到持续迭代。">
        <div class="notebook-top"><span><span class="status-dot"></span> THE ENGINEERING NOTEBOOK</span><span>01 / ∞</span></div>
        <div class="notebook-title">让想法，<br />在实践中生长<span>↗</span></div>
        <div class="system-map" aria-hidden="true">
          <svg class="map-lines" viewBox="0 0 360 210" fill="none">
            <path d="M74 45H145Q180 45 180 80V105M286 45H215Q180 45 180 80M74 170H145Q180 170 180 135V105M286 170H215Q180 170 180 135" />
            <circle cx="180" cy="45" r="3" /><circle cx="180" cy="170" r="3" />
          </svg>
          <div class="map-node node-agent"><SiteIcon name="agent" /><span>AI Agent</span></div>
          <div class="map-node node-backend"><SiteIcon name="server" /><span>Backend</span></div>
          <div class="map-core"><SiteIcon name="code" /></div>
          <div class="map-node node-vision"><SiteIcon name="eye" /><span>Vision</span></div>
          <div class="map-node node-crypto"><SiteIcon name="shield" /><span>Cryptography</span></div>
        </div>
        <div class="notebook-code"><span class="code-comment">// small steps, real progress</span><br /><span class="code-keyword">while</span> (curious) { <span class="code-function">learn</span>(); <span class="code-function">build</span>(); }</div>
        <div class="notebook-bottom"><span class="notebook-dots"><i></i><i></i><i></i></span><span>IDEA → BUILD → REFINE</span></div>
      </div>
    </section>

    <div class="garden-index" aria-label="内容概览">
      <p><SiteIcon name="book" /> 一边探索，一边沉淀。<span>把零散的知识，连成自己的地图。</span></p>
      <div class="garden-stats">
        <a href="#topics"><strong>04</strong><span>学习方向</span></a>
        <a :href="withBase('/daily/')"><strong>{{ String(articles.length).padStart(2, '0') }}</strong><span>技术短文</span></a>
        <a :href="withBase('/projects/')"><strong>{{ String(projects.length).padStart(2, '0') }}</strong><span>项目实践</span></a>
      </div>
    </div>

    <section id="topics" class="garden-section" aria-labelledby="topics-title">
      <div class="section-heading">
        <div><p class="eyebrow">01 / KNOWLEDGE MAP</p><h2 id="topics-title">沿着兴趣，深入一点</h2></div>
        <span class="section-caption">四个方向，一份持续更新的知识地图</span>
      </div>
      <div class="topic-grid">
        <a v-for="(topic, index) in topics" :key="topic.link" :href="withBase(topic.link)" class="topic-card" :class="`tone-${topic.color}`">
          <div class="topic-top"><span class="icon-tile"><SiteIcon :name="topic.icon" /></span><span class="topic-number">0{{ index + 1 }}</span></div>
          <h3>{{ topic.title }}</h3>
          <p>{{ topic.description }}</p>
          <div class="topic-bottom"><span>{{ topic.english }}</span><SiteIcon name="arrow" /></div>
        </a>
      </div>
    </section>

    <section class="garden-section writing-section" aria-labelledby="writing-title">
      <div class="section-heading">
        <div><p class="eyebrow">02 / LATEST WRITING</p><h2 id="writing-title">最近，写了这些</h2></div>
        <a class="text-link" :href="withBase('/daily/archive')">文章归档 <SiteIcon name="arrow" /></a>
      </div>
      <div class="writing-layout">
        <div class="writing-feed">
          <div class="writing-filters" role="group" aria-label="筛选最近更新">
            <button v-for="option in filters" :key="option.value" type="button" :aria-pressed="filter === option.value" :class="{ selected: filter === option.value }" @click="filter = option.value">{{ option.label }}</button>
            <span class="feed-label">按时间倒序</span>
          </div>
          <div class="writing-results" aria-live="polite" aria-atomic="true">
            <a v-for="item in recent" :key="item.url" :href="withBase(item.url)" class="writing-entry">
              <time :datetime="item.date"><strong>{{ item.date.slice(8) }}</strong><span>{{ item.date.slice(0, 7).replace('-', '.') }}</span></time>
              <div class="entry-copy"><span class="entry-kind">{{ kindLabel[item.kind] }}</span><h3>{{ item.title }}</h3><p v-if="item.description">{{ item.description }}</p></div>
              <SiteIcon class="entry-arrow" name="diagonal" />
            </a>
            <p v-if="!recent.length" class="empty-writing">新的记录正在酝酿中，先去其他栏目看看吧。</p>
          </div>
        </div>
        <aside class="garden-aside">
          <div class="about-note">
            <span class="eyebrow">BEHIND THE NOTES</span>
            <span class="note-monogram" aria-hidden="true">邓<span>✳</span></span>
            <h3>工程师，也是终身学习者。</h3>
            <p>喜欢追问「为什么」，也喜欢亲手把答案做出来。相信扎实的理解，来自一次次真实的实践。</p>
            <a class="text-link" :href="withBase('/about/')">多了解我一点 <SiteIcon name="arrow" /></a>
          </div>
          <a class="devlog-note" :href="withBase('/devlog/')"><span class="icon-tile"><SiteIcon name="pen" /></span><span><strong>开发现场</strong><small>问题、决策与迭代的真实记录</small></span><SiteIcon name="diagonal" /></a>
        </aside>
      </div>
    </section>

    <section class="garden-section" aria-labelledby="projects-title">
      <div class="section-heading">
        <div><p class="eyebrow">03 / SELECTED WORK</p><h2 id="projects-title">不止于想法</h2></div>
        <a class="text-link" :href="withBase('/projects/')">全部项目 <SiteIcon name="arrow" /></a>
      </div>
      <div class="project-grid">
        <a v-for="(project, index) in featuredProjects" :key="project.url" :href="withBase(project.url)" class="project-card" :class="`project-color-${index % 4}`">
          <div class="project-top"><span class="icon-tile"><SiteIcon :name="projectIcon(project.tags)" /></span><span class="project-label">PROJECT / {{ String(index + 1).padStart(2, '0') }}</span><SiteIcon name="diagonal" /></div>
          <h3>{{ project.title }}</h3>
          <p>{{ project.description }}</p>
          <div class="project-tags"><span v-for="tag in project.tags" :key="tag">{{ tag }}</span></div>
        </a>
      </div>
    </section>

    <section class="garden-connect" aria-labelledby="connect-title">
      <div class="connect-icon"><SiteIcon name="rss" /></div>
      <div><p class="eyebrow">STAY CURIOUS. KEEP BUILDING.</p><h2 id="connect-title">下一次思考，见。</h2><p>通过 RSS 订阅，在你喜欢的阅读器里继续这场探索。</p></div>
      <a class="garden-button secondary" :href="withBase('/rss.xml')">订阅 RSS <SiteIcon name="diagonal" /></a>
    </section>
    <div class="home-colophon"><span>CRAFTED WITH CURIOSITY</span><span>学习 · 实践 · 记录 <SiteIcon name="spark" /></span></div>
  </main>
</template>
