import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '邓厚锐',
  description: '邓厚锐的个人博客、学习笔记与项目实践',
  base: '/blog/',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: 'https://liquidweb9.github.io/blog/'
  },
  head: [
    ['meta', { name: 'theme-color', content: '#3b67f2' }],
    ['meta', { name: 'author', content: '邓厚锐' }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: '邓厚锐',
    nav: [
      { text: '首页', link: '/' },
      { text: '关于我', link: '/about/' },
      {
        text: '学习笔记',
        items: [
          { text: 'Agent Engineering', link: '/notes/agent-engineering/' },
          { text: '后端工程', link: '/notes/backend/' },
          { text: '计算机视觉', link: '/notes/computer-vision/' },
          { text: '密码学与隐私计算', link: '/notes/cryptography/' }
        ]
      },
      { text: '项目实践', link: '/projects/' },
      { text: '开发日志', link: '/devlog/' },
      { text: '简历', link: '/resume' }
    ],
    sidebar: {
      '/about/': [
        {
          text: '关于我',
          items: [
            { text: '个人简介', link: '/about/' },
            { text: '技术方向', link: '/about/tech' },
            { text: '联系方式', link: '/about/contact' }
          ]
        }
      ],
      '/notes/agent-engineering/': [
        {
          text: 'Agent Engineering',
          items: [
            { text: '概览', link: '/notes/agent-engineering/' },
            { text: 'Agent 基础', link: '/notes/agent-engineering/agent-basics' },
            { text: 'Agent Loop 与 Graph', link: '/notes/agent-engineering/agent-loop' },
            { text: 'Function Call 与 MCP', link: '/notes/agent-engineering/function_call_mcp_engineering' },
            { text: 'RAG 工程', link: '/notes/agent-engineering/RAG' },
            { text: 'Agent Memory', link: '/notes/agent-engineering/memory' },
            { text: 'Context 与 Harness', link: '/notes/agent-engineering/harness-engineering' },
            { text: '安全与可靠性', link: '/notes/agent-engineering/agent-security' }
          ]
        }
      ],
      '/notes/backend/': [
        {
          text: '后端工程',
          items: [
            { text: '概览', link: '/notes/backend/' },
            { text: '系统设计', link: '/notes/backend/system-design' }
          ]
        }
      ],
      '/notes/computer-vision/': [
        {
          text: '计算机视觉',
          items: [
            { text: '概览', link: '/notes/computer-vision/' },
            { text: '目标追踪', link: '/notes/computer-vision/object-tracking' }
          ]
        }
      ],
      '/notes/cryptography/': [
        {
          text: '密码学与隐私计算',
          items: [
            { text: '概览', link: '/notes/cryptography/' },
            { text: '隐私计算基础', link: '/notes/cryptography/privacy-computing' }
          ]
        }
      ],
      '/projects/': [
        {
          text: '项目实践',
          items: [
            { text: '项目总览', link: '/projects/' },
            { text: 'Wenjian', link: '/projects/wenjian' },
            { text: 'Auto-PDP', link: '/projects/auto-pdp' },
            { text: '足球追踪系统', link: '/projects/football-tracking' },
            { text: '安全文件共享系统', link: '/projects/file-upload' },
            { text: 'FindJob', link: '/projects/findjob' },
            { text: '空间推理研究', link: '/projects/spatial-reasoning' }
          ]
        }
      ],
      '/devlog/': [
        {
          text: '开发日志',
          items: [{ text: '日志索引', link: '/devlog/' }]
        }
      ]
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '没有找到相关结果',
            resetButtonTitle: '清除查询',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
    outline: { level: [2, 3], label: '页面导航' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新于' },
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    footer: {
      message: '以好奇心驱动学习，以工程化沉淀实践。',
      copyright: 'Copyright © 2026 邓厚锐'
    }
  }
})
