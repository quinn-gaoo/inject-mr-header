# MR Header Injector

一个基于 WXT + React 的浏览器扩展：为指定域名下的页面请求自动注入 GitLab MR ID 请求头（默认 `X-MR-ID`）。

例如：规则域名 `*.aaa.com`、请求头 `X-MR-ID`、仓库 `group/a-front`，选中 MR `!123` 后，访问 `www.aaa.com` / `xxx.aaa.com` 时，页面文档和页面发出的接口请求都会带上：

```http
X-MR-ID: 123
```

## 功能

- 配置任意 GitLab 实例地址（支持自建实例和子路径）+ Personal Access Token。
- 在 options 页面配置 GitLab 连接、按域名添加注入规则；每条规则包含页面域名、GitLab 仓库、Header 名称，以及 MR 筛选条件。
- options 里每条规则可以点「加载 MR」，把 MR 列表持久化缓存；加载后所有 MR 会以 tag 展示，点击 tag 也可直接选择，之后 popup 命中时直接使用缓存。
- 打开匹配页面后，popup 只展示当前页面命中的规则；MR 只显示 ID tag，鼠标悬浮通过 Tippy.js 展示 MR 标题，不再展示选中详情。页面右上角的悬浮窗口在 options 的「悬浮窗口」设置中控制。
- options 的规则卡片里，MR 以 ID tag 展示，鼠标悬浮时通过原生 `title` 提示查看 MR 标题。
- 命中页面右上角会出现一个很小的中性色圆点（带呼吸动效），鼠标悬浮展示当前匹配规则和 MR ID tag；popup 和页面面板都通过 Tippy.js 悬浮展示 MR 标题，点击 tag 即可选择。扩展图标只显示小圆点，不显示 MR ID。
- 暂停某条规则只会停止注入，已加载的 MR 列表和当前选择都会保留，仍可继续浏览和切换。
- 默认只拉取 `opened` 状态的 MR，可切换为 merged / closed / 全部。
- MR 列表支持每页数量、labels、author 等 GitLab 原生查询参数；MR tag 按编号从高到低排列。
- popup 还支持开关单条规则和总开关。
- 规则、Token、选中 MR 和 MR 列表缓存都保存在本机 `storage.local`，不同步到云端。
- Chrome / Edge（Manifest V3）和 Firefox 113+（Manifest V2）构建。

## 工作原理

扩展通过 `declarativeNetRequest` 动态规则修改请求头，不读取请求内容。

规则同时使用两种匹配条件：

- `initiatorDomains`：页面在 `aaa.com` 或任意子域时，页面里发出的 `fetch` / XHR / WebSocket / 静态资源请求都会带上请求头；即使接口在 `api.bbb.com` 这类其他域名，也会带上。
- `requestDomains` + `main_frame`：地址栏/顶层导航的 HTML 文档请求本身没有 initiator，单独按目标域名匹配，所以直接访问 `www.aaa.com` 时文档请求也会带。
- 其他域名的页面里用 `fetch` 调 `aaa.com` 的接口，不会被注入；但直接导航到 `aaa.com` 的文档请求会带。

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
3. 点“添加规则”，填写：
   - **页面域名**：`*.aaa.com`、`aaa.com` 或完整 URL 都可以，保存时会归一化。
   - **GitLab 仓库**：`group/project`、数字 project ID，或直接粘贴仓库 URL。
   - **请求头名称**：默认 `X-MR-ID`。
   - **MR 状态 / 每页数量 / 高级查询参数**：按需调整。
4. 保存规则后，点规则卡片上的「加载 MR」，把 MR 列表保存到本地；加载到的 MR 会以 tag 形式全部展示，点击 tag 可直接选择。
   - 也可以跳过这一步，第一次在 popup 打开命中页面时会自动加载并缓存。
5. 打开匹配域名的页面：
   - 扩展图标右上角会出现小圆点，页面右上角会出现一个会呼吸的小圆点。
   - 鼠标悬浮页面右上角圆点，会展示当前匹配规则和 MR ID tag；悬浮 MR tag 通过 Tippy.js 查看标题，点击 tag 选择 MR，面板里也可以加载或刷新 MR 数据。
   - 可以在 options 的「悬浮窗口」设置里关闭这个页面窗口；开启时，只要当前页面匹配到已配置的规则就会显示，规则停用或关闭也不会隐藏。
   - 也可以点击扩展图标，在 popup 的 MR tag 中选择；popup 优先使用已缓存的 MR 列表，右侧按钮可刷新。
   - 没有命中时 popup 会展示提示和「添加规则」入口，点一下就能进入 options 配置。
6. 选择 MR 后，页面文档和后续接口请求都会携带该请求头。

### 规则示例

| 页面域名 | 请求头 | GitLab 仓库 | 选中的 MR | 效果 |
| --- | --- | --- | --- | --- |
| `*.aaa.com` | `X-MR-ID` | `group/a-front` | `!123` | `www.aaa.com` 等子域页面的文档和请求带 `X-MR-ID: 123` |
| `admin.aaa.com` | `X-MR-ID` | `group/a-admin` | `!456` | 只匹配 `admin.aaa.com` 及其子域 |
| `bbb.com` | `X-MR-ID` | `group/b-front` | `!789` | `bbb.com` 页面文档和请求带 `X-MR-ID: 789` |

