# 主题包设计文档（Theme Pack）

> 主题包是**一个 `.css` 文件**，叠加在内置界面风格之上，用于深度定制外观。
> 内置三风格：`eris` 经典（默认）、`cel` 赛璐璐动画、`glass` 夜航玻璃拟态。

## 1. 定位

| 层级 | 来源 | 说明 |
|---|---|---|
| 内置风格 | `data-ui-style="eris \| cel \| glass"` | 设置 › 外观 › 界面风格 选择；各自由官方样式表定义 |
| **主题包** | 用户上传的单个 `.css` | 叠加在内置风格**之上**，可整体换肤或微调 |
| 自定义 CSS | 设置 › 外观 › 自定义 CSS | 单用户就地微调；与主题包同机制但入口不同 |

主题包**不替换**内置风格，而是后置覆盖——未命中选择器的规则完全继承当前风格。
入口：设置 › 外观 › 主题包 →「导入 .css」；「清除主题包」一键卸载。

## 2. 加载机制

1. 导入：`FileReader` 读入文本 → `localStorage["ep_theme_pack"] = {"name": "...", "css": "..."}`（本机保存，暂不参与全局同步）。
2. 应用：注入 `<style id="epThemePack">` 到 `<head>` **末尾**——在内置样式表
   （base → … → overrides → style-*.css）之后，同优先级下后到者胜。
3. 开机：`main.js` 启动序列中 `applyThemePack()` 在风格应用后执行，刷新/重启不丢。
4. 切换内置风格时主题包**继续生效**（它是独立覆盖层）；清除即恢复纯内置风格。

## 3. 编写指南

### 3.1 用 CSS 变量做主题（推荐）

内置风格的全部颜色/圆角/阴影都走 design token，改变量即可整体换肤：

```css
/* 例：把任意风格染成墨绿纸面 */
html[data-ui-style="eris"] {
  --bg-p: #0f1f17;
  --bg-t: #16291f;
  --tx-p: #e6f2ea;
  --accent: #4ade80;
}
```

常用 Token（完整列表见 `css/base.css`）：

| Token | 用途 |
|---|---|
| `--bg-p / --bg-s / --bg-t` | 页面 / 侧栏顶栏 / 卡片背景 |
| `--tx-p / --tx-s / --tx-t` | 主/次/弱文字 |
| `--bd / --bd-h` | 边框 / 悬停边框 |
| `--accent(-fill/-h/-rgb)` | 强调色系 |
| `--ok / --er / --wr / --pr / --sc` 三件套 | 语义状态色 |
| `--radius-*`、`--ease`、`--shadow-*` | 圆角 / 缓动 / 阴影 |

### 3.2 按风格定向覆盖

内置风格通过 `html[data-ui-style="…"]` 区分，主题包可分别定制：

```css
/* 只在赛璐璐风格下微调 */
html[data-ui-style="cel"] .card { box-shadow: 4px 4px 0 #000; }
/* 只在夜航玻璃下换强调光斑 */
html[data-ui-style="glass"] body {
  background: radial-gradient(700px circle at 50% 0%, rgba(228,184,99,0.18), transparent 60%), #0b1322;
}
```

### 3.3 直接覆盖组件类

```css
.stat-card { border-width: 2px; }
.btn { letter-spacing: 0.02em; }
```

## 4. 打包规范

- 单文件、扩展名 `.css`、UTF-8 编码。
- 可选头部元信息（纯注释，前端当前不解析，供人类阅读）：

```css
/*!
 * @name Midnight Green
 * @author you
 * @target eris,cel,glass   ← 建议适配的风格，逗号分隔
 * @version 1.0.0
 */
```

- 图片/字体等资源：当前**不打进包**，可引用外链 URL（`url("https://…")`）或
  已存在的本地资源（如 `/Dashboard/static/res/bg/cel-pattern.png`）。
- 不做沙箱：主题包即完全可信来源的 CSS，请勿导入来路不明的文件。

## 5. 与其他外观机制的关系

| 机制 | 优先级（低→高） | 持久化 |
|---|---|---|
| 内置风格（data-ui-style） | 1 | `ep_ui_style` |
| 强调色 / 背景图 / 字体 | 2（内联覆盖） | `ep_setting_*` |
| **主题包** | 3（`#epThemePack` 样式表） | `ep_theme_pack` |
| 自定义 CSS（外观页 textarea） | 4（`#customCss` 样式表） | `ep_setting_custom_css` |

同一选择器冲突时，后一层胜出。全局同步（一开全开）当前同步 `ep_ui_style` 与
各 `ep_setting_*`；主题包本体暂不跨设备同步（体积不可控），后续可评估入列。

## 6. 路线图（非承诺）

- 主题包头部元信息解析（@name/@author 展示在卡片上）
- 多包并存与启停开关
- 主题包入全局同步与备份/恢复
- 官方主题包仓库（复用模块商店的源机制）
