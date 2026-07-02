<div align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Page Outline Navigator icon">

  <h1>Page Outline Navigator</h1>

  <p>智能页面大纲导航 Chrome 扩展，自动识别网页标题、AI 对话问答结构，并生成右侧浮动导航栏。</p>

  <p>
    <a href="README_EN.md">English</a>
    ·
    <a href="preview.html">本地预览</a>
    ·
    <a href="LICENSE">MIT License</a>
  </p>

  <p>
    <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white">
    <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-34A853">
    <img alt="Version" src="https://img.shields.io/badge/version-2.0.0-blue">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-yellow">
  </p>
</div>

## 简介

Page Outline Navigator 会在页面右侧生成一个可搜索、可折叠、可点击跳转的大纲导航栏。它既支持普通网页的 `h1` 到 `h6` 标题结构，也针对 ChatGPT、Claude、Gemini、DeepSeek 等 AI 对话页面做了问答结构识别。

适合阅读长文档、技术博客、在线教程，以及整理长 AI 对话中的问题、回答和回答内部小标题。

## 功能

| 功能 | 说明 |
| --- | --- |
| 页面大纲 | 自动提取网页标题并按层级展示 |
| AI 对话结构 | 将用户问题、AI 回答和回答内标题组织成导航节点 |
| 快速跳转 | 点击大纲项即可平滑滚动到对应位置 |
| 当前高亮 | 页面滚动时自动高亮当前位置 |
| 搜索过滤 | 输入关键词快速定位标题或问答节点 |
| 自动刷新 | 页面内容变化后自动更新导航，适配流式 AI 回答 |
| 收起模式 | 右侧小圆形浮动按钮，减少阅读干扰 |
| 快捷键 | 使用 `Alt + O` 显示或隐藏导航栏 |

## 支持平台

### AI 对话页面

| 平台 | 域名 |
| --- | --- |
| ChatGPT | `chatgpt.com`, `chat.openai.com` |
| Claude | `claude.ai` |
| Gemini | `gemini.google.com` |
| DeepSeek | `chat.deepseek.com` |
| Kimi | `kimi.moonshot.cn` |
| 通义千问 | `tongyi.aliyun.com` |
| 文心一言 | `yiyan.baidu.com` |
| 豆包 | `doubao.com` |
| Perplexity | `perplexity.ai` |

### 普通网页

默认支持所有包含标准标题结构的网页，例如 GitHub、Medium、CSDN、掘金、知乎、Notion、Stack Overflow、技术文档站点和个人博客。

## 安装

1. 克隆或下载本仓库。
2. 打开 Chrome，进入 `chrome://extensions/`。
3. 开启右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择本项目目录，也就是包含 `manifest.json` 的文件夹。
6. 打开任意网页，右侧会自动显示页面大纲。

## 使用

- 点击大纲项：跳转到对应标题、问题或回答位置。
- 使用搜索框：过滤导航列表。
- 点击收起按钮：折叠为右侧圆形浮动按钮。
- 点击圆形按钮：重新展开导航栏。
- 按 `Alt + O`：快速显示或隐藏导航栏。

## 项目结构

```text
chrome-outline-navigator/
├── manifest.json     # Chrome Extension Manifest V3 配置
├── content.js        # 页面结构识别、导航渲染、滚动追踪
├── content.css       # 右侧导航栏样式
├── popup.html        # 扩展弹窗
├── popup.js          # 弹窗交互逻辑
├── popup.css         # 弹窗样式
├── preview.html      # 本地效果预览
├── flowchart.html    # 实现流程图
├── icons/            # 扩展图标
└── README.md
```

## 开发

本项目是原生 Chrome 扩展，无需构建步骤。修改源码后，在 `chrome://extensions/` 点击扩展卡片上的刷新按钮即可重新加载。

常用检查：

```bash
node --check content.js
```

核心文件：

- `content.js`：负责识别页面结构、AI 对话节点、生成和刷新大纲。
- `content.css`：负责导航栏、收起按钮和高亮状态样式。
- `popup.*`：负责扩展弹窗中的统计、刷新和开关操作。

## 已知限制

- 部分 AI 平台 DOM 结构变化后，可能需要更新选择器。
- Shadow DOM 内部标题暂未完整支持。
- 极长页面会生成较长导航列表，可通过搜索快速定位。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
