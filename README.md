# MR Header Injector

一个基于 WXT + React 的浏览器扩展：按**请求 URL 正则**匹配请求，并执行两种动作：

1. **注入请求头**：给命中的请求写入 GitLab MR ID，例如 `X-MR-ID: 123`。
2. **请求重定向**：把命中请求的域名替换成另一个域名，路径和 query 保持不变。

例如：

```text
规则正则：^https?://([a-z0-9-]+\.)*www\.aaa\.com/
动作：注入 X-MR-ID，选中 MR !123
结果：https://www.aaa.com/api/orders → X-MR-ID: 123

规则正则：^https?://www\.export\.com/api/
重定向目标：https://www.api.com
结果：https://www.export.com/api/users?x=1
   → https://www.api.com/api/users?x=1
```

## 功能

- 配置任意 GitLab 实例地址（支持自建实例和子路径）+ Personal Access Token。
- options 里添加规则；每条规则包含**匹配正则**和**模式**（注入请求头 / 请求重定向）。
- 请求头模式需要配置 GitLab 仓库、Header 名称和 MR 筛选条件；重定向模式只需要正则和目标 Origin。
- options 里每条请求头规则可以点「加载 MR」，把 MR 列表持久化缓存；加载后所有 MR 会以 tag 展示，点击 tag 可直接选择。
- MR 支持 Pin 和备注：规则卡片里点「标记」可以给 MR 设置 Pin 或填写备注。Pin 的 MR 优先展示，其次是有备注的 MR，同级按编号从高到低。
- 有备注的 MR 会直接用备注作为 tag 文案，鼠标悬浮通过 Tippy.js 查看 MR ID；没有备注的 MR 显示 ID，悬浮查看标题。
- options、popup、注入页面的 MR tag 都通过 Tippy.js 展示悬浮信息，不再展示选中详情区域。
- 页面右上角可开启悬浮窗口；窗口只展示请求头规则，并支持在页面里切换规则开关、加载/刷新 MR。
- 暂停某条规则只会停止执行，已加载的 MR 列表和当前选择都会保留。
- 默认只拉取 `opened` 状态的 MR，可切换为 merged / closed / 全部。
- 规则（含 MR 的 Pin/备注）、Token、选中 MR 和 MR 列表缓存都保存在本机 `storage.local`，不同步到云端。
- Chrome / Edge（Manifest V3）和 Firefox 113+（Manifest V2）构建。

## 工作原理

扩展通过 `declarativeNetRequest` 动态规则处理请求：

### 请求头注入

对每条启用的请求头规则生成一条动态规则：

- `condition.regexFilter`：用户填写的正则，直接匹配完整请求 URL。
- `action.type = modifyHeaders`：设置配置的请求头，值为当前选中 MR 的 iid。

正则只匹配**请求 URL**，不再按页面来源匹配。页面本身发起的跨域接口请求，只有接口 URL 命中正则时才会注入。

### 请求重定向

对每条启用的重定向规则生成一条动态规则：

- `condition.regexFilter`：匹配请求 URL。
- `action.type = redirect`。
- `action.redirect.transform.host`（以及可选的 scheme/port）：只替换目标域名。
- 原请求的 path、query、fragment 默认保持不变。

重定向规则不需要 GitLab 连接或 MR，属于独立规则。

### 规则优先级

- 同一条请求同时命中重定向和请求头规则时，重定向优先。
- 总开关关闭时，所有规则都不生效。
- 请求头规则还要求 GitLab 已配置且已选中 MR。

## 快速开始

```bash
pnpm install
pnpm dev
```

WXT 会尝试启动带扩展的 Chrome。新版 Chrome 对 `--load-extension` 有更严格的限制，如果没有自动加载扩展，直接用下面的构建 + 手动加载方式：

```bash
pnpm build
# Chrome → chrome://extensions → 开发者模式 → 加载已解压的扩展程序
# 选择 .output/chrome-mv3
```

Firefox：

```bash
pnpm dev:firefox
# 或 pnpm build:firefox 后加载 .output/firefox-mv2
```

## 使用步骤

