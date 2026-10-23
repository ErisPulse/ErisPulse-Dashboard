# ErisPulse 设计语言（EP Design Language）

> 版本 1.1 · 2026-10 · 适用于 ErisPulse Dashboard 及所有家族模块（如 QvQChat Dashboard）与第三方模块视图。
> 本文档是 Dashboard 内置页面、组件库与主题系统的唯一视觉契约。改样式先读这里。

---

## 0. 一句话概括

**深浅双主题的扁平悬浮卡片界面：内容浮于纸面，1px 边框分层，柔和 accent 点睛，无渐变无炫技。**

---

## 1. 设计原则

1. **家族一致性** —— 所有 ErisPulse 家族界面共享同一套 token 与组件语义。用户在任意家族模块间切换不应感到"换了个产品"。
2. **内容优先，装饰克制** —— 界面为数据服务。不用渐变、不用玻璃拟态叠层、不用大阴影；层级靠背景三层 + 1px 边框表达。
3. **悬浮卡片空间语言** —— 页面是"纸面"（`--bg-p`），一切容器是浮在纸面上的"卡片"（`--bg-t` + 1px 边框 + 大圆角），四周保留呼吸间隙。
4. **全主题无差别** —— 任何视觉决策必须同时在 light / dark / auto / OLED / cel 皮肤 / 主题包 / 双档密度下成立。做不到就不做。
5. **为背景图让利（透感优先）** —— 用户设置了背景图时，界面必须"让出"背景：表面层转为半透明，背景图在卡片之间与卡片之后持续可见。不透明实底只允许出现在无背景图的默认状态。可读性靠 accent 派生遮罩 + 局部 blur 兜底，而不是把表面重新涂实。
6. **动效有目的** —— 只有三类动效：进入（弹入）、指向（hover 上浮）、反馈（按压）。总时长 75ms–250ms，永远尊重 `prefers-reduced-motion`。

---

## 2. Design Tokens

所有视觉决策只用 token，**禁止硬编码色值/圆角/阴影**（微缩示意内容等确实无法变量化的除外）。

### 2.1 色彩

| Token | 语义 | Light | Dark |
|---|---|---|---|
| `--bg-p` | 页面纸面（最底层） | `#f6f7f9` | `#0f1115` |
| `--bg-s` | 次级底（hover 面/凹槽） | `#eef0f3` | `#161a20` |
| `--bg-t` | 卡片面（surface） | `#ffffff` | `#1c2027` |
| `--tx-p` / `--tx-s` / `--tx-t` | 文字三级 | `#1c2430` / `#5b6b7c` / `#96a1ad` 系 | 反向 |
| `--bd` / `--bd-h` | 边框 / hover 边框 | `#e3e7ec` / `#cdd4dc` 系 | `#262c35` 系 |
| `--accent` | 强调色（默认 EP 蓝） | `#4aa3dd` | `#6a9df0` |
| `--accent-soft` | **签名 token**：accent 14% 透明柔和底，选中/hover 态专用 | 自动派生 | 自动派生 |
| `--accent-fill` | 实心填充（主按钮底） | 跟随 accent | |
| `--ok-*` `--er-*` `--wr-*` `--pr-*` `--sc-*` | 语义色（各含 `-c` 文字/`-bg` 底/`-bd` 边框） | 低透明底 + 同色边框 + 实色文字 | |

**禁令**：无渐变（全站 0 处 `linear-gradient`）；无蓝紫渐变配色；OLED 档 `--accent-soft` 提到 18% 保可见性。

### 2.2 圆角阶梯

| 层级 | Token | 值 |
|---|---|---|
| 悬浮面板（侧栏/顶栏） | `--radius-panel` | 20px |
| 模态框 | `--radius-xl` | 20px |
| 卡片 / 大浮层 | `--radius-lg`→16 档 | 16px |
| stat 卡 / toast | | 14px |
| 菜单 / 下拉 | `--radius-md` | 10px |
| 按钮 / 输入框 / 导航项 | | 10px |
| 小件（kbd、code） | `--radius-xs`/`--radius-sm` | 6/8px |
| 胶囊 / 圆 | | 999px / 50% |

### 2.3 间距节奏

