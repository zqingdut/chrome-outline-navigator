/* ===================================================
   Page Outline Navigator — Content Script
   自动识别页面标题结构，生成右侧浮动大纲导航
   =================================================== */

(() => {
  'use strict';

  // 避免重复注入
  if (window.__outlineNavigatorLoaded) return;
  window.__outlineNavigatorLoaded = true;

  // ── 配置 ──────────────────────────────────────────
  const CONFIG = {
    // 通用标题选择器（h1-h6）
    headingSelectors: 'h1, h2, h3, h4, h5, h6',
    // 最小标题文字长度（过滤空标题）
    minTextLength: 1,
    // 滚动偏移量（px），避免标题被固定元素遮挡
    scrollOffset: 80,
    // 高亮防抖间隔（ms）
    highlightDebounce: 100,
    // 动画时长（ms）
    animationDuration: 300,
  };

  // ── 热门网站专用选择器 ──────────────────────────────
  const SITE_SELECTORS = {
    // 知乎
    'zhihu.com': {
      question: '.QuestionHeader-title',
      answers: '.AnswerItem .RichContent-inner',
      heading: '.AnswerItem .RichContent-inner h2, .AnswerItem .RichContent-inner h3',
      container: '.Question-main',
    },
    // Stack Overflow
    'stackoverflow.com': {
      question: '#question-header h1',
      answers: '.answercell .s-prose, .postcell .s-prose',
      heading: '.s-prose h1, .s-prose h2, .s-prose h3',
      container: '#mainbar',
    },
    // SegmentFault
    'segmentfault.com': {
      question: '.question-title',
      answers: '.answer-content',
      heading: '.article-content h1, .article-content h2, .article-content h3, .article-content h4',
      container: '.article-content',
    },
    // CSDN
    'csdn.net': {
      question: '.title-article h1',
      answers: '#article_content',
      heading: '#article_content h1, #article_content h2, #article_content h3, #article_content h4',
      container: '#article_content',
    },
    // 掘金
    'juejin.cn': {
      question: '.article-title',
      answers: '.article-content',
      heading: '.article-content h1, .article-content h2, .article-content h3',
      container: '.article-content',
    },
    // 简书
    'jianshu.com': {
      question: 'h1.title',
      answers: '.article .show-content',
      heading: '.show-content h1, .show-content h2, .show-content h3, .show-content h4',
      container: '.article',
    },
    // Medium
    'medium.com': {
      question: 'h1',
      answers: 'article',
      heading: 'article h1, article h2, article h3, article h4',
      container: 'article',
    },
    // GitHub
    'github.com': {
      heading: '.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4',
      container: '.markdown-body',
    },
    // Notion public pages
    'notion.site': {
      heading: '.notion-page-content h1, .notion-page-content h2, .notion-page-content h3',
      container: '.notion-page-content',
    },
    // 微信公众号文章
    'mp.weixin.qq.com': {
      heading: '#js_content h1, #js_content h2, #js_content h3, #js_content h4',
      container: '#js_content',
    },
    // 博客园
    'cnblogs.com': {
      heading: '#cnblogs_post_body h1, #cnblogs_post_body h2, #cnblogs_post_body h3',
      container: '#cnblogs_post_body',
    },

    // ═══════════════════════════════════════════════
    //  AI 问答平台专用适配
    // ═══════════════════════════════════════════════

    // ChatGPT
    'chatgpt.com': {
      heading: '[data-message-author-role="assistant"] h1, [data-message-author-role="assistant"] h2, [data-message-author-role="assistant"] h3, [data-message-author-role="assistant"] h4',
      container: 'main',
      chatMode: true,
      turnSelector: '[data-message-author-role]',
      questionSelector: '[data-message-author-role="user"]',
      answerSelector: '[data-message-author-role="assistant"]',
    },
    'chat.openai.com': {
      heading: '[data-message-author-role="assistant"] h1, [data-message-author-role="assistant"] h2, [data-message-author-role="assistant"] h3, [data-message-author-role="assistant"] h4',
      container: 'main',
      chatMode: true,
      turnSelector: '[data-message-author-role]',
      questionSelector: '[data-message-author-role="user"]',
      answerSelector: '[data-message-author-role="assistant"]',
    },

    // Claude
    'claude.ai': {
      heading: '.font-claude-message h1, .font-claude-message h2, .font-claude-message h3, .font-claude-message h4',
      container: 'main',
      chatMode: true,
      turnSelector: '[data-testid="conversation-turn"]',
      questionSelector: '[data-is-human="true"]',
      answerSelector: '[data-is-human="false"]',
    },

    // Perplexity
    'perplexity.ai': {
      heading: '.prose h1, .prose h2, .prose h3, .prose h4',
      container: 'main',
      chatMode: true,
      turnSelector: '[class*="AnswerItem"], [class*="answer"]',
    },

    // DeepSeek
    'chat.deepseek.com': {
      heading: '.ds-markdown h1, .ds-markdown h2, .ds-markdown h3, .ds-markdown h4',
      container: 'main',
      chatMode: true,
      turnSelector: '.ds-markdown--block',
    },

    // Kimi (月之暗面)
    'kimi.moonshot.cn': {
      heading: '.markdown-container h1, .markdown-container h2, .markdown-container h3, .markdown-container h4',
      container: '.chat-list',
      chatMode: true,
      turnSelector: '.chat-message',
    },

    // 通义千问
    'tongyi.aliyun.com': {
      heading: '.tongyi-markdown h1, .tongyi-markdown h2, .tongyi-markdown h3, .tongyi-markdown h4, .markdown-body h1, .markdown-body h2, .markdown-body h3',
      container: 'main',
      chatMode: true,
      turnSelector: '.chat-message, [class*="message"]',
    },

    // 文心一言
    'yiyan.baidu.com': {
      heading: '.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4',
      container: 'main',
      chatMode: true,
      turnSelector: '.chat-item, [class*="message"]',
    },

    // 豆包
    'doubao.com': {
      heading: '.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4',
      container: 'main',
      chatMode: true,
      turnSelector: '[class*="message"], [class*="chat-item"]',
    },

    // Cursor 文档 / 论坛
    'cursor.com': {
      heading: '.docs-content h1, .docs-content h2, .docs-content h3, .docs-content h4, .forum-post h1, .forum-post h2, .forum-post h3',
      container: '.docs-content, .forum-post, main',
    },

    // HuggingFace 讨论区
    'huggingface.co': {
      heading: '.prose h1, .prose h2, .prose h3, .prose h4, .markdown h1, .markdown h2, .markdown h3',
      container: '.prose, .markdown, main',
    },

    // AIHOT 热点
    'aihot.virxact.com': {
      heading: 'article h1, article h2, article h3',
      container: 'main',
    },
  };

  // ── 工具函数 ─────────────────────────────────────
  function getSiteConfig() {
    const hostname = window.location.hostname;
    for (const [domain, config] of Object.entries(SITE_SELECTORS)) {
      if (hostname.includes(domain)) return config;
    }
    return null;
  }

  function generateId(index) {
    return `__outline_heading_${index}`;
  }

  function getHeadingLevel(el) {
    const tag = el.tagName.toLowerCase();
    return parseInt(tag.replace('h', ''), 10) || 0;
  }

  function truncate(text, maxLen = 60) {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  // ── 收集标题 ──────────────────────────────────────
  function collectHeadings() {
    const siteConfig = getSiteConfig();
    let selector = CONFIG.headingSelectors;
    let container = null;

    if (siteConfig) {
      if (siteConfig.heading) selector = siteConfig.heading;
      if (siteConfig.container) {
        container = document.querySelector(siteConfig.container);
      }
    }

    const root = container || document.body;
    const elements = root.querySelectorAll(selector);
    const headings = [];

    elements.forEach((el, i) => {
      const text = el.textContent.trim();
      if (text.length < CONFIG.minTextLength) return;
      if (!isVisible(el)) return;
      if (!el.id) el.id = generateId(i);

      headings.push({
        id: el.id,
        text: text,
        level: getHeadingLevel(el),
        element: el,
      });
    });

    // AI 聊天模式：标题不足时，提取问答轮次作为导航
    if (siteConfig && siteConfig.chatMode && headings.length < 2) {
      const chatHeadings = collectChatTurns(siteConfig);
      if (chatHeadings.length > 0) return chatHeadings;
    }

    return headings;
  }

  // ── AI 聊天模式：提取问答轮次 ─────────────────────
  function collectChatTurns(siteConfig) {
    const items = [];

    // 提取用户提问
    if (siteConfig.questionSelector) {
      document.querySelectorAll(siteConfig.questionSelector).forEach((el, i) => {
        if (!isVisible(el)) return;
        const text = extractQuestionText(el);
        if (!text) return;
        if (!el.id) el.id = `__outline_q_${i}`;
        items.push({ id: el.id, text: `💬 ${text}`, level: 1, element: el, type: 'question' });
      });
    }

    // 提取 AI 回答中的标题
    if (siteConfig.answerSelector) {
      document.querySelectorAll(siteConfig.answerSelector).forEach((el, i) => {
        if (!isVisible(el)) return;
        const headings = el.querySelectorAll('h1, h2, h3, h4');
        headings.forEach((h, j) => {
          const text = h.textContent.trim();
          if (text.length < 2) return;
          if (!h.id) h.id = `__outline_a_${i}_${j}`;
          items.push({ id: h.id, text: text, level: getHeadingLevel(h), element: h, type: 'heading' });
        });
      });
    }

    // 如果还是没东西，尝试通用的 turnSelector
    if (items.length === 0 && siteConfig.turnSelector) {
      document.querySelectorAll(siteConfig.turnSelector).forEach((el, i) => {
        if (!isVisible(el)) return;
        const text = extractFirstLineText(el);
        if (!text) return;
        if (!el.id) el.id = `__outline_turn_${i}`;
        const isQuestion = el.querySelector('[data-message-author-role="user"], [data-is-human="true"]')
          || el.closest('[data-message-author-role="user"]')
          || text.endsWith('?') || text.endsWith('？');
        items.push({
          id: el.id,
          text: isQuestion ? `💬 ${text}` : `🤖 ${text}`,
          level: 1,
          element: el,
          type: isQuestion ? 'question' : 'answer',
        });
      });
    }

    return items;
  }

  // 提取提问文本（取前 N 个字符）
  function extractQuestionText(el) {
    const text = el.textContent.trim();
    // 去掉多余空白
    const clean = text.replace(/\s+/g, ' ');
    return truncate(clean, 50);
  }

  // 提取第一行有意义的文本
  function extractFirstLineText(el) {
    // 优先取第一段文字
    const p = el.querySelector('p, .text, .content');
    const text = (p || el).textContent.trim().replace(/\s+/g, ' ');
    if (text.length < 3) return null;
    return truncate(text, 50);
  }

  // ── 创建侧边栏 DOM ──────────────────────────────
  function createSidebar(headings) {
    // 移除旧侧边栏
    const old = document.getElementById('__outline_sidebar');
    if (old) old.remove();

    // 外层容器
    const sidebar = document.createElement('div');
    sidebar.id = '__outline_sidebar';
    sidebar.className = '__outline_sidebar __outline_collapsed';

    // 拖拽手柄
    const handle = document.createElement('div');
    handle.className = '__outline_handle';
    handle.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12h18M3 6h18M3 18h18"/>
      </svg>
    `;

    // 标题区
    const header = document.createElement('div');
    header.className = '__outline_header';
    header.innerHTML = `
      <div class="__outline_title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h10M4 18h14"/>
        </svg>
        <span>页面大纲</span>
      </div>
      <div class="__outline_count">${headings.length} 项</div>
      <button class="__outline_toggle" title="收起">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
    `;

    // 搜索框
    const search = document.createElement('div');
    search.className = '__outline_search';
    search.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input type="text" placeholder="搜索标题…" class="__outline_search_input" />
    `;

    // 列表容器
    const list = document.createElement('div');
    list.className = '__outline_list';

    headings.forEach((h, i) => {
      const item = document.createElement('div');
      item.className = `__outline_item __outline_level_${h.level}`;
      if (h.type === 'question') item.classList.add('__outline_question');
      if (h.type === 'answer') item.classList.add('__outline_answer');
      item.dataset.index = i;
      item.dataset.targetId = h.id;

      const indent = Math.max(0, (h.level - 1) * 12);

      item.innerHTML = `
        <div class="__outline_item_indent" style="width:${indent}px"></div>
        <div class="__outline_item_marker __outline_marker_level_${h.level}"></div>
        <div class="__outline_item_text" title="${h.text}">${truncate(h.text)}</div>
      `;

      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToHeading(h);
      });

      list.appendChild(item);
    });

    // 空状态
    const empty = document.createElement('div');
    empty.className = '__outline_empty';
    empty.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
        <path d="M4 6h16M4 12h10M4 18h14"/>
      </svg>
      <span>未检测到标题结构</span>
    `;
    empty.style.display = headings.length === 0 ? 'flex' : 'none';

    // 组装
    sidebar.appendChild(handle);
    sidebar.appendChild(header);
    sidebar.appendChild(search);
    sidebar.appendChild(list);
    sidebar.appendChild(empty);

    document.body.appendChild(sidebar);

    // 绑定事件
    bindEvents(sidebar, headings);

    return sidebar;
  }

  // ── 滚动到目标标题 ──────────────────────────────
  function scrollToHeading(heading) {
    const rect = heading.element.getBoundingClientRect();
    const absoluteTop = rect.top + window.pageYOffset;
    window.scrollTo({
      top: absoluteTop - CONFIG.scrollOffset,
      behavior: 'smooth',
    });

    // 闪烁高亮效果
    heading.element.classList.add('__outline_flash');
    setTimeout(() => heading.element.classList.remove('__outline_flash'), 1200);
  }

  // ── 高亮当前可见标题 ──────────────────────────────
  function updateActiveHighlight(headings) {
    if (!headings.length) return;

    let activeIndex = 0;
    const scrollY = window.pageYOffset + CONFIG.scrollOffset + 40;

    for (let i = headings.length - 1; i >= 0; i--) {
      const rect = headings[i].element.getBoundingClientRect();
      const absoluteTop = rect.top + window.pageYOffset;
      if (scrollY >= absoluteTop) {
        activeIndex = i;
        break;
      }
    }

    // 更新 DOM
    const items = document.querySelectorAll('.__outline_item');
    items.forEach((item, i) => {
      item.classList.toggle('__outline_active', i === activeIndex);
    });

    // 滚动侧边栏使当前项可见
    const activeItem = items[activeIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ── 绑定事件 ──────────────────────────────────────
  function bindEvents(sidebar, headings) {
    const toggle = sidebar.querySelector('.__outline_toggle');
    const searchInput = sidebar.querySelector('.__outline_search_input');
    const list = sidebar.querySelector('.__outline_list');

    // 展开/收起
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = sidebar.classList.toggle('__outline_collapsed');
      toggle.title = isCollapsed ? '展开' : '收起';
      toggle.querySelector('svg').style.transform = isCollapsed
        ? 'rotate(0deg)'
        : 'rotate(180deg)';
    });

    // 点击手柄也能展开
    sidebar.querySelector('.__outline_handle').addEventListener('click', () => {
      sidebar.classList.remove('__outline_collapsed');
    });

    // 搜索过滤
    searchInput.addEventListener('input', () => {
      const keyword = searchInput.value.toLowerCase().trim();
      const items = list.querySelectorAll('.__outline_item');
      items.forEach((item) => {
        const text = item.querySelector('.__outline_item_text').textContent.toLowerCase();
        item.style.display = keyword && !text.includes(keyword) ? 'none' : '';
      });
    });

    // 滚动时高亮当前标题（防抖）
    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(
        () => updateActiveHighlight(headings),
        CONFIG.highlightDebounce
      );
    });

    // 初始高亮
    updateActiveHighlight(headings);
  }

  // ── 快捷键支持 ──────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Alt + O: 切换侧边栏显示
    if (e.altKey && e.key === 'o') {
      e.preventDefault();
      const sidebar = document.getElementById('__outline_sidebar');
      if (sidebar) {
        sidebar.classList.toggle('__outline_collapsed');
      }
    }
  });

  // ── 消息通信（与 popup 交互） ─────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'toggleSidebar') {
      const sidebar = document.getElementById('__outline_sidebar');
      if (sidebar) {
        sidebar.classList.toggle('__outline_collapsed');
      }
      sendResponse({ ok: true });
    }
    if (msg.action === 'refresh') {
      init();
      sendResponse({ ok: true });
    }
    if (msg.action === 'getStats') {
      const headings = collectHeadings();
      const maxD = headings.reduce((max, h) => Math.max(max, h.level), 0);
      sendResponse({ count: headings.length, maxDepth: maxD });
    }
    return true; // 异步响应
  });

  // ── 初始化 ──────────────────────────────────────
  function init() {
    const headings = collectHeadings();
    if (headings.length > 0) {
      createSidebar(headings);
    } else {
      // 没有标题时不显示侧边栏，但仍然监听后续 DOM 变化
      console.log('[Outline Navigator] 未检测到标题结构，等待页面加载…');
    }
  }

  // 等待页面加载完成
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // ── SPA / 动态内容监听 ───────────────────────────
  let lastUrl = location.href;
  let refreshTimer = null;

  function debouncedRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(init, 800);
  }

  const observer = new MutationObserver((mutations) => {
    // URL 变化（SPA 路由切换）
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(init, 500);
      return;
    }

    // AI 聊天页面：检测新增的对话节点
    const siteConfig = getSiteConfig();
    if (siteConfig && siteConfig.chatMode) {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          debouncedRefresh();
          break;
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
