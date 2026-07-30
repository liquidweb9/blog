import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
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
      { text: '每日技术', link: '/daily/' },
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
          text: '基础与编排',
          collapsed: false,
          items: [
            { text: 'Agent 基础', link: '/notes/agent-engineering/01-agent-basics' },
            { text: 'Prompt 与结构化输出', link: '/notes/agent-engineering/02-prompt-engineering' },
            { text: 'Loop、Planning 与 Graph', link: '/notes/agent-engineering/03-agent-loop-planning-graph' }
          ]
        },
        {
          text: '工具与协议',
          collapsed: false,
          items: [
            { text: 'Function Call、Tool 与 MCP', link: '/notes/agent-engineering/04-tool-engineering' },
            { text: '协议与互操作', link: '/notes/agent-engineering/05-agent-protocols' }
          ]
        },
        {
          text: '信息管理',
          collapsed: false,
          items: [
            { text: 'RAG 工程', link: '/notes/agent-engineering/06-rag-engineering' },
            { text: 'Agent Memory', link: '/notes/agent-engineering/07-agent-memory' },
            { text: 'Context Engineering', link: '/notes/agent-engineering/08-context-engineering' },
            { text: 'Harness Engineering', link: '/notes/agent-engineering/09-harness-engineering' }
          ]
        },
        {
          text: '生产实践',
          collapsed: false,
          items: [
            { text: 'Evaluation、Testing 与 Observability', link: '/notes/agent-engineering/10-agent-evaluation' },
            { text: 'Runtime、部署与 Durable Execution', link: '/notes/agent-engineering/11-agent-runtime' },
            { text: '模型策略、成本与性能', link: '/notes/agent-engineering/12-model-strategy' },
            { text: '安全、威胁建模与可靠性', link: '/notes/agent-engineering/13-agent-security' },
            { text: 'Human-in-the-loop', link: '/notes/agent-engineering/14-human-in-the-loop' },
            { text: '完整案例：Wenjian', link: '/notes/agent-engineering/15-production-case-wenjian' }
          ]
        }
      ],
      '/notes/backend/': [
        { text: '概览', link: '/notes/backend/' },
        {
          text: '基础',
          collapsed: false,
          items: [
            { text: '操作系统与并发编程', link: '/notes/backend/01-computer-fundamentals' },
            { text: '计算机网络与HTTP', link: '/notes/backend/02-computer-networks-and-http' },
            { text: '编程语言与运行时', link: '/notes/backend/03-programming-languages-and-runtimes' }
          ]
        },
        {
          text: 'Web 与数据',
          collapsed: false,
          items: [
            { text: 'Web框架与项目分层', link: '/notes/backend/04-web-frameworks-and-layered-architecture' },
            { text: 'MySQL', link: '/notes/backend/05-database-mysql' },
            { text: 'NoSQL数据库', link: '/notes/backend/06-nosql-databases' }
          ]
        },
        {
          text: '中间件与分布式',
          collapsed: false,
          items: [
            { text: '消息队列', link: '/notes/backend/07-message-queues' },
            { text: '分布式系统与可靠性', link: '/notes/backend/08-distributed-systems-and-reliability' },
            { text: '安全', link: '/notes/backend/09-security' }
          ]
        },
        {
          text: '工程实践',
          collapsed: false,
          items: [
            { text: '测试', link: '/notes/backend/10-testing' },
            { text: '日志、监控与可观测性', link: '/notes/backend/11-logging-monitoring-and-observability' },
            { text: 'Linux、容器与部署', link: '/notes/backend/12-linux-containers-and-deployment' },
            { text: '软件工程与系统设计', link: '/notes/backend/13-software-engineering-and-system-design' },
            { text: '性能优化与故障排查', link: '/notes/backend/14-performance-optimization-and-troubleshooting' },
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
            { text: '计算机视觉基础', link: '/notes/computer-vision/00-computer-vision-foundations' },
            { text: '目标检测基础', link: '/notes/computer-vision/01-object-detection-foundations' },
            { text: '目标追踪', link: '/notes/computer-vision/02-object-tracking' }
          ]
        },
        {
          text: '目标检测算法',
          collapsed: false,
          items: [
            { text: 'YOLOv5与YOLO11', link: '/notes/computer-vision/03-yolov5-and-yolo11' },
            { text: 'DETR与RT-DETRv2', link: '/notes/computer-vision/04-detr-and-rt-detrv2' },
            { text: 'RT-DETRv3与v4演进', link: '/notes/computer-vision/05-rt-detrv3-and-v4-evolution' }
          ]
        },
        {
          text: '多目标追踪',
          collapsed: false,
          items: [
            { text: '足球追踪问题定义', link: '/notes/computer-vision/06-football-tracking-problem-definition' },
            { text: 'KF、IMM-KF与Viterbi', link: '/notes/computer-vision/07-KF-IMMKF-Viterbi' },
            { text: 'ByteTrack与CoTracker', link: '/notes/computer-vision/08-ByteTrack-CoTracker' },
            { text: 'TrackNetV4与TOTNet', link: '/notes/computer-vision/09-TrackNetV4-TOTNet' },
            { text: '足球完整追踪流水线', link: '/notes/computer-vision/10-end-to-end-football-tracking-pipeline' }
          ]
        },
        {
          text: '足球视频理解',
          collapsed: false,
          items: [
            { text: 'Action Spotting与SoccerNet', link: '/notes/computer-vision/11-ActionSpotting-SoccerNet' },
            { text: 'T-DEED与dude.k', link: '/notes/computer-vision/12-T-DEED-dudek' },
            { text: '多模态足球理解', link: '/notes/computer-vision/13-multimodal-football-understanding' },
            { text: 'NVIDIA VSS', link: '/notes/computer-vision/14-NVIDIA-VSS' }
          ]
        }
      ],
      '/notes/cryptography/': [
        { text: '概览', link: '/notes/cryptography/' },
        {
          text: '基础',
          collapsed: false,
          items: [
            { text: '隐私计算基础', link: '/notes/cryptography/00-privacy-computing-foundations' },
            { text: '密码学数学基础', link: '/notes/cryptography/01-mathematical-foundations' },
            { text: '基础密码原语', link: '/notes/cryptography/02-basic-cryptographic-primitives' }
          ]
        },
        {
          text: '密码协议',
          collapsed: false,
          items: [
            { text: '安全模型与高级公钥加密', link: '/notes/cryptography/03-security-models-and-advanced-public-key-encryption' },
            { text: '同态加密与安全多方计算', link: '/notes/cryptography/04-homomorphic-encryption-and-secure-multi-party-computation' },
            { text: '零知识证明与数字签名', link: '/notes/cryptography/05-zero-knowledge-proofs-and-digital-signatures' }
          ]
        },
        {
          text: '隐私与前沿',
          collapsed: false,
          items: [
            { text: '隐私增强协议与差分隐私', link: '/notes/cryptography/06-privacy-enhancing-protocols-and-differential-privacy' },
            { text: '后量子密码与可信硬件', link: '/notes/cryptography/07-post-quantum-cryptography' },
            { text: '联邦学习与密码系统安全', link: '/notes/cryptography/08-federated-learning-and-cryptosystem-security' }
          ]
        }
      ],
      '/daily/': [
        {
          text: '每日技术',
          items: [
            { text: '最新文章', link: '/daily/' },
            { text: '文章归档', link: '/daily/archive' },
            { text: '标签分类', link: '/daily/tags' }
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
}))
