# 📑 Page Outline Navigator

> Smart page outline navigation Chrome extension — Automatically detects heading structures and generates a floating sidebar outline, optimized for AI chat platforms.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

English | **[中文](README.md)**

## 🎯 Use Cases

### 💬 AI Chat Platforms
When having long conversations on ChatGPT, Claude, DeepSeek and other AI platforms, pages become very long and it's hard to find previous answers. Page Outline Navigator automatically identifies each Q&A round, generating a clear navigation outline for instant jump to any position.

### 📚 Technical Documentation & Blogs
While reading long technical articles, quickly understand the article structure and jump to sections of interest. Supports major platforms like Stack Overflow, Medium, GitHub, and more.

### 📖 Online Courses & Tutorials
When learning from online tutorials, the outline helps you quickly locate specific knowledge points, improving learning efficiency.

## ✨ Core Features

### 🤖 Deep AI Chat Integration

| Platform | Domain | Integration Method |
|----------|--------|-------------------|
| ChatGPT | `chatgpt.com` / `chat.openai.com` | User questions 💬 + AI answer headings 🤖 |
| Claude | `claude.ai` | Q&A rounds + Markdown headings in answers |
| DeepSeek | `chat.deepseek.com` | Q&A rounds + Markdown headings |
| Kimi | `kimi.moonshot.cn` | Q&A rounds + Markdown headings |
| Tongyi Qianwen | `tongyi.aliyun.com` | Q&A rounds + Markdown headings |
| Wenxin Yiyan | `yiyan.baidu.com` | Q&A rounds + Markdown headings |
| Doubao | `doubao.com` | Q&A rounds + Markdown headings |
| Perplexity | `perplexity.ai` | Structured answer headings |

### 🌐 Universal Website Support

Stack Overflow, Medium, GitHub, Notion, HuggingFace, Cursor, and more.

Other unsupported websites automatically use generic h1-h6 heading detection.

### 🎯 Smart Features

- **Intelligent Q&A Detection** — ChatMode automatically extracts user questions and AI answers, distinguished by 💬/🤖 icons
- **Real-time Highlight Tracking** — Automatically highlights the current section's outline item while scrolling
- **Search Filter** — Built-in search box for quickly locating target headings
- **Dynamic Refresh** — Auto-updates outline when AI chat adds new content (800ms debounce)
- **Keyboard Shortcut** — `Alt + O` to toggle sidebar with one key
- **Dark Theme** — Gradient dark blue background with blue-green highlight colors, easy on the eyes
- **Smooth Animation** — Click-to-jump uses smooth scroll + flash highlight effect

## 🚀 Installation

### Developer Mode Installation (Recommended)

1. Download or clone this repository locally
2. Open Chrome browser, type `chrome://extensions/` in the address bar
3. Enable **"Developer mode"** in the top right corner
4. Click **"Load unpacked"**
5. Select this project directory (the folder containing `manifest.json`)
6. Open any webpage, and the navigation outline will automatically appear on the right side

### Usage

- **Auto-activate** — Open any webpage with heading structure, and the outline will automatically display on the right
- **Click to jump** — Click any heading in the outline, and the page will smoothly scroll to the corresponding position
- **Search filter** — Enter keywords in the search box to filter the heading list in real-time
- **Collapse/Expand** — Click the arrow in the top left of the sidebar to collapse, click the handle to expand
- **Keyboard shortcut** — Press `Alt + O` to quickly toggle show/hide

## 🏗️ Project Structure

```
chrome-outline-navigator/
├── manifest.json          # Chrome Extension Manifest V3 configuration
├── content.js             # Content script — heading detection, outline generation, scroll tracking
├── content.css            # Sidebar styles — dark theme, animations, responsive
├── popup.html             # Extension popup page
├── popup.js               # Popup logic — statistics, refresh, toggle
├── popup.css              # Popup styles
├── preview.html           # Effect preview page (open directly in browser)
├── flowchart.html         # Implementation flowchart (open directly in browser)
├── icons/
│   ├── icon.svg           # Source icon
│   ├── icon16.png         # 16x16 extension icon
│   ├── icon48.png         # 48x48 extension icon
│   └── icon128.png        # 128x128 extension icon
├── LICENSE                # MIT License
└── README.md              # This file
```

## 🔧 Technical Implementation

### How It Works

```
Page Load → Read Domain → Match Site Configuration Table
         ├─ AI Chat Platform → Dedicated Selector + ChatMode
         └─ Generic Website → h1-h6 Generic Detection
                        ↓
              Assign Unique ID to Elements
                        ↓
              Render Floating Sidebar on Right
                        ↓
         Scroll Tracking (Reverse Traversal) + Click Jump (Smooth Scroll)
                        ↓
              MutationObserver Dynamic Monitoring → Auto Refresh
```

### ChatMode Three-Step Extraction Strategy

When AI chat page has fewer than 2 headings, automatically enters ChatMode:

1. **Step 1** — `questionSelector` extracts user question text (first 50 chars, 💬 prefix)
2. **Step 2** — `answerSelector` extracts h1-h4 sub-headings from AI answers
3. **Step 3** — `turnSelector` fallback: iterate each message, take first sentence, if ends with `?` → question, otherwise → answer

### Position Indexing Mechanism

- Each element gets unique DOM ID: `__outline_heading_N` / `__outline_q_N` / `__outline_turn_N`
- During scrolling, reverse traverse headings array, find last item where `offsetTop ≤ scrollTop` → highlight
- On click: `getBoundingClientRect()` → `window.scrollTo({ behavior: 'smooth' })` → flash animation

### Performance Optimization

- Scroll highlight uses 100ms debounce to avoid frequent calculations
- Sidebar uses CSS hardware-accelerated animations (`transform`, `opacity`)
- AI chat dynamic content refresh uses 800ms debounce
- Content Script injected only at `document_idle`

## 🎨 Theme Customization

Edit CSS variables in `content.css` to customize colors:

```css
/* Main background */
#__outline_sidebar {
  background: linear-gradient(135deg, #0f1923 0%, #1a1f2e 100%);
}

/* Theme colors */
.__outline_marker_level_1 { background: rgba(100, 160, 255, 0.8); }  /* Blue */
.__outline_marker_level_2 { background: rgba(120, 200, 160, 0.7); }  /* Green */
.__outline_marker_level_3 { background: rgba(255, 180, 100, 0.6); }  /* Orange */
.__outline_marker_level_4 { background: rgba(200, 140, 255, 0.5); }  /* Purple */
```

## 📋 Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `Alt + O` | Toggle sidebar show/hide |

## 🐛 Known Limitations

- Some websites' DOM structure may change with version updates, requiring selector updates
- Extremely long pages (100+ headings) may require scrolling the sidebar to see all items
- Headings inside Shadow DOM are not currently supported for detection

## 📄 License

[MIT License](LICENSE) — Free to use, modify, and distribute.

## 🙏 Acknowledgments

- Design style reference: [AIHOT](https://aihot.virxact.com/)
- Built based on Chrome Extension Manifest V3 specification