## 域名匹配细节

- `aaa.com`、`*.aaa.com`、`.aaa.com` 会被归一化为 `aaa.com`，匹配该域名和所有子域。
- 支持 `https://www.aaa.com/path`，只取 host。因此 `https://wxt.dev/`、`*.wxt.dev`、`wxt.dev` 保存后都会归一化为 `wxt.dev`，这是预期行为，不是丢失配置。
- 当前不支持“只匹配 apex”或“只匹配子域”，也不支持按 URL 路径匹配；DNR 的域名条件无法区分这些情况。
- 端口不参与匹配：`localhost` 规则会匹配 `localhost:3000`、`localhost:5173` 等。
- 支持 IPv4、`localhost` 和中文域名（转 punycode）。
- 域名重复的规则会被拒绝；如果两条规则域名有包含关系（`aaa.com` 和 `www.aaa.com`），更具体的域名优先级更高。
- **规则域名必须填页面地址的 host，不是接口域名**。例如页面是 `wxt.dev`，规则却填了 `wxt.com`，不会匹配。

## 权限与安全

扩展声明了以下权限：

- `storage`：保存规则和 Token。
- `declarativeNetRequest`：修改请求头。
- `<all_urls>`：任意用户配置的域名都需要能注入请求头，同时用于访问自建 GitLab。

注意事项：

- Access Token 以明文保存在浏览器扩展的 `storage.local` 中，不会上传到任何第三方。请使用最小权限的 `read_api` Token，不要在共享浏览器配置中保存高权限 Token。
- 扩展不会读取页面内容或请求体，只按规则添加/覆盖一个请求头。
- 注入作用于页面发出的**所有资源类型**，并额外覆盖顶层文档导航；如果你只想让接口带，可后续在规则里扩展 `resourceTypes` 限制。

## 常见问题

**测试连接返回 401 / 403**

Token 无效、过期或权限不足。重新创建 Token，scope 勾选 `read_api`；自建 GitLab 需要确认地址指向正确的实例。

**404 / 仓库不存在**

检查 GitLab 地址是否包含子路径（如 `https://example.com/gitlab`），以及仓库路径是否为 `group/project`。也可以直接粘贴仓库 URL 让扩展自动解析。

**选了 MR，但请求没有带请求头**

依次检查：

1. 总开关和该条规则是否都打开。
2. 页面 host 是否命中规则域名（如规则 `aaa.com` 不匹配 `bbb.com`；`wxt.com` 和 `wxt.dev` 也是两个域名）。
3. 是否已经选中 MR（popup 或页面面板会显示当前 MR，扩展图标右上角应有小圆点）。
4. 请求是否由该页面或它的顶层文档发起；其他站点页面/跨域 iframe 里发起的请求不算。
5. 修改规则后是否刷新了页面，或重新发起了请求。
6. 打开 `chrome://extensions` 查看扩展是否有错误；改代码后需要重新构建/重载扩展。

**MR 列表不是最新的**

options 的「加载 MR」、popup 的刷新按钮和页面面板的刷新都会重新请求 GitLab 并覆盖缓存。缓存按规则保存；修改仓库、MR 状态、每页数量或高级查询参数后，旧缓存会自动失效。

**popup 里看不到某条规则**

popup 只展示当前页面命中的规则。其他域名的规则请去 options 页面查看和编辑；当前页面没有命中时会展示提示和「添加规则」入口。

**GitLab 使用自签名证书**

浏览器本身需要信任该证书，否则扩展的 `fetch` 也会失败。可以先在浏览器里直接打开 GitLab 地址确认没有证书警告。

**MR 列表不全**

默认只拉第一页（最多 100 条）。可以调小每页数量，或在“高级查询参数”里加 `labels=...`、`author_username=...`、`search=...` 等条件。

**Firefox 提示权限**

Firefox 构建使用 Manifest V2。首次安装/临时加载后，确认扩展拥有对应站点的访问权限；`declarativeNetRequest` 修改请求头需要请求 URL 和页面来源的 host 权限，扩展申请的是 `<all_urls>`。

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
  popup/               # 当前页面命中规则 + 选择 MR + 开关
  options/             # GitLab 连接 + 规则管理
components/            # RuleCard、MrTagPicker、RuleEditor、RuleMrCache、PagePanel 等
lib/
  domain.ts            # 域名归一化与匹配
  gitlab.ts            # GitLab REST API
  rules.ts             # 规则校验与 DNR 规则构建
  dnr.ts               # 动态规则读写
  storage.ts           # chrome.storage 封装
  mrCache.ts           # MR 列表持久化缓存
  useAppState.ts       # 设置/规则状态
  useMrOptions.ts      # popup 的 MR 缓存读取 / 刷新
styles/theme.css       # popup / options 共享样式
styles/page-panel.css  # 页面右上角圆点和 MR tag 面板样式
```

Chrome/Edge 已做过完整流程验证；Firefox 构建通过，使用同一套 WebExtension API，如遇兼容问题可以提 issue。
