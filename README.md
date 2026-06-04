# 📑 Page Outline Navigator

> 智能页面大纲导航 Chrome 插件 — 自动识别网页标题结构，生成右侧浮动导航大纲，专为 AI 问答页面优化。

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ 功能特性

### 🤖 AI 问答平台深度适配

| 平台 | 域名 | 适配方式 |
|------|------|----------|
| ChatGPT | `chatgpt.com` / `chat.openai.com` | 用户提问 💬 + AI 回答标题 🤖 |
| Claude | `claude.ai` | 问答轮次 + 回答内 Markdown 标题 |
| DeepSeek | `chat.deepseek.com` | 问答轮次 + Markdown 标题 |
| Kimi | `kimi.moonshot.cn` | 问答轮次 + Markdown 标题 |
| 通义千问 | `tongyi.aliyun.com` | 问答轮次 + Markdown 标题 |
| 文心一言 | `yiyan.baidu.com` | 问答轮次 + Markdown 标题 |
| 豆包 | `doubao.com` | 问答轮次 + Markdown 标题 |
| Perplexity | `perplexity.ai` | 结构化回答标题 |

### 🌐 通用网站支持

知乎、Stack Overflow、SegmentFault、CSDN、掘金、简书、Medium、GitHub、Notion、微信公众号、博客园、HuggingFace、Cursor 等。

其他未适配网站自动走通用 h1-h6 标题识别。

### 🎯 核心能力

- **智能问答识别** — ChatMode 自动提取用户提问和 AI 回答，💬/🤖 图标区分
- **实时高亮追踪** — 滚动时自动高亮当前章节对应的大纲项
- **搜索过滤** — 内置搜索框，快速定位目标标题
- **动态刷新** — AI 对话新增内容时自动更新大纲（800ms 防抖）
- **快捷键** — `Alt + O` 一键切换侧边栏
- **深色主题** — 渐变深蓝背景，蓝绿高亮色系，护眼不刺眼
- **平滑动画** — 点击跳转使用 smooth scroll + 闪烁高亮效果

## 🚀 安装使用

### 开发者模式安装（推荐）

1. 下载或克隆本仓库到本地
2. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
3. 开启右上角 **「开发者模式」**
4. 点击 **「加载已解压的扩展程序」**
5. 选择本项目目录（包含 `manifest.json` 的文件夹）
6. 打开任意网页，右侧自动出现导航大纲

### 使用方式

- **自动激活** — 打开任何包含标题结构的网页，右侧自动显示大纲
- **点击跳转** — 点击大纲中的任意标题，页面平滑滚动到对应位置
- **搜索过滤** — 在搜索框输入关键词，实时过滤标题列表
- **收起/展开** — 点击侧边栏左上角箭头收起，点击手柄展开
- **快捷键** — 按 `Alt + O` 快速切换显示/隐藏

## 🏗️ 项目结构

```
chrome-outline-navigator/
├── manifest.json          # Chrome Extension Manifest V3 配置
├── content.js             # 内容脚本 — 标题检测、大纲生成、滚动追踪
├── content.css            # 侧边栏样式 — 深色主题、动画、响应式
├── popup.html             # 扩展弹窗页面
├── popup.js               # 弹窗逻辑 — 统计信息、刷新、切换
├── popup.css              # 弹窗样式
├── preview.html           # 效果预览页面（浏览器直接打开）
├── flowchart.html         # 实现流程图（浏览器直接打开）
├── icons/
│   ├── icon.svg           # 源图标
│   ├── icon16.png         # 16x16 扩展图标
│   ├── icon48.png         # 48x48 扩展图标
│   └── icon128.png        # 128x128 扩展图标
├── LICENSE                # MIT 许可证
└── README.md              # 本文件
```

## 🔧 技术实现

### 工作原理

```
页面加载 → 读取域名 → 匹配站点配置表
         ├─ AI 聊天平台 → 专用选择器 + ChatMode
         └─ 通用网站 → h1-h6 通用识别
                        ↓
              为元素分配唯一 ID
                        ↓
              渲染右侧浮动侧边栏
                        ↓
         滚动追踪 (反向遍历定位) + 点击跳转 (smooth scroll)
                        ↓
              MutationObserver 动态监听 → 自动刷新
```

### ChatMode 三步提取策略

当 AI 聊天页面标题不足 2 个时，自动进入 ChatMode：

1. **Step 1** — `questionSelector` 提取用户提问文本（前 50 字，💬 前缀）
2. **Step 2** — `answerSelector` 提取 AI 回答中的 h1-h4 子标题
3. **Step 3** — `turnSelector` 兜底：遍历每条消息，取首句，末尾是 `？` → 提问，否则 → 回答

### 位置索引机制

- 每个元素分配唯一 DOM ID：`__outline_heading_N` / `__outline_q_N` / `__outline_turn_N`
- 滚动时反向遍历 headings 数组，找到 `offsetTop ≤ scrollTop` 的最后一项 → 高亮
- 点击时 `getBoundingClientRect()` → `window.scrollTo({ behavior: 'smooth' })` → 闪烁动画

### 性能优化

- 滚动高亮使用 100ms 防抖，避免频繁计算
- 侧边栏使用 CSS 硬件加速动画（`transform`, `opacity`）
- AI 聊天动态内容刷新使用 800ms 防抖
- Content Script 仅在 `document_idle` 时注入

## 🎨 主题定制

编辑 `content.css` 中的 CSS 变量即可自定义配色：

```css
/* 主背景 */
#__outline_sidebar {
  background: linear-gradient(135deg, #0f1923 0%, #1a1f2e 100%);
}

/* 主题色 */
.__outline_marker_level_1 { background: rgba(100, 160, 255, 0.8); }  /* 蓝色 */
.__outline_marker_level_2 { background: rgba(120, 200, 160, 0.7); }  /* 绿色 */
.__outline_marker_level_3 { background: rgba(255, 180, 100, 0.6); }  /* 橙色 */
.__outline_marker_level_4 { background: rgba(200, 140, 255, 0.5); }  /* 紫色 */
```

## 📋 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + O` | 切换侧边栏显示/隐藏 |

## 🐛 已知限制

- 部分网站的 DOM 结构可能随版本更新变化，需要更新选择器
- 极长页面（100+ 标题）可能需要滚动侧边栏才能看到全部
- Shadow DOM 内的标题暂不支持检测

## 📄 许可证

[MIT License](LICENSE) — 自由使用、修改和分发。

## 🙏 致谢

- 设计风格参考 [AIHOT](https://aihot.virxact.com/)
- 基于 Chrome Extension Manifest V3 规范开发