- 外壳呼吸间隙：`--gap-shell: 18px`（cel 皮肤 14px）
- 区块之间：14px（页面内 `> * + *` 级联）
- 组件内部：8–12px；卡片 padding 18–20px
- 基准网格 4px，禁止 3/7/13px 类非整数节奏

### 2.4 阴影与边框

- 默认**无阴影**（扁平），层级 = 背景色差 + 1px `--bd`
- 悬浮/hover 才有 `--shadow-hover`（`0 6px 18px -8px` 级别柔影）
- cel 皮肤例外：硬位移阴影 `4px 4px 0 var(--cel-ink)`，按下阴影归零

### 2.5 动效

- 时长档位：75ms（cel/微反馈）/ 150ms（tooltip、色彩）/ 180–220ms（弹入、位移）
- 缓动：`--ease-smooth`（常规）、`--ease-soft-spring`（弹入）
- **三个签名动效**：
  1. hover 上浮：`translateY(-1px)`（按钮、可点卡片）
  2. 浮层弹入：`scale(0.96) translateY(8px) → 1`（modal、菜单、搜索面板）
  3. 焦点柔光环：`box-shadow: 0 0 0 3.5px var(--accent-soft)`

### 2.6 透感体系（背景图模式）

用户设置背景图后（`html.bg-image` 由外观系统挂载），表面 token 全线转为半透明派生，**一切样式为背景图让利**：

| 层 | 默认（无背景图） | 背景图模式 |
|---|---|---|
| 页面纸面 `--bg-p` | 实色 | 基本透明（≤40% 不透明度），背景图直接可见 |
| 次级底 `--bg-s` | 实色 | ~62-78% 不透明度（按档位） |
| 卡片面 `--bg-t` | 实色 | ~82-92% 不透明度（按档位），**平面半透明、无 blur** |
| 模态/下拉浮层 | 实色 | 半透明 + `blur(12px)`（全站仅此两类允许 blur） |
| 文字/边框/语义色 | 不变 | **不变**（保证对比度） |

**v1.2 修订（平面透感）**：透感 = 干净的平面半透明，不是玻璃拟态。header/侧栏/卡片/统计卡一律不加 backdrop-filter——大面积 blur 是"浑浊感"的来源；只有真正浮在内容之上的模态框与下拉菜单允许轻 blur 兜底可读性。透感三档（轻/标准/强）只调不透明度，不调 blur。

实现约定：
- 透明度统一用 `color-mix(in srgb, <底色> X%, transparent)` 派生，集中在 `html.bg-image` 一处覆写——组件层零改动即全局生效
- 可读性兜底：背景图之上由外观系统叠加 accent/主题派生的半透明遮罩层（现有 `body::before` 遮罩机制增强），禁止靠把卡片重新涂实来解决看不清
- **OLED**：黑底透明会发灰，卡片面透明度降到 ~92%，遮罩加深；**cel 皮肤**：不透明、无 blur（纸面风格例外）
- 主题包与模块自定义样式照常覆写 token，自动继承透感

---

## 3. 空间与布局

### 3.1 悬浮壳（App Shell）

```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │  ← 顶栏卡片（radius-panel）
│ └─────────────────────────────────────┘ │
│ ┌────────┐  ┌────────────────────────┐ │
│ │        │  │  页面标题 + 描述         │ │  ← 内容区（透明，卡片浮于纸面）
│ │ 侧栏    │  │  ┌────┐ ┌────┐ ┌────┐  │ │
│ │ 面板    │  │  │卡片 │ │卡片 │ │卡片 │  │ │
│ │        │  │  └────┘ └────┘ └────┘  │ │
│ └────────┘  └────────────────────────┘ │
└─────────────────────────────────────────┘
     ↑ 四周与区块间 --gap-shell 呼吸间隙，露出 --bg-p
```

- `.app.authed`：`padding + gap: var(--gap-shell)`，`display: flex; column`
- 顶栏 = 独立卡片；侧栏 = 独立面板（sticky，独立滚动）
- 移动端 ≤768px：回到全宽 header + 全高抽屉侧栏（hamburger/overlay 机制不变）

### 3.2 侧边栏

- 宽度三态：展开 232 / compact 196 / collapsed 66
- **导航项 = 圆形图标卡 + 文字**：`.nav-item > .nav-ico(svg) + span`
  - `.nav-ico`：28px 圆、`--bg-s` 底、svg 15px
  - hover：ico 底变 `--accent-soft`；active：ico `--accent-soft` + svg/文字 accent + 600 字重，**不加药丸底**（状态集中在 ico 上）
