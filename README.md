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
