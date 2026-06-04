// Page Outline Navigator — Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggleSidebar');
  const refreshBtn = document.getElementById('refreshOutline');
  const headingCount = document.getElementById('headingCount');
  const maxDepth = document.getElementById('maxDepth');
  const toggleText = document.getElementById('toggleText');

  // 获取当前活跃标签页
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // 向 content script 发送消息
  async function sendMessage(action) {
    const tab = await getActiveTab();
    if (!tab) return;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action });
      return response;
    } catch (e) {
      console.log('Content script not ready:', e);
    }
  }

  // 更新统计信息
  async function updateStats() {
    const tab = await getActiveTab();
    if (!tab) return;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
      if (response) {
        headingCount.textContent = response.count ?? '—';
        maxDepth.textContent = response.maxDepth ? `H${response.maxDepth}` : '—';
      }
    } catch (e) {
      headingCount.textContent = '—';
      maxDepth.textContent = '—';
    }
  }

  // 切换侧边栏
  toggleBtn.addEventListener('click', async () => {
    await sendMessage('toggleSidebar');
    window.close();
  });

  // 刷新大纲
  refreshBtn.addEventListener('click', async () => {
    await sendMessage('refresh');
    await updateStats();
    refreshBtn.style.background = 'rgba(100, 200, 160, 0.15)';
    setTimeout(() => {
      refreshBtn.style.background = '';
    }, 500);
  });

  // 初始化统计
  await updateStats();
});
