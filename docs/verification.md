# 安装 / 启动 / 卸载验证记录

这份记录回答一个问题：**把 `dsh-glass-skin` 装进一个干净的一次性 profile，
它真的会被加载、真的会出现在界面上、卸载后真的会消失吗。**

测试环境：

| 项 | 值 |
| --- | --- |
| DSH | `0.2.2-rc.1`（桌面版，profile `desktop` 的宿主） |
| Node | `v24.21.0` |
| pnpm | `11.28.5`（DSH 自带 runtime） |
| OS | Windows 11 x64 |
| 插件版本 | `0.3.0` |
| 一次性 profile | 空的 `DSH_HOME`，让 `dsh plugin` 自己初始化 `profiles/web` |

用到的命令都在一次性 `DSH_HOME` 里执行，**不碰日常 profile**：

```sh
export DSH_HOME=/tmp/dsh-verify        # Windows: 一个空目录
dsh plugin --profile web add <包>       # 首次调用会新建 profiles/web
dsh --profile web --port 64984 --no-open
dsh plugin --profile web remove dsh-glass-skin
```

---

## 1. 安装（install）

包通过 tarball 装（与从 git / 发布物安装走同一条 pnpm 路径，落成真实目录而不是
`link:` 软链，更接近商店的安装形态）。

```
dsh plugin --profile web add glass-skin-0.2.2.tgz

dependencies:
+ dsh-glass-skin 0.2.2
Done in 490ms using pnpm v11.28.5
```

安装后 `profiles/web/package.json` 的 `bundles` 自动多出一层 —— 这一步是关键：
只有进了 `bundles`，`cordis.patch.yml` 才会被当作 patch 层应用。

```json
"dsh": { "profile": { "bundles": [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "dsh-glass-skin"
] } }
```

同时 `cordis.patch.yml` 被正确读取，服务端组出的插件行是 `id: glass-skin`。

## 2. 启动（start）

```
dsh --profile web --port 64984 --no-open
dsh web: http://127.0.0.1:64984/?token=…
```

拿到 token 后取启动页，再取它引用的三个 client chunk：

| 请求 | 结果 |
| --- | --- |
| `GET /?token=…` | `200`，40290 字节 |
| chunk 1 | `200`，7131055 字节 |
| chunk 2 | `200`，2600367 字节 —— **含本插件** |
| chunk 3 | `200`，46592 字节 |

chunk 2 里确认到的内容：

- 模块 id：`'dsh-glass-skin'`
- `settings.section` 注册存在（设置 → 玻璃皮肤这一页）
- `shell.overlay` 注册存在（样式表挂在 overlay 里）
- `edgeTitle` 存在（0.2 起的「边缘高光」滑杆）

也就是说：Host 半侧被加载、Client 半侧被服务、两个插槽都注册上了。

## 3. 卸载（uninstall）

先停服务，再移除：

```
dsh plugin --profile web remove dsh-glass-skin

dependencies:
- dsh-glass-skin 0.2.2
Done in 393ms using pnpm v11.28.5
```

卸载后的状态：

| 检查项 | 结果 |
| --- | --- |
| `package.json` 的 `dependencies` | 只剩内置项，插件已移除 |
| `bundles` | 回到 `dsh-base` + `dsh-web-app` 两层 |
| `node_modules/dsh-glass-skin` | 不存在 |
| 端口 64984 | 已释放 |

皮肤本身不写 Host 状态：所有偏好都在浏览器 `localStorage`
（`glass-skin:*` 几个键），配色走 `ctx.theme.overrideTokens` 的 token 覆盖。
所以卸载后刷新即完全还原，不需要额外的清理步骤。

---

## 已知边界

- **`link:` 安装（本地目录开发）卸载后可能留下一个 junction**：
  `node_modules/dsh-glass-skin` 会指向源码目录。它不参与依赖解析，也不影响
  DSH 启动，但会让下一次 `add` 报 `EPERM: rename … _tmp_…`。删掉那个 junction
  即可继续；tarball / git 安装不会出现（装的是真实目录）。
- **本记录只覆盖「装得上、起得来、卸得掉」**，不等于视觉验收：磨砂、透明层次
  这类效果仍要人眼看（README 的「调参」一节列了每个可调项）。
