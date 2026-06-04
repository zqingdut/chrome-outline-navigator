/* ── 自动化测试脚本 ── */
const tests = [
  { name: '场景1: 第三方 AI 对话 (data-sender)', file: 'test-page-1.html', expectQ: 3, expectA: 3 },
  { name: '场景2: 非标准 AI 站 (class left/right)', file: 'test-page-2.html', expectQ: 3, expectA: 3 },
  { name: '场景3: 结构化 Q:/A: 模式', file: 'test-page-3.html', expectQ: 5, expectA: 5 },
  { name: '场景4: 视觉标题 (无 h 标签)', file: 'test-page-4.html', expectQ: 0, expectA: 0, expectH: 6 },
];

// 简化版检测引擎（从 content.js 提取核心逻辑）
const Q_PATTERNS = /user|human|question|提问|问题|q-msg|msg-user|chat-user|from-user|is-user|role-user|sender-user|author-user|human-turn|user-turn|user-message/i;
const A_PATTERNS = /assistant|ai|bot|answer|回答|回复|a-msg|msg-ai|msg-bot|chat-bot|chat-ai|from-ai|from-bot|is-ai|is-bot|role-assistant|role-ai|sender-ai|author-ai|ai-turn|bot-turn|assistant-message|ai-message|bot-message/i;

function guessRole(el) {
  for (const attr of el.attributes) {
    if (Q_PATTERNS.test(attr.value)) return 'user';
    if (A_PATTERNS.test(attr.value)) return 'assistant';
  }
  const cls = (el.className || '').toString();
  const id = el.id || '';
  if (Q_PATTERNS.test(cls) || Q_PATTERNS.test(id)) return 'user';
  if (A_PATTERNS.test(cls) || A_PATTERNS.test(id)) return 'assistant';
  const inner = el.querySelector('[class*="user"], [class*="human"], [class*="assistant"], [class*="bot"], [data-role], [data-author]');
  if (inner) {
    const ic = (inner.className || '').toString() + (inner.getAttribute('data-role') || '');
    if (Q_PATTERNS.test(ic)) return 'user';
    if (A_PATTERNS.test(ic)) return 'assistant';
  }
  const text = el.textContent.trim();
  if (/\?$|？$/.test(text) && text.length < 200) return 'user';
  if (text.length < 100 && !el.querySelector('p, ul, ol, pre, table')) return 'user';
  return 'unknown';
}

function testDetect(doc) {
  const results = { questions: 0, answers: 0, headings: 0, items: [] };

  // 引擎1: 标准标题
  doc.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
    const t = el.textContent.trim();
    if (t.length >= 2) {
      results.headings++;
      results.items.push({ type: 'heading', text: t.slice(0, 40), level: el.tagName });
    }
  });

  // 引擎2: 对话检测 — 找重复结构容器
  const containers = [];
  doc.querySelectorAll('div, section').forEach(el => {
    const kids = Array.from(el.children).filter(k => {
      const r = k.getBoundingClientRect();
      return r.height > 20 && !['SCRIPT','STYLE','SVG'].includes(k.tagName);
    });
    // 按 class 分组找最大同构组
    const groups = {};
    kids.forEach(k => { const key = k.className || k.tagName; (groups[key] = groups[key] || []).push(k); });
    let best = [];
    for (const g of Object.values(groups)) { if (g.length > best.length) best = g; }
    if (best.length >= 2) {
      const roles = best.map(k => guessRole(k));
      if (roles.includes('user') && roles.includes('assistant')) {
        containers.push({ el, children: best });
      }
    }
  });

  if (containers.length > 0) {
    const best = containers.sort((a, b) => b.children.length - a.children.length)[0];
    best.children.forEach(child => {
      const role = guessRole(child);
      const text = child.textContent.trim().replace(/\s+/g, ' ').slice(0, 50);
      if (role === 'user') {
        results.questions++;
        results.items.push({ type: 'question', text: `💬 ${text}` });
      } else if (role === 'assistant') {
        results.answers++;
        results.items.push({ type: 'answer', text: `🤖 ${text}` });
        // 子标题
        child.querySelectorAll('h1,h2,h3,h4').forEach(h => {
          results.headings++;
          results.items.push({ type: 'sub-heading', text: h.textContent.trim().slice(0, 40) });
        });
      }
    });
  }

  // 引擎3: Q:/A: 模式
  const qaRegex = /^(Q[:：]\s*|A[:：]\s*|问[:：]\s*|答[:：]\s*)/i;
  doc.querySelectorAll('div, p, li').forEach(el => {
    const text = el.textContent.trim();
    if (qaRegex.test(text)) {
      const isQ = /^Q[:：]|问[:：]/i.test(text);
      if (isQ) results.questions++;
      else results.answers++;
      results.items.push({ type: isQ ? 'question' : 'answer', text: text.slice(0, 50) });
    }
  });

  return results;
}
