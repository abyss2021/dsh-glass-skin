# glass-skin — Harness Web UI 透明玻璃皮肤

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/github-abyss2021%2Fdsh--glass--skin-181717)](https://github.com/abyss2021/dsh-glass-skin)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.2-4c6ef5)](#兼容性)
[![Build](https://img.shields.io/badge/build-none-success)](#开发)

**DeepSeek Harness 的「透明玻璃」皮肤插件** —— 极光或自选图片作画布，侧栏、弹层、输入框、消息气泡都是半透明磨砂片；壁纸保持清晰，磨砂只加在控件上。

![玻璃皮肤效果图（深色）](docs/preview-dark.png)

![玻璃皮肤效果图（浅色）](docs/preview-light.png)

## 特性

- **壁纸清晰、磨砂只在控件上**：画布不做滤镜也不加颗粒；按钮、会话行、选项卡、输入框卡片、菜单弹层与对话框遮罩各自成片。
- **展开侧栏是一整块玻璃**：左右侧栏展开时整列磨砂，面板内控件自动退回原生平面，不叠两层玻璃；收起后恢复裸照片 + 逐控件玻璃片。
- **新会话是透明描边**：只留它自带的 0.5px 边框，按钮区域读到的就是侧栏那块磨砂；hover 用原生半透明色。
- **整页工具页同款磨砂**：「插件」「自动化任务」这类进主区域的整页内容，自动补上与侧栏同配方的磨砂，正文不再压在照片上。
- **一套配方两种明暗**：颜色全走 `--dsw-*` token，深浅只换值，不会出现"深色玻璃 + 浅色文字"。
- **纯客户端、零构建**：只有一个 `client.js`，没有依赖、没有构建步骤；卸载即完全还原。
- **可调**：背景图（本地文件或 URL）、整站浓度、左右侧栏磨砂强度都在设置页里实时生效。
- **无障碍**：尊重 `prefers-reduced-motion` 与 `prefers-reduced-transparency`。

## 安装

要求：带 Web 界面的 DSH profile（`dsh web`）；`pnpm` 在 PATH 上（插件安装由它拉包）；DSH 版本见[兼容性](#兼容性)。

仓库：<https://github.com/abyss2021/dsh-glass-skin>

**命令行（推荐）**

```bash
dsh plugin --profile web add github:abyss2021/dsh-glass-skin
```

完整地址等价：`git+https://github.com/abyss2021/dsh-glass-skin.git`。安装会自动把插件加进 profile 的 bundle 列表并启用。

**Web 界面**

侧栏 → **插件** → **添加插件**，粘贴 `github:abyss2021/dsh-glass-skin`；装完在插件页启用，刷新页面即可。

**`plugin_manager` 工具**

`install_bundle`，`target` 填 `github:abyss2021/dsh-glass-skin`；`set_bundle enabled:false` 停用，`remove_bundle` 卸载。

**更新和卸载**

```bash
# 更新：先卸载再装（git 依赖跟随仓库提交）
dsh plugin --profile web remove @local/glass-skin
dsh plugin --profile web add github:abyss2021/dsh-glass-skin
```

**本地开发**

```bash
dsh plugin --profile web add /path/to/glass-skin   # 目录链接，改 client.js 刷新即生效
```

> 网络直连 GitHub 慢或被拦时，命令行可改用 SSH 地址：`git+ssh://git@github.com/abyss2021/dsh-glass-skin.git`（需本机 GitHub SSH key），或给 pnpm 配代理。

## 使用

### 背景与浓度（设置 → 玻璃皮肤）

| 项 | 说明 |
| --- | --- |
| 选择文件 | 浏览器内压到最长边 2560px、JPEG 0.86 存 localStorage（`glass-skin:wallpaper`） |
| 用此 URL | `https://…` 或 `data:`，回车生效 |
| 恢复渐变 | 清空壁纸，回到内置极光 |
| 浓度 | 色调层 0–80%，默认 44（`glass-skin:tint`）；照片太亮、看不清字就往上调 |
| 展开的侧边栏 | 左 / 右各 0–100%，默认 20（`glass-skin:left-panel` / `glass-skin:right-panel`） |

- 选中图片后画布**不再漂移并铺满视口**（`inset: 0` + `background-size: cover`），四边齐平，不会在边缘露出极光或色调。
- data URL 超过约 3.8MB 时不写 localStorage，只在本次会话生效，刷新后回到渐变。

### 明暗

设置页顶部的**外观**（深色 / 浅色）切换的是官方 `ui-theme` 偏好，所以文字配色和玻璃配方同源；
官方 Appearance 那行由插件接管隐藏，卸载后自动回来。

## 实现

纯客户端三层：token、样式表、画布与设置页。Host 半侧只有一个空的 `apply`。

### 1. token 层

`ctx.theme.overrideTokens('glass-skin', {...})`，每个 token 是 `{ light, dark }` 一对，落在 body 内联样式上：

- 表面：`--dsw-alias-bg-base / bg-layer-1..3 / bg-overlay` 半透明
- 侧栏、菜单、输入框、气泡：`--dsw-specific-*`、`--dsw-menu-surface-fill` 半透明
- 弹层磨砂：`--dsw-menu-backdrop-filter`（40px + saturate）、`--dsw-mask-blur`（对话框遮罩 16px）
- 玻璃边：`--dsw-elevation-stroke-color` 换成白色发丝线；`--dsw-alias-border-l1..l4` 调成偏冷灰蓝

### 2. 样式层

`client.js` 里的 `CSS`，按段组织：

| 段 | 负责 |
| --- | --- |
| 1 | `body::before` 画布：图片 + 极光两层，54s 缓慢漂移，不加 filter |
| 2 | `body::after` 唯一一层色调，避免相邻区块叠层数不同产生接缝 |
| 3–4 | 框架、侧栏、结构容器全部裸照片；侧栏只留一条 0.5px 细线 |
| 4b | 去掉侧栏列表顶部的白色渐变淡出 |
| 4d | 展开的左右侧栏整列磨砂；面板内控件退回原生平面 |
| 5 | 输入框卡片磨砂 + 投影 |
| 6 | 发出的消息气泡与助手步骤磨砂 |
| 8 | 侧栏 / 底栏 / 顶栏控件的玻璃片 |
| 8b | 新会话按钮透明描边 |
| 9 | `prefers-reduced-*` 降级 |
| 10 | 整页工具页（`main` 插槽）补磨砂 |

### 3. 画布与设置页

设置 → **玻璃皮肤** 独立设置页（`settings.section`）：选图、URL、浓度、左右侧栏强度，全部存 localStorage，没有 Host 状态。

### 为什么底色几乎是透明的

上游大量结构容器都会自己重刷一层 `--dsw-alias-bg-base`；一旦它是半透明，同一界面里有的区域叠 1 层、有的叠 2～3 层，交界处就会出现接缝。所以底色压到 0.10，主色调只由 `body::after` 一层负责，结构容器保持透明。**改浓度要改 `--glass-tint-*`，不是这个 alpha。**

## 调参

只改 `client.js`，改完刷新页面（无需重装）：

| 想要 | 改哪里 |
| --- | --- |
| 更透 / 更实（整站） | `CSS` 里 `:root` 的 `--glass-tint-light` / `--glass-tint-dark` |
| 更透 / 更实（弹层、卡片） | `TOKENS` 里 `--dsw-alias-bg-layer-*`、`--dsw-specific-*` 的 alpha |
| 弹层更糊 | `--dsw-menu-backdrop-filter` 的 `blur()` |
| 换极光配色 | `CSS` 里 `:root` 与 `body[data-ds-dark-theme]` 的 `--glass-aurora` |
| 新会话恢复实底 / 换悬停色 | 第 8b 段；悬停色改 `:hover` 里的 `--dsw-alias-interactive-bg-hover` |
| 整页工具页浓度 | 默认跟随「展开的侧边栏 → 左侧」；单独调就设 `--glass-main-top` / `--glass-main-bottom` |
| 换背景图 | 设置页（或 localStorage `glass-skin:wallpaper`） |

## 兼容性

- **DSH**：在 `0.2.1-rc.2` 上开发验证；只使用稳定的 `ctx.theme.overrideTokens` / `ctx.theme.setTheme`、`ctx.slots.register/inject`、`ctx.locale.register`、`ctx.on('theme/change')` 接口。
- **上游耦合**：类名子串选择器（`_sidebarCol`、`_composerSeat`、`_card`、`_bubble`、`_newSession`）和插槽锚点（`data-slot='main'` / `data-slot='main.conversation'`）。上游重命名时对应特效会静默失效（不报错、不白屏），按新名字改子串即可。
- **性能**：blur 只用在弹层、对话框、输入框卡片、消息气泡四处；低配机掉帧时优先去掉气泡那条。
- **降级**：`prefers-reduced-motion` 停漂移，`prefers-reduced-transparency` 撤壁纸与 blur。

## 项目结构

```
glass-skin/
├── package.json          # 包清单：dsh.bundle / dsh.client / exports
├── cordis.patch.yml      # 插入插件行
├── index.js              # Host 半侧（空的 apply，皮肤全在客户端）
├── client.js             # Client 半侧：token + 样式表 + 设置页
├── locale/{zh,en}.json   # 展示用元数据
├── docs/                 # 效果图
├── icon.svg
└── README.md / LICENSE
```

## 开发

```bash
node --check client.js     # 语法检查
```

- 本机是**目录链接**安装：改 `client.js` 后刷新页面即可，不需要重装。页面挂着 HMR，通常也会自动换上；没反应就手动刷新。
- 仓库没有构建步骤，也没有测试套件；视觉验证靠人眼。

## 许可

[MIT](LICENSE)
