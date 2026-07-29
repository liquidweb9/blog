import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  markdown: {
    math: true
  },
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
        { text: '概览', link: '/notes/agent-engineering/' },
        {
          text: '基础概念',
          collapsed: false,
          items: [
            { text: 'Agent 基础', link: '/notes/agent-engineering/01-agent-basics' },
            { text: 'Agent Loop', link: '/notes/agent-engineering/02-agent-loop' },
            { text: 'Agent Graph', link: '/notes/agent-engineering/03-agent-graph' }
          ]
        },
        {
          text: '工具与协议',
          collapsed: false,
          items: [
            { text: 'Function Call', link: '/notes/agent-engineering/04-function-call' },
            { text: 'MCP', link: '/notes/agent-engineering/05-mcp' }
          ]
        },
        {
          text: '信息管理',
          collapsed: false,
          items: [
            { text: 'RAG 工程', link: '/notes/agent-engineering/06-rag-engineering' },
            { text: 'Agent Memory', link: '/notes/agent-engineering/07-agent-memory' },
            { text: 'Context 与 Harness', link: '/notes/agent-engineering/08-harness-engineering' }
          ]
        },
        {
          text: '生产实践',
          collapsed: false,
          items: [
            { text: '安全与可靠性', link: '/notes/agent-engineering/09-agent-security' }
          ]
        }
      ],
      '/notes/backend/': [
        { text: '概览', link: '/notes/backend/' },
        {
          text: '基础',
          collapsed: false,
          items: [
            { text: '操作系统与并发编程', link: '/notes/backend/01-计算机基础' },
            { text: '计算机网络与HTTP', link: '/notes/backend/02-计算机网络与HTTP' },
            { text: '编程语言与运行时', link: '/notes/backend/03-编程语言与运行时' }
          ]
        },
        {
          text: 'Web 与数据',
          collapsed: false,
          items: [
            { text: 'Web框架与项目分层', link: '/notes/backend/04-Web框架与项目分层' },
            { text: 'MySQL', link: '/notes/backend/05-数据库-MySQL' },
            { text: 'NoSQL数据库', link: '/notes/backend/06-NoSQL数据库' }
          ]
        },
        {
          text: '中间件与分布式',
          collapsed: false,
          items: [
            { text: '消息队列', link: '/notes/backend/07-消息队列' },
            { text: '分布式系统与可靠性', link: '/notes/backend/08-分布式系统与可靠性' },
            { text: '安全', link: '/notes/backend/09-安全' }
          ]
        },
        {
          text: '工程实践',
          collapsed: false,
          items: [
            { text: '测试', link: '/notes/backend/10-测试' },
            { text: '日志、监控与可观测性', link: '/notes/backend/11-日志监控与可观测性' },
            { text: 'Linux、容器与部署', link: '/notes/backend/12-Linux容器与部署' },
            { text: '软件工程与系统设计', link: '/notes/backend/13-软件工程与系统设计' },
            { text: '性能优化与故障排查', link: '/notes/backend/14-性能优化与故障排查' },
            { text: '系统设计案例', link: '/notes/backend/system-design' }
          ]
        }
      ],
      '/notes/computer-vision/': [
        { text: '概览', link: '/notes/computer-vision/' },
        {
          text: '基础',
          collapsed: false,
          items: [
            { text: '计算机视觉基础', link: '/notes/computer-vision/00-计算机视觉基础' },
            { text: '目标检测基础', link: '/notes/computer-vision/01-目标检测基础' },
            { text: '目标追踪', link: '/notes/computer-vision/object-tracking' }
          ]
        },
        {
          text: '目标检测算法',
          collapsed: false,
          items: [
            { text: 'YOLOv5与YOLO11', link: '/notes/computer-vision/02-YOLOv5与YOLO11' },
            { text: 'DETR与RT-DETRv2', link: '/notes/computer-vision/03-DETR与RT-DETRv2' },
            { text: 'RT-DETRv3与v4演进', link: '/notes/computer-vision/04-RT-DETRv3与v4演进' }
          ]
        },
        {
          text: '多目标追踪',
          collapsed: false,
          items: [
            { text: '足球追踪问题定义', link: '/notes/computer-vision/05-足球追踪问题定义' },
            { text: 'KF、IMM-KF与Viterbi', link: '/notes/computer-vision/06-KF-IMMKF-Viterbi' },
            { text: 'ByteTrack与CoTracker', link: '/notes/computer-vision/07-ByteTrack-CoTracker' },
            { text: 'TrackNetV4与TOTNet', link: '/notes/computer-vision/08-TrackNetV4-TOTNet' },
            { text: '足球完整追踪流水线', link: '/notes/computer-vision/09-足球完整追踪流水线' }
          ]
        },
        {
          text: '足球视频理解',
          collapsed: false,
          items: [
            { text: 'Action Spotting与SoccerNet', link: '/notes/computer-vision/10-ActionSpotting-SoccerNet' },
            { text: 'T-DEED与dude.k', link: '/notes/computer-vision/11-T-DEED-dudek' },
            { text: '多模态足球理解', link: '/notes/computer-vision/12-多模态足球理解' },
            { text: 'NVIDIA VSS', link: '/notes/computer-vision/13-NVIDIA-VSS' }
          ]
        }
      ],
      '/notes/cryptography/': [
        { text: '概览', link: '/notes/cryptography/' },
        {
          text: '密码学与隐私计算',
          items: [
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
