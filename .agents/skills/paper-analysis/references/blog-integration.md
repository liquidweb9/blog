# 本仓库集成与交付

以下是当前 VitePress 博客仓库的约定，路径均相对于仓库根目录。复用于其他项目时，先检查其说明、目录、构建命令与现有写法；只需输出 Markdown 时，按用户目标保存文章和配图即可。检查 Git 状态，保护已有用户修改。

## 1. 位置与命名

| 内容 | 路径 |
| --- | --- |
| 专栏入口 | `docs/papers/index.md` |
| 可读写作模板 | `docs/papers/template.md` |
| 文章 | `docs/papers/<direction>/YYYY-MM-DD-paper-slug.md` |
| 配图 | `docs/papers/<direction>/images/<paper-slug>/fig-<原图号>-<含义>.webp` |
| 方向索引 | `docs/papers/<direction>/index.md` |
| 侧边栏 | `docs/.vitepress/config.mts` 中的 `/papers/` |
| 原稿与内部资料 | `paper-originals/<direction>/<发表年份>-<paper-slug>/` |
| 原稿来源索引 | `paper-originals/sources.md` |

现有方向：

- `llm-agents`：大模型与智能体。
- `computer-vision`：计算机视觉与多模态。
- `systems`：系统与后端。
- `cryptography`：密码学与隐私计算。

跨方向文章选择一个主要目录，以 tags 记录其他主题。没有合适方向时按实际研究领域扩展，不硬塞分类。文章日期为写作/发布日期，原稿目录年份取实际发表年份；未知时标明未知，不虚构。

## 2. 原稿与配图

- 原稿目录存 `paper.pdf`、补充材料、提取文本、图像裁剪脚本和 `reading-pack.md` 等工作资料。
- `.gitignore` 仅放行原稿库的 `README.md` 和 `sources.md`；确认新 PDF 与内部资料实际被忽略，例如 `git check-ignore -v -- "paper-originals/<direction>/<year>-<slug>/paper.pdf"`。
- 来源索引记录官方 URL、主版本、下载日期、本地相对路径和实际可得的 SHA-256 等信息；不要把 PDF 放进 `docs/` 或生成站点的公开目录。
- 坚果云由用户客户端同步，除非有明确完成证据，不宣称已配置或已同步。文章不依赖云盘图床。
- 文章用官方论文入口，原稿本地路径不能作为站内下载链接。
- 图像用 `./images/<paper-slug>/...` 相对引用；检查实际清晰度和裁剪完整性后再压缩。
- 可在配图目录的 `sources.json` 记录主版本 URL、许可、原图号、页码、裁剪坐标和转换过程，沿用现有格式；未知许可不能默认写成 CC BY 4.0。
- 图注简洁，图源、作者、许可与改动按实际要求署名；可在文末合并，不能仅藏在注释或 JSON 中。

## 3. 文章元数据与入口

```yaml
---
title: '论文简称：核心方法与研究问题'
date: 'YYYY-MM-DD'
description: '用一两句话交代方法、问题与实际支持的结论。'
direction: '中文方向名'
tags:
  - 论文研读
  - 具体主题
listed: false
---
```

写作时可保留 `listed: false`；完成发布检查后，按用户交付意图设置 `listed: true`。该字段只控制首页最近更新与 RSS，**不让页面变私密，也不禁止搜索**。

- 在方向 `index.md` 增加日期、标题链接和一句话概述；按现有排序。
- 在 `/papers/` 侧边栏加入文章入口；必要时更新专栏阅读进度。
- 有效日期且 `listed: true` 的文章会进入现有首页与 RSS 加载器，新文章通常不需要改加载器代码。
- 本站 `base` 为 `/blog/`，`cleanUrls: true`；沿用站内根相对链接或适当相对链接，不把本机路径写入正文。

## 4. 验证与交付标准

### 内容检查

- 模板占位、待补图、假链接和可见自检标题已清除；关键结论、假设和限制仍完整。
- 至少选关键公式与全部自拟数值例子复核；事实数字来自同一主版本与正确配置。
- 一段话概览能被后文证据支持，例子不会暗示未执行的实测。

### 构建与渲染

1. 运行 `npm run docs:build`；修复本次修改引入的构建错误和死链。
2. 用现有预览方式检查页面和目录，自检注释不应作为正文文字或目录标题显示；不只用源码 grep 判断隐藏效果。
3. 检查全部新配图、关键公式与站内链接；桌面和窄屏确认图表可读、长公式在局部滚动而非整页溢出。
4. 对已发布到列表的文章，确认方向入口、侧栏、首页与 RSS；RSS 中图片地址可加载，自检备注不应作为阅读内容显示。
5. `git diff --check` 并检查 `git status --short`。新文件尚未跟踪时，可用 `git diff --no-index --check -- <空设备> "<file>"` 单独检查空白，Windows 的空设备为 `NUL`，Linux/macOS 为 `/dev/null`；不为检查而暂存文件。

只运行与改动相关的检查；若未修改站点代码，不新增测试框架或改变全站布局。明确区分既有警告与本次问题。预览进程用完后关闭自己启动的进程。

最终告诉用户文章路径、内容概要、原稿存放和实际验证结果。只有用户明确请求时才提交、推送或部署。
