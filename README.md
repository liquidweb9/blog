# 个人博客与学习笔记

基于 [VitePress](https://vitepress.dev/) 构建的个人主页、学习笔记与项目记录。

## 本地开发

```bash
npm install
npm run docs:dev
```

## 构建预览

```bash
npm run docs:build
npm run docs:preview
```

## 发布到 GitHub Pages

1. 在 GitHub 创建仓库，并将本项目推送到 `main` 分支。
2. 打开仓库的 **Settings → Pages**。
3. 将 **Build and deployment → Source** 设置为 **GitHub Actions**。
4. 工作流会自动构建并发布站点。

若使用自定义域名，请在 `docs/public/` 下添加 `CNAME` 文件，并在
`docs/.vitepress/config.mts` 中按需调整站点信息。

## 写新笔记

在 `docs/notes/` 对应分类中新增 `.md` 文件，然后在
`docs/.vitepress/config.mts` 的侧边栏中添加入口即可。

## 写论文研读

专栏「论文研读札记」位于 `docs/papers/`，按大模型与智能体、计算机视觉与多模态、系统与后端、密码学与隐私计算分类。

1. 从 `docs/papers/template.md` 复制 Markdown 模板，在对应方向下创建 `YYYY-MM-DD-paper-slug.md`。
2. 填写标题、发布日期、方向与关键词，按模板完成概览、贡献与场景分析、结合原图的方法详解、实验简析、总结与后续方向、延伸阅读。
3. 配图保存在对应方向的 `images/paper-slug/` 下，正文用相对路径引用并标明原图编号与出处。
4. 在方向的 `index.md` 及 `docs/.vitepress/config.mts` 的 `/papers/` 侧边栏中添加文章入口。
5. 发布时设置 `listed: true`。带有效 `date` 的文章会自动进入首页最近更新和 RSS；`listed: false` 仅排除这两个列表。

### 使用论文分析 skill

本仓库在通用的 `.agents/skills/` 目录提供 [`paper-analysis`](./.agents/skills/paper-analysis/SKILL.md)，采用标准 Agent Skills 结构，支持从官方论文链接或本地 PDF 完成全文研读、图解、例子、实验分析和博客集成。

在支持该 skill 目录的 agent 中可以直接说：

```text
使用 paper-analysis 分析 https://openreview.net/forum?id=论文标识，写成论文研读札记。

使用 paper-analysis 研读 ./papers/example.pdf，重点解释方法和公式，适当增加例子。
```

skill 包含分步 subagent 提示词、一个贯穿案例加必要局部例子的写法，以及将版本、来源核对和作者自检留在 Markdown 注释中的规则。方法假设、实验条件和重要限制仍保留在正文。

若 agent 不自动发现此目录，可明确要求「先读取 `.agents/skills/paper-analysis/SKILL.md`，再按其流程分析论文」。也可将整个 `paper-analysis/` 目录放入目标工具支持的 skill 目录，保留 `references/` 和 `assets/` 的相对结构；其他项目按实际约定调整文章目录和发布检查。

skill 不依赖特定工具名或模型；支持 subagent 时分步委派，不支持时顺序完成相同流程。需要刷新 skill 列表的工具，请重新加载或重启会话。

### 论文原稿存放

原稿库为仓库根目录的 [`paper-originals/`](./paper-originals/README.md)，来源与版本记录在 [`paper-originals/sources.md`](./paper-originals/sources.md)。PDF、补充材料等原稿文件已通过 `.gitignore` 排除，不进入 Git 或博客构建。

可将原稿库设为坚果云同步文件夹，用于跨设备阅读与备份。博客文章保留官方论文链接，配图仍保存在 `docs/papers/` 中；坚果云分享链接按需作为补充入口。
