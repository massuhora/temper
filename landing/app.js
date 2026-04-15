/* Temper Landing Page — Theme & i18n Controller */

(function () {
  'use strict'

  // --------------------------------------------------------------------------
  // Translations
  // --------------------------------------------------------------------------
  const i18n = {
    zh: {
      nav_features: '功能',
      nav_frameworks: '框架',
      nav_workflow: '流程',
      nav_download: '下载',
      hero_badge: '本地优先 · 隐私至上',
      hero_title: '训练你的<br/><span class="text-[var(--primary)]">结构化思维</span>',
      hero_subtitle: 'Temper 是一款本地优先的结构化思维训练工具。通过系统化的练习框架、AI 反馈与错题复训，帮助你在表达与思考中建立清晰、严谨的逻辑。',
      hero_cta_primary: '免费下载',
      hero_cta_secondary: '了解更多',
      features_title: '为深度思考者设计',
      features_subtitle: '从诊断改错到限时速写，每一个功能都围绕「建立思维习惯」而打造。',
      feat_1_title: '今日训练',
      feat_1_desc: '错题复训、薄弱项推荐、全库随机练习，以及限时结构速写，让每一天的练习都有针对性。',
      feat_2_title: 'AI 流式反馈',
      feat_2_desc: '提交作答后，AI 会从多个维度给出评分与问题清单，并提供优化版本，支持多轮修改。',
      feat_3_title: '题库管理',
      feat_3_desc: '支持 Markdown + YAML Frontmatter 导入导出，按框架与标签筛选，构建属于你的个人题库。',
      feat_4_title: '统计看板',
      feat_4_desc: '总练习次数、平均分、错题数、能力雷达图与趋势分析，用数据见证成长。',
      feat_5_title: '原则库',
      feat_5_desc: '在练习前后推送相关原则，持续积累属于你的结构化表达方法论。',
      feat_6_title: '完全本地',
      feat_6_desc: '所有数据保存在本地 SQLite，包括 API Key。不依赖云服务，你的思考只属于你。',
      frameworks_title: '内置六大训练框架',
      frameworks_subtitle: '覆盖职场表达、问题分析与逻辑构建的经典方法论。',
      fw_1_title: '金字塔原理',
      fw_1_desc: '结论先行，以上统下',
      fw_2_title: 'MECE 原则',
      fw_2_desc: '相互独立，完全穷尽',
      fw_3_title: 'PREP 模型',
      fw_3_desc: '观点 - 理由 - 例证 - 重申',
      fw_4_title: 'SCQA 模型',
      fw_4_desc: '情境 - 冲突 - 问题 - 答案',
      fw_5_title: '5W2H',
      fw_5_desc: '全面梳理问题要素',
      fw_6_title: '逻辑树',
      fw_6_desc: '逐层拆解，追根溯源',
      workflow_title: '两步作答，持续精进',
      workflow_subtitle: '从结构骨架到完整正文，再到 AI 反馈与多轮优化，形成完整的学习闭环。',
      step_1_title: '原则预热',
      step_1_desc: '练习前推送相关原则，激活思维框架。',
      step_2_title: '两步作答',
      step_2_desc: '先写结构骨架，再填充正文，强化逻辑先行。',
      step_3_title: 'AI 反馈',
      step_3_desc: '维度评分、问题清单、优化版本一目了然。',
      step_4_title: '多轮优化',
      step_4_desc: '保存优化版本，对比历次得分，见证进步。',
      trust_title: '你的数据，只属于你',
      trust_desc: 'Temper 不依赖任何后端服务或云服务。所有题目、练习记录、原则库与 API 配置均保存在本地 SQLite 数据库中。我们甚至不会收集任何使用数据。',
      trust_item_1: '纯本地 SQLite 存储',
      trust_item_2: 'Markdown / ZIP 全量备份',
      trust_item_3: 'API Key 仅保存在本地',
      trust_status: '本地已加密',
      cta_title: '开始你的思维训练',
      cta_subtitle: 'Temper 目前处于积极开发中，支持 Windows 与 macOS 桌面端。下载最新版本，即刻开启结构化表达的提升之旅。',
      cta_download: '下载 Windows 版',
      cta_github: '在 GitHub 上查看',
      cta_note: '当前为开源预览版本，后续将提供正式安装包。',
      footer_copy: '© 2026 Temper. 所有数据本地存储，隐私至上。',
      footer_privacy: '隐私',
      footer_terms: '条款',
      footer_contact: '联系',
    },
    en: {
      nav_features: 'Features',
      nav_frameworks: 'Frameworks',
      nav_workflow: 'Workflow',
      nav_download: 'Download',
      hero_badge: 'Local-first · Privacy-first',
      hero_title: 'Train Your<br/><span class="text-[var(--primary)]">Structured Thinking</span>',
      hero_subtitle: 'Temper is a local-first structured thinking trainer. Through systematic frameworks, AI feedback, and mistake review, it helps you build clear and rigorous logic in expression and reasoning.',
      hero_cta_primary: 'Free Download',
      hero_cta_secondary: 'Learn More',
      features_title: 'Built for Deep Thinkers',
      features_subtitle: 'From diagnostic editing to timed sketches, every feature is designed to build thinking habits.',
      feat_1_title: 'Daily Training',
      feat_1_desc: 'Mistake review, weak-spot recommendations, random drills, and timed sketches make every practice session purposeful.',
      feat_2_title: 'AI Streaming Feedback',
      feat_2_desc: 'After submission, AI scores multiple dimensions, lists issues, and provides an optimized version—supporting multi-round revisions.',
      feat_3_title: 'Question Bank',
      feat_3_desc: 'Import and export via Markdown + YAML Frontmatter. Filter by framework and tags to build your personal question library.',
      feat_4_title: 'Statistics',
      feat_4_desc: 'Total sessions, average score, mistake count, radar charts, and trend analysis let data witness your growth.',
      feat_5_title: 'Principle Library',
      feat_5_desc: 'Relevant principles are pushed before and after practice, continuously accumulating your own methodology.',
      feat_6_title: 'Fully Local',
      feat_6_desc: 'All data is stored in a local SQLite database, including your API key. No cloud dependency—your thinking belongs only to you.',
      frameworks_title: 'Six Built-in Frameworks',
      frameworks_subtitle: 'Covering classic methodologies for workplace communication, problem analysis, and logical construction.',
      fw_1_title: 'Pyramid Principle',
      fw_1_desc: 'Lead with the conclusion',
      fw_2_title: 'MECE',
      fw_2_desc: 'Mutually exclusive, collectively exhaustive',
      fw_3_title: 'PREP Model',
      fw_3_desc: 'Point - Reason - Example - Restate',
      fw_4_title: 'SCQA Model',
      fw_4_desc: 'Situation - Conflict - Question - Answer',
      fw_5_title: '5W2H',
      fw_5_desc: 'Map out all problem elements',
      fw_6_title: 'Logic Tree',
      fw_6_desc: 'Decompose layer by layer',
      workflow_title: 'Two-step Answer, Continuous Improvement',
      workflow_subtitle: 'From outline to full text, then to AI feedback and multi-round optimization—forming a complete learning loop.',
      step_1_title: 'Principle Warm-up',
      step_1_desc: 'Relevant principles are pushed before practice to activate thinking frameworks.',
      step_2_title: 'Two-step Answer',
      step_2_desc: 'Outline first, then fill in the body to reinforce logic before expression.',
      step_3_title: 'AI Feedback',
      step_3_desc: 'Dimension scores, issue lists, and optimized versions at a glance.',
      step_4_title: 'Multi-round Optimization',
      step_4_desc: 'Save optimized versions and compare scores over time to see progress.',
      trust_title: 'Your Data Belongs to You',
      trust_desc: 'Temper does not rely on any backend or cloud service. All questions, records, principles, and API settings are stored in a local SQLite database. We do not collect any usage data.',
      trust_item_1: 'Pure local SQLite storage',
      trust_item_2: 'Markdown / ZIP full backup',
      trust_item_3: 'API key stored locally only',
      trust_status: 'Local Encrypted',
      cta_title: 'Start Your Training',
      cta_subtitle: 'Temper is actively under development, supporting Windows and macOS. Download the latest build and start improving your structured expression today.',
      cta_download: 'Download for Windows',
      cta_github: 'View on GitHub',
      cta_note: 'Currently an open-source preview; official installers will follow.',
      footer_copy: '© 2026 Temper. All data is stored locally. Privacy first.',
      footer_privacy: 'Privacy',
      footer_terms: 'Terms',
      footer_contact: 'Contact',
    }
  }

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  let currentLang = 'zh'
  let currentTheme = 'light'

  const STORAGE_KEY_LANG = 'temper-landing-lang'
  const STORAGE_KEY_THEME = 'temper-landing-theme'

  // --------------------------------------------------------------------------
  // Theme
  // --------------------------------------------------------------------------
  function applyTheme(theme) {
    currentTheme = theme
    const html = document.documentElement
    const sun = document.getElementById('theme-icon-sun')
    const moon = document.getElementById('theme-icon-moon')

    if (theme === 'dark') {
      html.classList.add('dark')
      if (sun) sun.classList.remove('hidden')
      if (moon) moon.classList.add('hidden')
    } else {
      html.classList.remove('dark')
      if (sun) sun.classList.add('hidden')
      if (moon) moon.classList.remove('hidden')
    }

    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme)
    } catch (_) {}
  }

  function toggleTheme() {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark')
  }

  function initTheme() {
    let theme = 'light'
    try {
      const stored = localStorage.getItem(STORAGE_KEY_THEME)
      if (stored) theme = stored
    } catch (_) {}
    applyTheme(theme)
  }

  // --------------------------------------------------------------------------
  // Language
  // --------------------------------------------------------------------------
  function applyLanguage(lang) {
    currentLang = lang
    const dict = i18n[lang] || i18n.zh
    const elements = document.querySelectorAll('[data-i18n]')

    elements.forEach(el => {
      const key = el.getAttribute('data-i18n')
      if (dict[key] !== undefined) {
        // If the original content contains HTML (e.g., hero_title), use innerHTML
        // otherwise use textContent for safety
        if (/<[^>]+>/.test(dict[key])) {
          el.innerHTML = dict[key]
        } else {
          el.textContent = dict[key]
        }
      }
    })

    // Update language toggle button to show target language
    const langBtn = document.getElementById('lang-toggle')
    if (langBtn) {
      if (lang === 'zh') {
        langBtn.textContent = 'English'
        langBtn.setAttribute('aria-label', 'Switch to English')
      } else {
        langBtn.textContent = '中文'
        langBtn.setAttribute('aria-label', '切换到中文')
      }
    }

    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'

    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang)
    } catch (_) {}
  }

  function toggleLanguage() {
    applyLanguage(currentLang === 'zh' ? 'en' : 'zh')
  }

  function initLanguage() {
    let lang = 'en'
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LANG)
      if (stored) lang = stored
    } catch (_) {}
    applyLanguage(lang)
  }

  // --------------------------------------------------------------------------
  // Intersection Observer for scroll reveal
  // --------------------------------------------------------------------------
  function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in')
          observer.unobserve(entry.target)
        }
      })
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    })

    document.querySelectorAll('.feature-card, .framework-item, .workflow-step').forEach(el => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(16px)'
      observer.observe(el)
    })
  }

  // --------------------------------------------------------------------------
  // Init
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initTheme()
    initLanguage()
    initScrollReveal()

    const themeBtn = document.getElementById('theme-toggle')
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme)

    const langBtn = document.getElementById('lang-toggle')
    if (langBtn) langBtn.addEventListener('click', toggleLanguage)
  })
})()
