# 开发日志

按日期记录实现与验证结果。当前设计以 [design.md](design.md) 为准，运行说明见 [README](../README.md)。

## 2026-09-15 · Reality Domain 初步完成

以下验收记录由 README 迁入，属于当时的验证结果，不代表每次修改均重新执行。

2026-09-15：25 项测试、类型检查与 Web 导出通过；正式构建验证了旧记录清空、新数据刷新保留、确认不续建 occurrence，以及隐藏调试入口。

“每 N 天”的浏览器验收已覆盖输入校验、编辑回读、跨日窗口与刷新持久化。

浏览器验收包含桌面／390px 窄屏、新建编辑、Today 窗口过滤、非执行日 Routine 管理、确认后清理、模拟跨日、刷新恢复、调试和清空后重新使用。iPhone 原生尚未通过真机或模拟器验收。

## 2026-09-15 · Game Domain 前的边界整理与 Expo Go 修复

- 保留现有目录、领域类型和 JSON-blob repository；记录未来拆分目录、命名复核和存储评估的触发条件。
- 明确 pending coalescing 表示最终待确认事实，不是完整用户操作流水。
- 修复 `App.tsx` 时钟 effect 在 Expo Go 启动时的 `undefined is not a function`：React Native 的 `window` 是全局对象别名，不具备 DOM 监听 API。注册与清理 focus 监听均限定在 Web 平台；原生继续使用 AppState。
- 本次仅执行类型检查与差异检查，不重跑全量测试或 Web 构建。未进行 Expo Go 真机复验，需在手机重新加载项目确认。
