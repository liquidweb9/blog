---
title: VitePress 如何自动生成文章列表、归档和标签页？
date: 2026-08-31
tags:
  - VitePress
  - TypeScript
  - 工程实践
description: 使用 VitePress 的 createContentLoader 读取 Markdown Frontmatter，在构建期生成结构化文章数据，再由 Vue 组件复用到最新文章、归档和标签页面。
---

# VitePress 如何自动生成文章列表、归档和标签页？

## 一句话结论

VitePress 不只适合把 Markdown 渲染成静态页面，也可以通过 `createContentLoader` 在构建期扫描文档、提取 Frontmatter 并转换成结构化数据，再交给 Vue 组件生成最新文章、归档和标签页。把“扫描与清洗数据”和“页面展示”分开，新增文章时就不需要手工维护索引。

## 问题与场景

博客文章少的时候，手工维护首页列表和归档页似乎并不麻烦。但文章数量增长后，静态链接很容易出现几类问题：

- 新增文章后忘记更新首页，读者看不到最新内容；
- 同一篇文章在首页、归档和标签页中重复维护，修改标题时容易遗漏；
- 草稿也被展示出来，或者缺少日期的文章破坏排序；
- 部署到 GitHub Pages 后站点带有 `/blog/` 前缀，手写链接在生产环境失效。

这个博客的「每日技术」栏目采用了另一种方式：每篇文章只负责声明自己的 `title`、`date`、`tags` 和 `description`，`daily.data.ts` 负责统一读取和整理，`DailyArticles.vue` 负责按不同模式展示。

```text
Markdown Frontmatter
        ↓ createContentLoader
过滤、校验、转换、排序
        ↓
结构化 DailyArticle[]
        ↓
最新文章 / 月份归档 / 标签分类
```

## 一个具体例子

### 1. 用 Frontmatter 声明文章元数据

一篇每日技术文章只需要维护自己的元数据：

```md
---
title: VitePress 如何自动生成文章列表、归档和标签页？
date: 2026-08-31
tags:
  - VitePress
  - TypeScript
  - 工程实践
description: 使用 createContentLoader 自动读取文章元数据。
---
```

如果文章只是模板、草稿或说明文档，可以显式设置 `listed: false`：

```md
---
title: 每日技术文章模板
date: 2026-07-30
listed: false
---
```

### 2. 在数据加载器中统一清洗

`docs/.vitepress/daily.data.ts` 使用文件匹配模式扫描所有每日技术文章：

```ts
import { createContentLoader } from 'vitepress'

export default createContentLoader('daily/*/*/*.md', {
  excerpt: true,
  transform(data): DailyArticle[] {
    return data
      .filter(({ frontmatter }) => frontmatter.listed !== false)
      .map(({ frontmatter, url }) => {
        const date = formatDate(frontmatter.date)

        return {
          date,
          description: typeof frontmatter.description === 'string'
            ? frontmatter.description
            : '',
          month: date.slice(0, 7),
          tags: Array.isArray(frontmatter.tags)
            ? frontmatter.tags.filter((tag): tag is string => typeof tag === 'string')
            : [],
          title: typeof frontmatter.title === 'string'
            ? frontmatter.title
            : url,
          url
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }
})
```

这里有四个值得注意的设计点：

1. **匹配范围明确。** `daily/*/*/*.md` 对应“栏目/年份/月/文章”的目录结构，不会误读首页或其他笔记。
2. **列表状态统一处理。** `listed: false` 在数据层过滤，而不是让每个页面组件重复判断。
3. **边界数据先标准化。** 日期统一转换为 `YYYY-MM-DD`，标签只保留字符串，避免模板中处理 `unknown`。
4. **加载器只输出页面需要的数据。** 页面只需要标题、日期、摘要、标签和 URL，不必携带完整 Markdown 内容。

日期校验尤其重要。项目中的 `formatDate` 同时支持 VitePress 解析出的 `Date` 和规范日期字符串；其他值直接抛出错误，让错误尽早暴露在构建阶段，而不是等归档页出现异常排序。

### 3. 一个数据源复用三种页面

Vue 组件通过：

```ts
import { data as articles } from '../../daily.data'
```

获取构建期生成的文章数组，然后用 `mode` 决定展示方式：

```vue
<DailyArticles mode="latest" />
<DailyArticles mode="archive" :archive-limit="100" />
<DailyArticles mode="tags" />
```

最新文章只取排序后的前 20 篇：

```ts
const latestArticles = computed(() => articles.slice(0, props.latestLimit))
```

归档页先按日期截取，再通过 `Map` 按 `YYYY-MM` 分组：

```ts
const archiveMonths = computed(() => {
  const months = new Map<string, typeof articles>()

  for (const article of archiveArticles.value) {
    const group = months.get(article.month) ?? []
    group.push(article)
    months.set(article.month, group)
  }

  return [...months.entries()]
})
```

标签页则遍历每篇文章的全部标签，把一篇文章放入对应的多个分组：

```ts
for (const article of articles) {
  for (const tag of article.tags) {
    const group = tags.get(tag) ?? []
    group.push(article)
    tags.set(tag, group)
  }
}
```

因此，新增一篇文章的实际流程变成：创建 Markdown、填写 Frontmatter、运行构建。首页、归档和标签页都从同一份 `articles` 数据派生，避免了多处维护链接的问题。

## 实践建议

1. **把 Frontmatter 当成数据契约。** 明确哪些字段必填，并在加载器中校验日期、标题等关键字段，不要把不可靠的 `unknown` 直接传给组件。
2. **在数据层过滤草稿。** `listed: false`、权限过滤或文章状态判断应尽量集中处理，避免每个展示组件各写一套规则。
3. **先排序再分页或截取。** 只有先得到稳定的全局顺序，`slice(0, 20)` 才代表最新 20 篇；排序时可以增加 URL 作为同日期文章的次级键。
4. **按页面需求裁剪数据。** 列表页不需要完整 HTML，使用最小字段可以减少客户端数据体积，也能降低组件与 Markdown 渲染细节的耦合。
5. **区分构建期和运行期数据。** `createContentLoader` 适合静态文档、文章索引和 RSS；如果数据来自用户操作或后端接口，应使用运行时请求，不要误以为内容加载器会实时查询数据库。
6. **统一处理站点 Base URL。** 页面链接使用 VitePress 的 `withBase`，这样开发环境和部署到 `/blog/` 子路径时都能正确生成 URL。
7. **让构建承担数据质量检查。** 缺失日期、错误格式和无效 Frontmatter 应该让构建失败；静态站点最适合在发布前尽早发现内容问题。

## 延伸阅读

- [VitePress：Data Loading](https://vitepress.dev/guide/data-loading)
- [VitePress：Frontmatter](https://vitepress.dev/guide/frontmatter)
- [VitePress：Using Vue in Markdown](https://vitepress.dev/guide/using-vue)
- [每日技术：如何使用「每日技术」文章模板](/daily/2026/07/2026-07-30-daily-template)
- [VitePress 官方文档](https://vitepress.dev/)
