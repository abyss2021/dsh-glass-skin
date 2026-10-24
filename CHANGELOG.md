# 变更记录

本项目的重要变更都记录在这里。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 版本规则

- 版本号是 `MAJOR.MINOR.PATCH`，唯一来源是 `package.json`；本文件最新条目的版本、README 顶部的
  version 徽章都必须和它一致。
- 现在是 `0.x` 阶段：皮肤和上游的 CSS Module 类名、`data-slot` 锚点强耦合，为适配上游的改动按
  `MINOR` 发布；纯修复、配色与参数微调走 `PATCH`。
- 兼容基线：当前验证过的 DSH Web 是 `0.2.1-rc.2`（见 README「兼容性」）。换到新的 DSH 版本重新
  验证后升 `MINOR`，并在条目里写明新基线。
- `MAJOR` 只留给会让用户数据或皮肤结构不兼容的改动（例如改 `glass-skin:*` 这组 localStorage 键的
  含义）。

## 发布流程

1. 把 `## [Unreleased]` 下的内容整理成新的 `## [x.y.z] - YYYY-MM-DD`；
2. 同步改 `package.json` 的 `version` 与 README 顶部的 version 徽章；
3. 提交后打 `vx.y.z` tag；要发布到远端时再 `git push origin vx.y.z`。

## [Unreleased]

（暂无）

## [0.1.0] - 2026-10-24

首个公开版本。

### 新增

- **透明玻璃皮肤**：极光渐变或自选图片作画布；壁纸保持清晰，磨砂只加在控件上。
- **token 层**：覆盖 `--dsw-alias-*`、`--dsw-specific-*`、弹层磨砂（`--dsw-menu-backdrop-filter` /
  `--dsw-mask-blur`）与玻璃边框四组变量，深浅成对，跟随官方 `ui-theme` 的明暗切换。
- **样式层**：画布、单层色调、侧栏裸照片 + 0.5px 细线、展开侧栏 / 右栏整列磨砂、输入框卡片、
  消息玻璃、控件玻璃，按段组织（段号表见 README）。
- **「新会话」按钮透明描边**：撤掉上游的实心底色，只留它自带的 0.5px 边框，按钮区域直接用侧栏的
  磨砂；仅在展开的面板里生效，收起后的轨道仍保留玻璃片。
- **整页工具页磨砂**：「插件」「自动化任务」这类进主区域的整页内容，自动补上与展开侧栏同配方的磨砂，
  正文不再直接压在照片上。
- **设置 → 玻璃皮肤**：背景图（本地文件 / URL / 恢复渐变）、色调浓度、左右侧栏磨砂强度；偏好存
  localStorage，没有 Host 状态。
- **皮肤自己的明暗切换**（深色 / 浅色），写的是官方 `ui-theme` 偏好；官方 Appearance 行由插件接管
  隐藏，卸载后自动回来。
- **无障碍降级**：`prefers-reduced-motion` 停漂移，`prefers-reduced-transparency` 撤壁纸与 blur。

### 说明

- 纯客户端实现，零依赖、零构建；Host 半侧只有空的 `apply`，卸载即完全还原。
- 已知耦合：上游 CSS Module 类名子串（`_sidebarCol`、`_composerSeat`、`_card`、`_bubble`、
  `_newSession`）与插槽锚点（`data-slot='main'` / `data-slot='main.conversation'`）。
