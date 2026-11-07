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

## [0.3.2] - 2026-11-07

### 修复

- **Bundle Patch 的 DSH 行 id 改为 `dsh-glass-skin`**（原 `glass-skin`）。DSH STORE
  的上架预检按「入口 ID 全局唯一」判冲突：目录里那条旧的 `glass-skin` 条目（`packageName`
  还是 `@local/glass-skin`、钉在 `ef3e9c6`、状态 `blocked`）仍然占着入口 ID `glass-skin`，
  因此改名后的新提交被判 `SUBMISSION_ENTRY_COLLISION` 而拒绝：
  `DSH entry ID glass-skin is already owned by glass-skin`。行 id 与包名对齐后不再冲突。
  该 id 只出现在 `cordis.patch.yml` 里，插件没有配置项，所以不涉及用户配置迁移。

## [0.3.1] - 2026-11-06

### 变更

- `exports` 增加 `"./package.json"`。有些工具链通过包的 `exports` 映射读清单元数据，
  缺这一条会解析失败；加上它不影响任何现有入口。

## [0.3.0] - 2026-11-06

### 变更

- **包名从 `@local/glass-skin` 改为 `dsh-glass-skin`**。`@local` 不是任何人能持有的 npm
  scope，任何第三方都可以发同名包，装谁的完全取决于解析顺序；`dsh-glass-skin` 是无 scope 名，
  与仓库同名，也不会占用别人的命名空间。改动涉及四处：`package.json` 的 `name`、
  `cordis.patch.yml` 的 `name`、`client.js` 的模块 `id`、以及文档里的安装 / 卸载命令。
- **升级方式**：`dsh plugin --profile web remove @local/glass-skin` 再
  `dsh plugin --profile web add github:abyss2021/dsh-glass-skin`。`localStorage` 的键
  （`glass-skin:*`）没有改，壁纸、浓度、边缘高光等设置都还在。

## [0.2.2] - 2026-11-06

### 新增

- **manifest 声明兼容范围**：`engines.node`（`>=20`）与 `engines.dsh`（`>=0.2.1-0 <0.3.0-0`），
  外加 `dsh.compatibility`（`dsh: 0.2.1-rc.2`、`profiles: ["web"]`、以及逐版本分级的
  `dshReleases`）。之前只有 README 里的文字说明，工具链读不到，自动收录因此判为「未声明
  兼容范围」；现在 `package.json` 自己就能回答这两个问题。

### 变更

- 去掉 `"private": true`。它原本只是挡住误发 npm，但会让自动收录把包当成非发布物。
- `files` 增加 `docs/*.md`，让 `docs/verification.md` 随包分发。

## [0.2.1] - 2026-11-06

### 变更

- **边缘高光默认值改为 50%**：0.2.0 把高光提成设置项时，默认落在了设计值（100%）上。但在深色、
  近乎透明的卡片上，满强度的发丝描边 + 顶部亮线读起来更像一圈发光轮廓，而不是玻璃自身的受光边。
  现在默认 50%，滑杆仍可拉到 0–150%；已经手动调过的浏览器沿用 `localStorage` 里的值
  （`glass-skin:edge`），要回到新默认就把它清掉。

## [0.2.0] - 2026-11-06

### 新增

- **「边缘高光」设置项**：设置 → 玻璃皮肤新增 0–150% 滑杆，统一缩放卡片、气泡、助手步骤
  与控件上的发丝描边 + 顶部亮线（`--glass-{card,bubble,step,chip}-{ring,sheen}` 八个变量）。
  100% 就是原来的观感，0% 完全去掉，往上接过设计值更亮；深色/浅色各有一套基线 alpha，
  共用同一条曲线。偏好存 `localStorage`（`glass-skin:edge`），拖动即时生效、刷新保留。
- 发丝描边与顶部亮线从写死的字面量改成主题变量，深浅主题自动跟随，调参只需改一处。

## [0.1.1] - 2026-11-05

### 修复

- **Windows 桌面版收起按钮压住 logo**：桌面版 Windows 布局把收起按钮用 `position: fixed`
  钉进标题栏（`[data-windows-titlebar] .toggle`），而它的祖先正是第 4d 段加了磨砂的侧边栏列。
  `backdrop-filter` 会成为 fixed 后代的包含块，按钮的定位基准因此从视口变成列，正好往下掉一个
  标题栏高度、落在 logo 行上。现在 Windows 标题栏布局下改为把磨砂画在列的 `::before` 上
  （同样的 `blur(26px) saturate(170%)` 与上下渐变，配 `isolation: isolate` 兜住负 z-index），
  列本体不再带 filter。macOS / 浏览器版规则不变，展开始终是同一块玻璃。

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