- 折叠态 = 悬浮圆形图标列，hover 出气泡 tooltip（`data-tip`，由 i18n 同步）
- cel 皮肤：ico 变方形墨面小卡，active 黄底

### 3.3 页面骨架

每个页面统一节奏：

```
.page > h1.page-title + p.page-desc
      > 卡片流（区块间 14px）
```

统计区用网格（`repeat(auto-fit, minmax(...))` 自适应），表格卡全宽，操作区右对齐。

---

## 4. 组件规范

| 组件 | 规范要点 |
|---|---|
| 按钮 `.btn` | radius 10；primary = `--accent-fill` 实底白字；ghost = 透明+边框；hover `-1px` 上浮；cel 下硬阴影按压位移 |
| 输入 `.ep-input/.ep-select` | radius 10；focus = accent 描边 + 3.5px 柔光环 |
| 卡片 `.card` | `--bg-t` + 1px `--bd` + radius 16 + padding 18-20；hover 只加深边框色（可点卡片才上浮）；卡片头 = 标题左 + 操作右，底部 1px 分隔 |
| 统计卡 `.stat-card` | radius 14；数值 `--tx-p` 大字重 + 标签 `--tx-t` 小字 |
| 徽标/Chip | 胶囊 999；语义色三件套（低透明底+同色边+实色字） |
| Toast | 右下角，radius 14，滑入；成功/危险语义变体 |
| 模态 | 遮罩 `--modal`；卡片 radius 18-20 + 弹入动画；点击遮罩关闭 |
| 下拉/菜单 | radius 12 + `--shadow-hover` + 弹入；挂 body 定位 |
| 空状态 | 居中图标（stroke SVG，`--tx-t`）+ 一句话 + 可选行动按钮；**每个列表页必须有** |
| 加载态 | 骨架占位（`--bg-s` 块 + 呼吸动画）优先于 spinner |
| 滚动条 | 全局镂空胶囊（transparent border + background-clip），hover 变 accent |
| 图标 | stroke SVG、viewBox 24、stroke-width 2、linecap/join round；导航内 15-16px |

---

## 5. 主题与皮肤机制

- 载体全部是 CSS 变量：`[data-theme]`、`[data-oled]`、`[data-density]`、`[data-ui-style]`、主题包（zip → theme.css 覆写）
- **换肤 = 换 token，不动结构**。cel 皮肤证明了纯 token 覆写可换整套气质（直角/硬阴影/抽帧/红 accent）
- 运行时换 accent 只改 `--accent*`，`--accent-soft` 经 `color-mix` 自动跟随
- 新组件必须只用 token 书写，否则会破坏主题包与 cel

---

## 6. 模块开发者指南（对外契约）

Dashboard 通过 `sdk.register_view(...)`（见 `docs/module-view-registration.md`）为模块提供页面接入，**模块无需自带基础样式**即自动获得全部设计语言：

- **自动获得**：导航项（圆形图标卡 + tooltip + i18n）、页面容器、全部 token、全部主题（明暗/OLED/cel/主题包）、组件类（`.card/.btn/.ep-input/.chip/...`）
- `icon_svg` 规范：stroke SVG、`viewBox="0 0 24 24"`、`stroke="currentColor"`、`stroke-width="2"`、不写死宽高（容器约束为 15px）
- `css_content`/`js_content` 约定：只写模块私有样式/逻辑；**优先复用 token 与组件类**，勿覆写 `.nav-item/.card/.btn` 等全局类
- 想换 accent/主题的用户侧能力（设置页）对模块视图同样生效，模块不要自建色彩体系

---

## 7. 血统与参考

- **家族基线**：QvQChat Dashboard（同一 token 体系与签名手法的首个同源实现）
- **布局参考**：LangBot / AstrBot / Koishi 面板（统计网格、表格密度、设置页组织方式）
- **手法参考**：stylekit.top（glassmorphism 的克制浮层、dark mode 的边框点亮——只取手法，不取材质与配色）
- **反例红线**：蓝紫渐变、玻璃拟态大面积 blur、Bootstrap 灰、拟物阴影
