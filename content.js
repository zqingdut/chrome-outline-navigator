/* ===================================================
   Page Outline Navigator v2 — Content Script
   通用智能检测：不依赖域名列表，自动识别任意页面的
   标题结构和问答对话
   =================================================== */

(() => {
  'use strict';

  if (window.__outlineNavigatorLoaded) return;
  window.__outlineNavigatorLoaded = true;

  // ── 配置 ──────────────────────────────────────────
  const CONFIG = {
    scrollOffset: 80,
    highlightDebounce: 100,
    minTextLen: 2,
    // 问答检测：文本行最大取前 N 个字符
    truncLen: 55,
  };

  // ── 工具函数 ─────────────────────────────────────
  function trunc(s, n = CONFIG.truncLen) {
    s = s.replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function uid() {
    return '__ol_' + Math.random().toString(36).slice(2, 8);
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.height < 1 || r.width < 1) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  // ══════════════════════════════════════════════════
  //  检测引擎 1：标准标题 (h1-h6)
  // ══════════════════════════════════════════════════
  function detectHeadings() {
    const all = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const items = [];
    all.forEach(el => {
      const text = el.textContent.trim();
      if (text.length < CONFIG.minTextLen) return;
      if (!isVisible(el)) return;
      // 排除隐藏在导航/header/footer 里的标题
      if (isInChrome(el)) return;
      if (!el.id) el.id = uid();
      const level = parseInt(el.tagName[1]) || 1;
      items.push({ id: el.id, text: trunc(text), level, element: el, type: 'heading' });
    });
    return items;
  }

  // 排除网站导航、侧边栏、footer 等非内容区域
  function isInChrome(el) {
    const chromeTags = new Set(['NAV', 'HEADER', 'FOOTER', 'ASIDE']);
    let cur = el;
    while (cur && cur !== document.body) {
      const tag = cur.tagName;
      const role = cur.getAttribute('role');
      const cls = (cur.className || '').toString().toLowerCase();
      // 排除导航类元素（但不排除主内容区的 aside）
      if (tag === 'NAV' || role === 'navigation') return true;
      if (tag === 'FOOTER' || role === 'contentinfo') return true;
      // 排除明显的 header（但不排除文章内的 header）
      if (tag === 'HEADER' && cur.parentElement === document.body) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  // ══════════════════════════════════════════════════
  //  检测引擎 2：通用问答对话检测
  //  不依赖域名，通过 DOM 结构 + 内容分析识别
  // ══════════════════════════════════════════════════

  // 问答角色关键词（用于 class/id/data 属性匹配）
  const Q_PATTERNS = /user|human|question|提问|问题|q-msg|msg-user|chat-user|from-user|is-user|role-user|sender-user|author-user|human-turn|user-turn|user-message|right/i;
  const A_PATTERNS = /assistant|ai|bot|answer|回答|回复|a-msg|msg-ai|msg-bot|chat-bot|chat-ai|from-ai|from-bot|is-ai|is-bot|role-assistant|role-ai|sender-ai|author-ai|ai-turn|bot-turn|assistant-message|ai-message|bot-message|left/i;

  function detectChatDialog() {
    // Step 1: 找到页面中重复出现的对话容器
    const chatContainers = findChatContainers();
    if (chatContainers.length === 0) return [];

    // 取最可能的容器（子元素最多的）
    const best = chatContainers.sort((a, b) => b.children.length - a.children.length)[0];
    const messages = extractMessages(best.container, best.children);
    return messages;
  }

  // 查找可能的聊天容器
  function findChatContainers() {
    const candidates = [];

    // 通用策略：找所有 div，其中子元素 ≥ 4 且包含两种角色
    document.querySelectorAll('div, section, main').forEach(el => {
      const kids = Array.from(el.children).filter(k => {
        const r = k.getBoundingClientRect();
        if (r.height < 20) return false;
        if (['SCRIPT', 'STYLE', 'SVG', 'CANVAS', 'BR', 'HR'].includes(k.tagName)) return false;
        // 排除标题、段落等非消息元素
        if (['H1', 'H2', 'H3', 'P'].includes(k.tagName) && !k.className) return false;
        return true;
      });

      if (kids.length < 3 || kids.length > 200) return;

      // 检查子元素是否包含两种角色
      const roles = kids.map(k => guessRole(k));
      const hasBoth = roles.includes('user') && roles.includes('assistant');
      if (hasBoth) {
        candidates.push({ container: el, children: kids });
      }
    });

    return candidates;
  }

  // 从容器中提取消息
  function guessRole(el) {
    // 检查 data 属性
    for (const attr of el.attributes) {
      const val = attr.value;
      if (Q_PATTERNS.test(val)) return 'user';
      if (A_PATTERNS.test(val)) return 'assistant';
    }
    // 检查 class 和 id
    const cls = (el.className || '').toString();
    const id = el.id || '';
    if (Q_PATTERNS.test(cls) || Q_PATTERNS.test(id)) return 'user';
    if (A_PATTERNS.test(cls) || A_PATTERNS.test(id)) return 'assistant';

    // 检查子元素的 data/class
    const inner = el.querySelector('[class*="user"], [class*="human"], [class*="assistant"], [class*="bot"], [class*="ai"], [data-role], [data-author]');
    if (inner) {
      const ic = (inner.className || '').toString() + (inner.getAttribute('data-role') || '') + (inner.getAttribute('data-author') || '');
      if (Q_PATTERNS.test(ic)) return 'user';
      if (A_PATTERNS.test(ic)) return 'assistant';
    }

    // 检查内容特征
    const text = el.textContent.trim();
    // 问号结尾 → 很可能是问题
    if (/\?$|？$/.test(text) && text.length < 200) return 'user';
    // 短文本 + 没有 markdown 结构 → 可能是问题
    if (text.length < 100 && !el.querySelector('p, ul, ol, pre, table, blockquote')) return 'user';

    return 'unknown';
  }

  // 从容器中提取消息
  function extractMessages(container, children) {
    const items = [];

    children.forEach((el, i) => {
      if (!isVisible(el)) return;
      if (!el.id) el.id = uid();

      const role = guessRole(el);
      const text = extractMeaningfulText(el);
      if (!text) return;

      // 尝试从回答中提取子标题
      const subHeadings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');

      if (role === 'user') {
        items.push({
          id: el.id,
          text: `💬 ${text}`,
          level: 1,
          element: el,
          type: 'question',
        });
      } else if (role === 'assistant') {
        // 先加回答块本身的标记
        items.push({
          id: el.id,
          text: `🤖 ${text}`,
          level: 1,
          element: el,
          type: 'answer',
        });
        // 再加回答里的子标题
        subHeadings.forEach((h, j) => {
          const ht = h.textContent.trim();
          if (ht.length < CONFIG.minTextLen) return;
          if (!h.id) h.id = uid();
          items.push({
            id: h.id,
            text: ht,
            level: parseInt(h.tagName[1]) || 2,
            element: h,
            type: 'heading',
          });
        });
      } else {
        // unknown 角色 — 根据位置交替猜测
        const isQ = i % 2 === 0; // 偶数位置假设为提问
        items.push({
          id: el.id,
          text: isQ ? `💬 ${text}` : `🤖 ${text}`,
          level: 1,
          element: el,
          type: isQ ? 'question' : 'answer',
        });
      }
    });

    return items;
  }

  // 提取有意义的文本
  function extractMeaningfulText(el) {
    // 优先取第一段
    const p = el.querySelector('p, .text, .content, [class*="text"], [class*="content"]');
    const text = (p || el).textContent.trim().replace(/\s+/g, ' ');
    if (text.length < CONFIG.minTextLen) return null;
    return trunc(text);
  }

  // ══════════════════════════════════════════════════
  //  检测引擎 3：页面内问答模式（非对话式，而是
  //  Q:/A: 或 问:/答: 这类结构化问答）
  // ══════════════════════════════════════════════════
  function detectQAPatterns() {
    const items = [];
    const qaRegex = /^(Q[:：]\s*|A[:：]\s*|问[:：]\s*|答[:：]\s*|Question[:：]?\s*|Answer[:：]?\s*)/i;

    // 只查叶子节点或接近叶子的元素，避免父子重复匹配
    document.querySelectorAll('div, p, li, dt, dd, section, article, h1, h2, h3, h4, h5, h6').forEach(el => {
      const text = el.textContent.trim();
      if (!qaRegex.test(text)) return;
      if (!isVisible(el)) return;
      if (isInChrome(el)) return;
      // 跳过包含子 div 也匹配的父元素（避免重复）
      const childMatch = el.querySelector('div, p');
      if (childMatch && qaRegex.test(childMatch.textContent.trim())) return;
      if (!el.id) el.id = uid();

      const isQ = /^(Q[:：]|问[:：]|Question)/i.test(text);
      const clean = text.replace(qaRegex, '').trim();
      if (clean.length < CONFIG.minTextLen) return;

      items.push({
        id: el.id,
        text: isQ ? `💬 ${trunc(clean)}` : `🤖 ${trunc(clean)}`,
        level: 1,
        element: el,
        type: isQ ? 'question' : 'answer',
      });
    });

    return items;
  }

  // ══════════════════════════════════════════════════
  //  检测引擎 4：降级方案 — 找页面中的"视觉标题"
  //  比 h1-h6 更大的文字、加粗的独立段落等
  // ══════════════════════════════════════════════════
  function detectVisualHeadings() {
    const items = [];
    // 获取页面正文字体大小基准
    const bodySize = parseFloat(getComputedStyle(document.body).fontSize) || 16;

    document.querySelectorAll('p, div, span, strong, b').forEach(el => {
      const text = el.textContent.trim();
      if (text.length < CONFIG.minTextLen || text.length > 200) return;
      if (!isVisible(el)) return;
      if (isInChrome(el)) return;
      // 只看叶子节点或接近叶子的
      if (el.children.length > 3) return;

      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      const weight = parseInt(style.fontWeight) || 400;

      // 判定条件：字号明显大于正文 且 加粗
      const isBigBold = size > bodySize * 1.1 && weight >= 600;
      // 或者字号非常大
      const isVeryBig = size > bodySize * 1.4;

      if (isBigBold || isVeryBig) {
        if (!el.id) el.id = uid();
        items.push({
          id: el.id,
          text: trunc(text),
          level: isVeryBig ? 1 : 2,
          element: el,
          type: 'heading',
        });
      }
    });

    return items;
  }

  // ══════════════════════════════════════════════════
  //  主检测流程：多引擎融合，去重排序
  // ══════════════════════════════════════════════════
  function collectAll() {
    // 并行运行所有检测引擎
    const headings = detectHeadings();         // 标准标题
    const chat = detectChatDialog();           // 对话检测
    const qaPatterns = detectQAPatterns();     // Q:/A: 模式
    const visual = detectVisualHeadings();     // 视觉标题

    // 如果标准标题够多（≥ 3），优先用标准标题
    if (headings.length >= 3) {
      return deduplicate(headings);
    }

    // 如果检测到对话，优先用对话
    if (chat.length >= 2) {
      // 合并对话 + 标题
      const merged = mergeResults(chat, headings);
      return deduplicate(merged);
    }

    // 如果检测到 Q:/A: 模式
    if (qaPatterns.length >= 2) {
      const merged = mergeResults(qaPatterns, headings);
      return deduplicate(merged);
    }

    // 标准标题 + 视觉标题合并
    const merged = mergeResults(headings, visual);
    return deduplicate(merged);
  }

  // 合并多个引擎的结果
  function mergeResults(...arrays) {
    const result = [];
    const seen = new Set();
    for (const arr of arrays) {
      for (const item of arr) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          result.push(item);
        }
      }
    }
    return result;
  }

  // 去重（基于元素 ID 和位置）
  function deduplicate(items) {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  // ══════════════════════════════════════════════════
  //  侧边栏渲染
  // ══════════════════════════════════════════════════
  function createSidebar(items) {
    const old = document.getElementById('__outline_sidebar');
    if (old) old.remove();

    const sidebar = document.createElement('div');
    sidebar.id = '__outline_sidebar';
    sidebar.className = '__outline_sidebar __outline_collapsed';

    sidebar.innerHTML = `
      <div class="__outline_handle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12h18M3 6h18M3 18h18"/>
        </svg>
      </div>
      <div class="__outline_header">
        <div class="__outline_title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h10M4 18h14"/>
          </svg>
          <span>页面大纲</span>
        </div>
        <div class="__outline_count">${items.length} 项</div>
        <button class="__outline_toggle" title="收起">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      </div>
      <div class="__outline_search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input type="text" placeholder="搜索标题…" class="__outline_search_input" />
      </div>
      <div class="__outline_list"></div>
      <div class="__outline_empty" style="display:${items.length === 0 ? 'flex' : 'none'}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
          <path d="M4 6h16M4 12h10M4 18h14"/>
        </svg>
        <span>未检测到内容结构</span>
      </div>
    `;

    const list = sidebar.querySelector('.__outline_list');
    items.forEach((h, i) => {
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
        <div class="__outline_item_text" title="${h.text}">${trunc(h.text)}</div>
      `;

      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToItem(h);
      });

      list.appendChild(item);
    });

    document.body.appendChild(sidebar);
    bindEvents(sidebar, items);
    return sidebar;
  }

  // ── 滚动跳转 ──────────────────────────────────────
  function scrollToItem(item) {
    const rect = item.element.getBoundingClientRect();
    const absTop = rect.top + window.pageYOffset;
    window.scrollTo({ top: absTop - CONFIG.scrollOffset, behavior: 'smooth' });
    item.element.classList.add('__outline_flash');
    setTimeout(() => item.element.classList.remove('__outline_flash'), 1200);
  }

  // ── 滚动高亮 ──────────────────────────────────────
  function updateHighlight(items) {
    if (!items.length) return;
    let active = 0;
    const scrollY = window.pageYOffset + CONFIG.scrollOffset + 40;
    for (let i = items.length - 1; i >= 0; i--) {
      const r = items[i].element.getBoundingClientRect();
      if (r.top + window.pageYOffset <= scrollY) { active = i; break; }
    }
    document.querySelectorAll('.__outline_item').forEach((el, i) => {
      el.classList.toggle('__outline_active', i === active);
    });
    const a = document.querySelectorAll('.__outline_item')[active];
    if (a) a.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ── 事件绑定 ──────────────────────────────────────
  function bindEvents(sidebar, items) {
    const toggle = sidebar.querySelector('.__outline_toggle');
    const search = sidebar.querySelector('.__outline_search_input');
    const list = sidebar.querySelector('.__outline_list');

    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const c = sidebar.classList.toggle('__outline_collapsed');
      toggle.title = c ? '展开' : '收起';
      toggle.querySelector('svg').style.transform = c ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    sidebar.querySelector('.__outline_handle').addEventListener('click', () => {
      sidebar.classList.remove('__outline_collapsed');
    });

    search.addEventListener('input', () => {
      const kw = search.value.toLowerCase().trim();
      list.querySelectorAll('.__outline_item').forEach(item => {
        const t = item.querySelector('.__outline_item_text').textContent.toLowerCase();
        item.style.display = kw && !t.includes(kw) ? 'none' : '';
      });
    });

    let timer = null;
    window.addEventListener('scroll', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => updateHighlight(items), CONFIG.highlightDebounce);
    });
    updateHighlight(items);
  }

  // ── 快捷键 ──────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'o') {
      e.preventDefault();
      const sb = document.getElementById('__outline_sidebar');
      if (sb) sb.classList.toggle('__outline_collapsed');
    }
  });

  // ── 消息通信 ──────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'toggleSidebar') {
      const sb = document.getElementById('__outline_sidebar');
      if (sb) sb.classList.toggle('__outline_collapsed');
      sendResponse({ ok: true });
    }
    if (msg.action === 'refresh') {
      init();
      sendResponse({ ok: true });
    }
    if (msg.action === 'getStats') {
      const items = collectAll();
      const maxD = items.reduce((m, h) => Math.max(m, h.level), 0);
      sendResponse({ count: items.length, maxDepth: maxD });
    }
    return true;
  });

  // ── 初始化 ──────────────────────────────────────
  function init() {
    const items = collectAll();
    const existing = document.getElementById('__outline_sidebar');
    // 保留用户当前的展开/收起状态
    const wasCollapsed = existing ? existing.classList.contains('__outline_collapsed') : true;
    createSidebar(items);
    // 恢复状态
    if (!wasCollapsed) {
      const sb = document.getElementById('__outline_sidebar');
      if (sb) sb.classList.remove('__outline_collapsed');
    }
    console.log(`[Outline Navigator] 检测到 ${items.length} 个导航项`);
  }

  // 等页面加载
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // ── 动态内容监听 ────────────────────────────────
  let lastUrl = location.href;
  let refreshTimer = null;

  function debouncedRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(init, 800);
  }

  const observer = new MutationObserver(mutations => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(init, 500);
      return;
    }
    // 检测新增的内容节点（排除侧边栏自身的变动）
    for (const m of mutations) {
      // 跳过侧边栏内部的变化
      if (m.target.id === '__outline_sidebar' || m.target.closest?.('__outline_sidebar')) continue;
      if (m.addedNodes.length > 0) {
        // 确认新增的不是侧边栏自身
        const isSidebar = Array.from(m.addedNodes).some(n =>
          n.id === '__outline_sidebar' || n.nodeType !== 1
        );
        if (isSidebar) continue;
        debouncedRefresh();
        break;
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
