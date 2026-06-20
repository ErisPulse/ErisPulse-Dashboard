# ErisPulse 图标库

这是一个统一的SVG图标库，用于ErisPulse Dashboard。

## 图标设计原则

- **一致性**: 所有图标使用相同的24x24 viewBox
- **简洁性**: 使用简洁的线条和形状
- **可识别性**: 每个图标都有独特的视觉特征
- **响应式**: 图标在不同尺寸下都保持清晰

## 图标分类

### 导航图标
- Dashboard - 仪表盘概览
- Bots - 机器人管理
- Event Stream - 事件流
- Event Builder - 事件构建器
- Commands - 命令管理
- Modules - 模块管理
- Store - 应用商店
- Packages - 包管理
- Logs - 日志系统
- Lifecycle - 生命周期
- Audit Log - 审计日志
- API Routes - API路由
- Cluster - 集群管理
- Adapter Config - 适配器配置
- Files - 文件管理
- Config - 系统配置
- Framework Config - 框架配置
- About - 关于

### 功能图标
- Settings - 设置
- Add - 添加
- Delete - 删除
- Edit - 编辑
- Save - 保存
- Cancel - 取消
- Refresh - 刷新
- Search - 搜索
- Filter - 筛选
- Download - 下载
- Upload - 上传
- Copy - 复制
- Paste - 粘贴
- Cut - 剪切
- Close - 关闭
- Expand - 展开
- Collapse - 收起
- Check - 确认
- Warning - 警告
- Error - 错误
- Info - 信息
- Success - 成功

## 使用方法

```html
<!-- 直接使用SVG -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <!-- 图标路径 -->
</svg>
```

## 图标颜色方案

- 主色调: 使用 `currentColor` 继承父元素颜色
- 强调色: 特定状态使用不同颜色 (成功、警告、错误等)
- 禁用态: 降低透明度或使用灰色