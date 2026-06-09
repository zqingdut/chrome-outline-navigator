/* ===================================================
   Page Outline Navigator v3 — Content Script
   智能问答导航：折叠记忆 + 问答配对 + 快速跳转
   =================================================== */

(() => {
  'use strict';

  if (window.__outlineNavigatorLoaded) return;
  window.__outlineNavigatorLoaded = true;

  const CONFIG = {
    scrollOffset: 80,
    highlightDebounce: 150,
    refreshDebounce: 2000,
    minRefreshInterval: 3000,
    minTextLen: 2,
    truncLen: 55,
  };

  const collapseState = new Map();
  let lastContentHash = '';

  function trunc(s, n = CONFIG.truncLen) {
    s = s.replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function uid() { return '__ol_' + Math.random().toString(36).slice(2, 8); }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.height < 1 || r.width < 1) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function contentHash() {
    const main = document.querySelector('main, [role="main"], .chat-container, .chat-history, .conversation, article');
    const target = main || document.body;
    const text = target.innerText || '';
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 2000); i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  function isInChrome(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      const tag = cur.tagName;
      const role = cur.getAttribute('role');
      if (tag === 'NAV' || role === 'navigation') return true;
      if (tag === 'FOOTER' || role === 'contentinfo') return true;
      if (tag === 'HEADER' && cur.parentElement === document.body) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  /* ── 引擎1: 标准标题 ── */
  function detectHeadings() {
    const items = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
      const text = el.textContent.trim();
      if (text.length < CONFIG.minTextLen) return;
      if (!isVisible(el) || isInChrome(el)) return;
      if (!el.id) el.id = uid();
      items.push({ id: el.id, text: trunc(text), level: parseInt(el.tagName[1]) || 1, element: el, type: 'heading', children: [] });
    });
    return items;
  }

  /* ── 引擎2: 对话检测 ── */
  const Q_PAT = /user|human|question|提问|问题|right|msg-user|from-user|is-user|sender-user/i;
  const A_PAT = /assistant|ai|bot|answer|回答|回复|left|msg-ai|msg-bot|from-ai|is-ai|sender-ai/i;

  function guessRole(el) {
    for (const attr of el.attributes) {
      if (Q_PAT.test(attr.value)) return 'user';
      if (A_PAT.test(attr.value)) return 'assistant';
    }
    const cls = (el.className || '').toString();
    const id = el.id || '';
    if (Q_PAT.test(cls) || Q_PAT.test(id)) return 'user';
    if (A_PAT.test(cls) || A_PAT.test(id)) return 'assistant';
    const inner = el.querySelector('[class*="user"], [class*="human"], [class*="assistant"], [class*="bot"], [data-role], [data-author]');
    if (inner) {
      const ic = (inner.className || '').toString() + (inner.getAttribute('data-role') || '');
      if (Q_PAT.test(ic)) return 'user';
      if (A_PAT.test(ic)) return 'assistant';
    }
    const text = el.textContent.trim();
    if (/\?$|？$/.test(text) && text.length < 200) return 'user';
    if (text.length < 100 && !el.querySelector('p, ul, ol, pre, table, blockquote')) return 'user';
    return 'unknown';
  }

  function detectChatDialog() {
    const candidates = [];
    document.querySelectorAll('div, section, main').forEach(el => {
      const kids = Array.from(el.children).filter(k => {
        const r = k.getBoundingClientRect();
        return r.height >= 20 && !['SCRIPT','STYLE','SVG','CANVAS','BR','HR'].includes(k.tagName);
      });
      if (kids.length < 3 || kids.length > 200) return;
      const roles = kids.map(k => guessRole(k));
      if (roles.includes('user') && roles.includes('assistant')) {
        candidates.push({ container: el, children: kids });
      }
    });
    if (candidates.length === 0) return [];
    const best = candidates.sort((a, b) => b.children.length - a.children.length)[0];
    return buildPairedItems(best.children);
  }

  function buildPairedItems(children) {
    const items = [];
    let curQ = null;
    children.forEach(el => {
      if (!isVisible(el)) return;
      if (!el.id) el.id = uid();
      const role = guessRole(el);
      const text = extractText(el);
      if (!text) return;

      if (role === 'user') {
        curQ = { id: el.id, text: `💬 ${text}`, level: 1, element: el, type: 'question', children: [] };
        items.push(curQ);
      } else if (role === 'assistant') {
        const ans = { id: el.id, text: `🤖 ${text}`, level: 2, element: el, type: 'answer', children: [] };
        el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
          const ht = h.textContent.trim();
          if (ht.length < CONFIG.minTextLen) return;
          if (!h.id) h.id = uid();
          ans.children.push({ id: h.id, text: ht, level: parseInt(h.tagName[1]) + 1 || 3, element: h, type: 'heading', children: [] });
        });
        if (curQ) curQ.children.push(ans);
        else items.push(ans);
      } else {
        items.push({ id: el.id, text, level: 1, element: el, type: 'unknown', children: [] });
      }
    });
    return items;
  }

  function extractText(el) {
    const p = el.querySelector('p, .text, .content, [class*="text"], [class*="content"]');
    const text = (p || el).textContent.trim().replace(/\s+/g, ' ');
    return text.length < CONFIG.minTextLen ? null : trunc(text);
  }

  /* ── 引擎3: Q:/A: 模式 ── */
  function detectQAPatterns() {
    const items = [];
    const qaRe = /^(Q[:：]\s*|A[:：]\s*|问[:：]\s*|答[:：]\s*)/i;
    document.querySelectorAll('div, p, li, dt, dd, section, article, h1, h2, h3, h4, h5, h6').forEach(el => {
      const text = el.textContent.trim();
      if (!qaRe.test(text) || !isVisible(el) || isInChrome(el)) return;
      const childMatch = el.querySelector('div, p');
      if (childMatch && qaRe.test(childMatch.textContent.trim())) return;
      if (!el.id) el.id = uid();
      const isQ = /^Q[:：]|问[:：]/i.test(text);
      const clean = text.replace(qaRe, '').trim();
      if (clean.length < CONFIG.minTextLen) return;
      items.push({ id: el.id, text: isQ ? `💬 ${trunc(clean)}` : `🤖 ${trunc(clean)}`, level: 1, element: el, type: isQ ? 'question' : 'answer', children: [] });
    });
    return items;
  }

  /* ── 引擎4: 视觉标题 ── */
  function detectVisualHeadings() {
    const items = [];
    const bodySize = parseFloat(getComputedStyle(document.body).fontSize) || 16;
    document.querySelectorAll('p, div, span, strong, b').forEach(el => {
      const text = el.textContent.trim();
      if (text.length < CONFIG.minTextLen || text.length > 200) return;
      if (!isVisible(el) || isInChrome(el) || el.children.length > 3) return;
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      const weight = parseInt(style.fontWeight) || 400;
      if ((size > bodySize * 1.1 && weight >= 600) || size > bodySize * 1.4) {
        if (!el.id) el.id = uid();
        items.push({ id: el.id, text: trunc(text), level: size > bodySize * 1.4 ? 1 : 2, element: el, type: 'heading', children: [] });
      }
    });
    return items;
  }

  /* ── 主流程 ── */
  function collectAll() {
    const h = detectHeadings(), c = detectChatDialog(), q = detectQAPatterns(), v = detectVisualHeadings();
    if (h.length >= 3) return dedup(h);
    if (c.length >= 2) return dedup(merge(c, h));
    if (q.length >= 2) return dedup(merge(q, h));
    return dedup(merge(h, v));
  }

  function merge(...arrs) {
    const r = [], seen = new Set();
    for (const a of arrs) for (const i of a) { if (!seen.has(i.id)) { seen.add(i.id); r.push(i); } }
    return r;
  }

  function dedup(items) {
    const seen = new Set();
    return items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
  }

  function buildTree(items) {
    if (items.length > 0 && items[0].children !== undefined) return items;
    const tree = [], stack = [];
    items.forEach(item => {
      const node = { ...item, children: item.children || [] };
      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) stack.pop();
      if (stack.length === 0) tree.push(node);
      else stack[stack.length - 1].children.push(node);
      stack.push(node);
    });
    return tree;
  }

  /* ══════════════════════════════════════════════════
     侧边栏渲染
     ══════════════════════════════════════════════════ */
  function createSidebar(items) {
    const old = document.getElementById('__outline_sidebar');
    if (old) old.remove();
    const tree = buildTree(items);

    const sidebar = document.createElement('div');
    sidebar.id = '__outline_sidebar';
    sidebar.className = '__outline_sidebar __outline_collapsed';
    sidebar.innerHTML = `
      <div class="__outline_handle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </div>
      <div class="__outline_header">
        <div class="__outline_title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h14"/></svg>
          <span>页面大纲</span>
        </div>
        <div class="__outline_count">${items.length} 项</div>
        <div class="__outline_header_actions">
          <button class="__outline_scroll_btn" data-action="top" title="跳转顶部">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
          <button class="__outline_scroll_btn" data-action="bottom" title="跳转底部">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
          </button>
          <button class="__outline_toggle" title="收起侧边栏">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>
      </div>
      <div class="__outline_search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" placeholder="搜索标题…" class="__outline_search_input" />
      </div>
      <div class="__outline_list"></div>
      <div class="__outline_empty" style="display:${items.length === 0 ? 'flex' : 'none'}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M4 6h16M4 12h10M4 18h14"/></svg>
        <span>未检测到内容结构</span>
      </div>`;

    const list = sidebar.querySelector('.__outline_list');
    tree.forEach(node => renderTreeNode(list, node, 0));
    document.body.appendChild(sidebar);
    bindEvents(sidebar, items);
    // 延迟一帧确保 DOM 已渲染
    requestAnimationFrame(() => restoreCollapseState());
    return sidebar;
  }

  function renderTreeNode(parent, node, depth) {
    const hasKids = node.children && node.children.length > 0;
    const item = document.createElement('div');
    item.className = '__outline_node';
    item.dataset.nodeId = node.id;

    const row = document.createElement('div');
    row.className = `__outline_row __outline_level_${node.level}`;
    if (node.type === 'question') row.classList.add('__outline_question');
    if (node.type === 'answer') row.classList.add('__outline_answer');
    row.dataset.targetId = node.id;

    const indent = depth * 16;
    row.innerHTML = `
      <div class="__outline_indent" style="width:${indent}px"></div>
      ${hasKids ? `<button class="__outline_expand" title="展开/收起" data-expanded="true">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </button>` : `<div class="__outline_expand_placeholder"></div>`}
      <div class="__outline_marker __outline_marker_level_${node.level}"></div>
      <div class="__outline_text" title="${node.text}">${trunc(node.text, 45)}</div>
      <button class="__outline_action_btn __outline_copy_btn" title="复制内容">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="__outline_action_btn __outline_search_btn" title="搜索此内容">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </button>`;

    row.addEventListener('click', e => {
      if (e.target.closest('.__outline_expand') || e.target.closest('.__outline_search_btn')) return;
      e.preventDefault(); e.stopPropagation();
      scrollToItem(node);
    });

    const expandBtn = row.querySelector('.__outline_expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', e => {
        e.stopPropagation();
        const expanded = expandBtn.dataset.expanded === 'true';
        expandBtn.dataset.expanded = expanded ? 'false' : 'true';
        expandBtn.classList.toggle('__outline_collapsed_node', expanded);
        const cc = item.querySelector('.__outline_children');
        if (cc) cc.style.display = expanded ? 'none' : 'block';
        // 用元素的 outerHTML 前 100 字符作为稳定 key
        const stableKey = node.element.outerHTML.slice(0, 100);
        collapseState.set(stableKey, expanded);
      });
    }

    const searchBtn = row.querySelector('.__outline_search_btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', e => {
        e.stopPropagation();
        const searchText = node.text.replace(/^[💬🤖]\s*/, '');
        window.open(`https://www.google.com/search?q=${encodeURIComponent(searchText)}`, '_blank');
      });
    }

    // 复制按钮
    const copyBtn = row.querySelector('.__outline_copy_btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', e => {
        e.stopPropagation();
        const text = collectNodeText(node);
        copyToClipboard(text, copyBtn);
      });
    }

    item.appendChild(row);

    if (hasKids) {
      const cc = document.createElement('div');
      cc.className = '__outline_children';
      node.children.forEach(child => renderTreeNode(cc, child, depth + 1));
      item.appendChild(cc);
    }
    parent.appendChild(item);
  }

  function restoreCollapseState() {
    if (collapseState.size === 0) return;
    document.querySelectorAll('.__outline_node').forEach(node => {
      const targetId = node.querySelector('.__outline_row')?.dataset.targetId;
      if (!targetId) return;
      const el = document.getElementById(targetId);
      if (!el) return;
      const stableKey = el.outerHTML.slice(0, 100);
      if (!collapseState.has(stableKey)) return;
      const isCollapsed = collapseState.get(stableKey);
      if (!isCollapsed) return;
      const btn = node.querySelector('.__outline_expand');
      const cc = node.querySelector('.__outline_children');
      if (btn && cc) {
        btn.dataset.expanded = 'false';
        btn.classList.add('__outline_collapsed_node');
        cc.style.display = 'none';
      }
    });
  }

  /* ── 收集节点及子节点的文本 ── */
  function collectNodeText(node) {
    const parts = [];
    // 收集当前元素的文本
    const elText = node.element.innerText || node.element.textContent || '';
    parts.push(stripMarkdown(elText.trim()));

    // 递归收集子节点
    if (node.children) {
      node.children.forEach(child => {
        parts.push(collectNodeText(child));
      });
    }
    return parts.filter(p => p.length > 0).join('\n');
  }

  /* ── 过滤 Markdown 标记 ── */
  function stripMarkdown(text) {
    return text
      .replace(/^#{1,6}\s+/gm, '')      // 标题 #
      .replace(/\*\*(.+?)\*\*/g, '') // 粗体 **text**
      .replace(/\*(.+?)\*/g, '')      // 斜体 *text*
      .replace(/__(.+?)__/g, '')        // 粗体 __text__
      .replace(/_(.+?)_/g, '')          // 斜体 _text_
      .replace(/~~(.+?)~~/g, '')        // 删除线
      .replace(/`{3}[\s\S]*?`{3}/g, m => { // 代码块
        return m.replace(/^`{3}\w*\n?/, '').replace(/`{3}$/, '');
      })
      .replace(/`(.+?)`/g, '')        // 行内代码
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '') // 链接 [text](url)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // 图片 ![alt](url)
      .replace(/^>\s+/gm, '')             // 引用 >
      .replace(/^[-*+]\s+/gm, '• ')      // 无序列表
      .replace(/^\d+\.\s+/gm, m => m)   // 有序列表保留
      .replace(/^---+$/gm, '')             // 分割线
      .replace(/\n{3,}/g, '\n\n')       // 多余空行
      .trim();
  }

  /* ── 复制到剪贴板 ── */
  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      // 显示成功反馈
      const origHTML = btn.innerHTML;
      btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
      btn.style.opacity = '1';
      setTimeout(() => {
        btn.innerHTML = origHTML;
        btn.style.opacity = '';
      }, 1500);
    }).catch(() => {
      // fallback: 用 textarea 复制
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const origHTML = btn.innerHTML;
      btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
      btn.style.opacity = '1';
      setTimeout(() => {
        btn.innerHTML = origHTML;
        btn.style.opacity = '';
      }, 1500);
    });
  }

  /* ── 滚动控制 ── */
  function scrollToItem(item) {
    item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.element.classList.add('__outline_flash');
    setTimeout(() => item.element.classList.remove('__outline_flash'), 1200);
  }

  function findScrollParent(el) {
    let cur = el?.parentElement;
    while (cur && cur !== document.body) {
      const style = getComputedStyle(cur);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight + 5) return cur;
      cur = cur.parentElement;
    }
    return window;
  }

  function scrollToTop() {
    const rows = document.querySelectorAll('.__outline_row');
    if (rows.length) {
      const el = document.getElementById(rows[0].dataset.targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function scrollToBottom() {
    const rows = document.querySelectorAll('.__outline_row');
    if (rows.length) {
      const el = document.getElementById(rows[rows.length - 1].dataset.targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  function updateHighlight(items) {
    if (!items.length) return;
    const scrollContainer = items[0] ? findScrollParent(items[0].element) : window;
    const scrollTop = scrollContainer === window ? window.pageYOffset : scrollContainer.scrollTop;
    const offset = CONFIG.scrollOffset + 40;
    let active = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const r = items[i].element.getBoundingClientRect();
      const elementTop = scrollContainer === window ? r.top + window.pageYOffset : r.top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop;
      if (elementTop <= scrollTop + offset) { active = i; break; }
    }
    document.querySelectorAll('.__outline_row').forEach((el, i) => el.classList.toggle('__outline_active', i === active));
    const a = document.querySelectorAll('.__outline_row')[active];
    if (a) a.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ── 事件绑定 ── */
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

    sidebar.querySelector('.__outline_handle').addEventListener('click', () => sidebar.classList.remove('__outline_collapsed'));

    sidebar.querySelectorAll('.__outline_scroll_btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.action === 'top') scrollToTop();
        if (btn.dataset.action === 'bottom') scrollToBottom();
      });
    });

    search.addEventListener('input', () => {
      const kw = search.value.toLowerCase().trim();
      list.querySelectorAll('.__outline_node').forEach(node => {
        const text = node.querySelector('.__outline_text')?.textContent.toLowerCase() || '';
        node.style.display = (!kw || text.includes(kw)) ? '' : 'none';
      });
    });

    let timer = null;
    const onScroll = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => updateHighlight(items), CONFIG.highlightDebounce); };
    window.addEventListener('scroll', onScroll, { passive: true });
    if (items[0]) { const sp = findScrollParent(items[0].element); if (sp !== window) sp.addEventListener('scroll', onScroll, { passive: true }); }
    updateHighlight(items);
  }

  document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'o') {
      e.preventDefault();
      const sb = document.getElementById('__outline_sidebar');
      if (sb) sb.classList.toggle('__outline_collapsed');
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'toggleSidebar') { const sb = document.getElementById('__outline_sidebar'); if (sb) sb.classList.toggle('__outline_collapsed'); sendResponse({ ok: true }); }
    if (msg.action === 'refresh') { init(); sendResponse({ ok: true }); }
    if (msg.action === 'getStats') { const items = collectAll(); sendResponse({ count: items.length, maxDepth: items.reduce((m, h) => Math.max(m, h.level), 0) }); }
    return true;
  });

  /* ── 初始化 + 智能刷新 ── */
  function init() {
    const items = collectAll();
    const hash = contentHash();
    // 内容没变就不重建侧边栏（但折叠状态已通过 collapseState 保持）
    if (hash === lastContentHash) return;
    lastContentHash = hash;

    const existing = document.getElementById('__outline_sidebar');
    const wasCollapsed = existing ? existing.classList.contains('__outline_collapsed') : true;

    createSidebar(items);

    if (!wasCollapsed) {
      const sb = document.getElementById('__outline_sidebar');
      if (sb) sb.classList.remove('__outline_collapsed');
    }
    console.log(`[Outline Navigator] 检测到 ${items.length} 个导航项`);
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  let lastUrl = location.href;
  let refreshTimer = null;
  function debouncedRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    // 用较短的防抖，让对话切换能及时响应
    refreshTimer = setTimeout(init, 800);
  }

  const observer = new MutationObserver(mutations => {
    if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(init, 500); return; }
    for (const m of mutations) {
      if (m.target.id === '__outline_sidebar' || m.target.closest?.('#__outline_sidebar')) continue;
      if (m.addedNodes.length > 0) {
        const isSidebar = Array.from(m.addedNodes).some(n => n.id === '__outline_sidebar');
        if (isSidebar) continue;
        debouncedRefresh();
        break;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
