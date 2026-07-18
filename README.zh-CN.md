# ScratchJr Web Edition

[繁體中文](README.md) | [简体中文](README.zh-CN.md) | [English](README.en.md)

这是一个基于 [LLK/scratchjr](https://github.com/LLK/scratchjr) 的 ScratchJr Web 衍生项目。上游项目最初面向 iOS 和 Android；本项目将它改造成纯前端静态 Web 应用，可部署到 GitHub Pages、Netlify 等静态托管平台。

在线版本：<https://yehchenhsuan.github.io/scratchjr/>

## 功能亮点

- **浏览器中的本地创作体验：** 项目和媒体数据保存在 IndexedDB。`src/tablet/Web.js` 用 Web API 替代原生 iOS／Android bridge：相机通过 `getUserMedia` 调用，录音通过 `MediaRecorder` 与 Web Audio API 实现。
- **AI 手势识别：** 新增青色的第七类积木和 `ongesture` 事件积木。用户可以训练自己的手势，用手势触发脚本；分类采用基于手部关键点（landmark）的 KNN，不再使用已移除的 MobileNet／TensorFlow.js，从而减小 PWA 离线预缓存的体积。
- **完整离线 PWA：** 首次联网时，应用会下载离线资源包，底部会显示进度条，完成后会给出提示。Service Worker 使用支持续传的 `GET_CACHE_STATUS` 状态机制；安装完成后可离线打开和使用。
- **更丰富的素材库：** 与桌面版相比，角色库增加了 119 个角色和 28 个背景。
- **WAP 下载与分享：** 项目可以下载到本地；在支持的设备上，也可使用 Web Share API 调出系统分享面板，获得类似 AirDrop 的分享体验。

## 快速开始

需要安装 Node.js 和 npm。先安装依赖：

```bash
npm install
```

本地开发时，先生成开发 bundle，再启动静态服务器并访问 <http://localhost:8080/index.html>：

```bash
npm run dev
npm run serve
```

如需持续监听文件变化，可使用：

```bash
npm run watch
```

相机功能要求安全上下文；浏览器中的 `localhost` 可用于本地开发，部署时请使用 HTTPS。

## 构建与部署

GitHub Pages 的发布目录为 `docs/`。下面的命令会同步 AI 资源、生成 PWA 图标、构建 production bundle，并重建 `docs/`：

```bash
npm run build:web
```

在 GitHub 仓库设置中，将 Pages 配置为从分支的 `/docs` 目录发布。提交并推送更新后的 `docs/`，即可更新 GitHub Pages。

如需生成一份单独的优化 PWA 发布目录，请运行：

```bash
npm run package:pwa
```

输出目录为 `dist/pwa/`，可直接作为 Netlify 等静态托管服务的部署来源。需要完整校验和打包时，可运行 `npm run release:pwa`。

## 许可证与商标

本项目遵循上游的 [BSD-3-Clause 许可证](LICENSE)。ScratchJr 的名称和商标归 MIT Media Lab 所有。本衍生项目新增的 Web bridge、AI 手势识别、离线 PWA、WAP 分享等能力属于本项目的贡献，不代表 MIT Media Lab 的官方产品或认可。