1. 打开 options 页面（popup 右上角齿轮，或扩展详情页的“扩展程序选项”）。
2. 填写 **GitLab 地址** 和 **Access Token**，点“测试连接”确认。
   - Token 在 GitLab → Preferences → Access Tokens 创建，scope 至少勾选 `read_api`。
3. 点“添加规则”，选择模式并填写：
   - **匹配正则**：直接匹配请求 URL。例如 `aaa\.com` 或 `^https?://www\.aaa\.com/api/`。
   - **请求头模式**：GitLab 仓库、Header 名称、MR 状态 / 每页数量 / 高级查询参数。
   - **重定向模式**：目标域名 / Origin，例如 `https://www.api.com`；路径和 query 会保留。
4. 保存请求头规则后，点规则卡片上的「加载 MR」，把 MR 列表保存到本地；加载到的 MR 会以 tag 形式全部展示，点击 tag 可直接选择。
   - 点「标记」可以给 MR 设置 Pin 和备注；有备注的 tag 会优先展示备注。
   - 也可以跳过这一步，第一次在 popup 打开时会自动加载并缓存。
5. 打开页面后：
   - 扩展图标右上角会出现小圆点，页面右上角会出现一个会呼吸的小圆点（有请求头规则匹配当前页面 URL 时）。
   - 鼠标悬浮页面右上角圆点，会展示当前匹配的请求头规则和 MR ID tag；悬浮 MR tag 通过 Tippy.js 查看信息，点击 tag 选择 MR。
   - 可以在 options 的「悬浮窗口」设置里关闭页面窗口；开启时，只要当前页面 URL 匹配到请求头规则就会显示，规则停用或关闭也不会隐藏。
   - 也可以点击扩展图标，在 popup 的 MR tag 中选择；popup 优先使用已缓存的 MR 列表。
6. 选择 MR 后，匹配正则的请求会携带该请求头。

### 规则示例

| 模式 | 匹配正则 | 配置 | 效果 |
| --- | --- | --- | --- |
| 请求头 | `^https?://([a-z0-9-]+\.)*aaa\.com/` | `X-MR-ID`、`group/a-front`、`!123` | 匹配 `aaa.com` 及子域请求，携带 `X-MR-ID: 123` |
| 请求头 | `^https?://www\.aaa\.com/api/` | `X-MR-ID`、`group/a-front`、`!456` | 只给 `/api/` 下的请求注入 |
| 重定向 | `^https?://www\.export\.com/api/` | `https://www.api.com` | `/api/users?x=1` → `https://www.api.com/api/users?x=1` |

## 正则匹配细节

- 正则直接作用于完整请求 URL（含 scheme、host、path、query）。
- 匹配不区分大小写。
- DNR 使用 RE2；不支持环视、命名分组和反向引用，编辑器会提前拦截。
- 只写域名片段也可以，例如 `aaa\.com` 会命中 URL 中包含 `aaa.com` 的请求；建议写成 `^https?://([a-z0-9-]+\.)*aaa\.com/` 以限定域名边界。
- 正则最长 2000 个字符；同一个模式下完全相同的正则会被拒绝。
- 旧版普通域名规则会自动迁移成等价的 URL 正则，匹配该域名及所有子域。

## 重定向细节

- 目标可以填域名/Origin，也可以带一个固定路径，例如 `www.api.com`、`https://www.api.com`、`https://qiangqiang.work/api`。
- 目标不带路径时：只替换 host（以及显式填写的 scheme/port），保留原请求的 path 和 query。
- 目标带路径时：使用该固定路径，query 仍保留。
- 目标不能包含 query 或 hash。
- 例如正则 `^https?://www\.export\.com/api/` 匹配到 `https://www.export.com/api/users?x=1`，目标 `https://www.api.com` 后变成 `https://www.api.com/api/users?x=1`。
- 例如正则 `^https://headlessui\.com/cdn-cgi/rum(?:[?#]|$)`，目标 `https://qiangqiang.work/api` 后变成 `https://qiangqiang.work/api`。
- 如果目标写了完整 Origin 且没有端口，会清除原请求端口。

## 权限与安全

扩展声明了以下权限：

- `storage`：保存规则和 Token。
- `declarativeNetRequest` / `declarativeNetRequestWithHostAccess`：修改请求头和重定向。
- `<all_urls>`：任意用户配置的 URL 正则都需要能处理请求，同时用于访问自建 GitLab。

注意事项：

- Access Token 以明文保存在浏览器扩展的 `storage.local` 中，不会上传到任何第三方。请使用最小权限的 `read_api` Token。
- 扩展不会读取页面内容或请求体，只按规则修改请求头或重定向 URL。
- 重定向规则会影响所有命中正则的请求，包括页面文档请求；请谨慎编写正则，避免把整页导航重定向走。

## 常见问题

**测试连接返回 401 / 403**

Token 无效、过期或权限不足。重新创建 Token，scope 勾选 `read_api`；自建 GitLab 需要确认地址指向正确的实例。

**404 / 仓库不存在**

检查 GitLab 地址是否包含子路径（如 `https://example.com/gitlab`），以及仓库路径是否为 `group/project`。也可以直接粘贴仓库 URL 让扩展自动解析。

**选了 MR，但请求没有带请求头**

依次检查：

1. 总开关和该条规则是否都打开。
2. 请求 URL 是否命中规则正则。正则只匹配请求 URL，不再按页面域名继承。
3. 是否已经选中 MR（请求头规则需要）。
4. 修改规则后是否重新发起了请求。
5. 打开 `chrome://extensions` 查看扩展是否有错误；改代码后需要重新构建/重载扩展。

**重定向没有生效**

1. 总开关和该条重定向规则是否打开。
2. 请求 URL 是否命中正则。
3. 目标是否只填了域名/Origin；带路径会被拒绝。
4. 是否被优先级更高的重定向规则覆盖。

**MR 列表不是最新的**

options 的「加载 MR」、popup 的刷新按钮和页面面板的刷新都会重新请求 GitLab 并覆盖缓存。缓存按规则保存；修改仓库、MR 状态、每页数量或高级查询参数后，旧缓存会自动失效。

**popup 里看不到某条规则**

popup 会列出所有请求头规则，方便直接选择 MR；重定向规则不会出现在 popup，请在 options 里管理。

**GitLab 使用自签名证书**

浏览器本身需要信任该证书，否则扩展的 `fetch` 也会失败。可以先在浏览器里直接打开 GitLab 地址确认没有证书警告。

**MR 列表不全**

默认只拉第一页（最多 100 条）。可以调小每页数量，或在“高级查询参数”里加 `labels=...`、`author_username=...`、`search=...` 等条件。

**Firefox 提示权限**

Firefox 构建使用 Manifest V2。首次安装/临时加载后，确认扩展拥有对应站点的访问权限；`declarativeNetRequest` 需要请求 URL 权限，扩展申请的是 `<all_urls>`。

## 开发

```bash
pnpm compile        # TypeScript 类型检查
pnpm build          # Chrome MV3 → .output/chrome-mv3
pnpm build:firefox  # Firefox MV2 → .output/firefox-mv2
pnpm zip            # 打包 Chrome 扩展
```

主要目录：

```text
entrypoints/
  background.ts        # DNR 规则同步、徽标、状态消息
  content.tsx          # 注入页面右上角圆点和悬浮选择面板
  popup/               # 请求头规则列表 + 选择 MR + 开关
  options/             # GitLab 连接 + 规则管理
components/            # RuleCard、MrTagPicker、RuleEditor、RuleMrCache、PagePanel 等
lib/
  domain.ts            # 旧版域名解析（仅用于迁移/初始化）
  pattern.ts           # 正则校验、URL 匹配、重定向目标解析
  gitlab.ts            # GitLab REST API
  rules.ts             # 规则校验与 DNR 规则构建
  dnr.ts               # 动态规则读写
  storage.ts           # chrome.storage 封装
  mrCache.ts           # MR 列表持久化缓存
  mrMeta.ts            # MR Pin/备注排序与展示
  useAppState.ts       # 设置/规则状态
  useMrOptions.ts      # popup 的 MR 缓存读取 / 刷新
styles/theme.css       # popup / options 共享样式
styles/page-panel.css  # 页面右上角圆点和 MR tag 面板样式
```

Chrome/Edge 已做过完整流程验证；Firefox 构建通过，使用同一套 WebExtension API，如遇兼容问题可以提 issue。
