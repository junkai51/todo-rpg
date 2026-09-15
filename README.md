# Todo RPG

本地优先的现实记录应用，电脑浏览器优先，兼顾 iPhone。唯一设计基线见 [docs/design.md](docs/design.md)。

当前实现两个独立领域：

- **Todo**：一次性事项，可选截止日期，完成并确认后从列表归档移除。
- **Routine**：每天或指定星期当天执行。日程表示执行窗口，不是截止日期；完成不会立即生成下一次，窗口随日期变化，与确认轮次无关。

Habit 只保留设计；GM 和游戏功能尚未实现。共用新建／编辑弹窗、紧凑 Today 列表、手动排序和独立例行事项管理均可使用。

## 本地运行

使用 Node.js 24 LTS（`.nvmrc`）和 npm：

```sh
npm ci
npm run web
```

打开 <http://localhost:8081>。依赖安装后只需 `npm run web`。请保持日常使用的地址和端口一致，浏览器按站点保存数据。

## 数据与调试

按本次用户授权，旧 v1／v2／中间 v3 记录会在首次加载新版时清空，保存为空 v4。之后刷新不会清空新数据。

开发模式的“调试”面板提供状态汇总、事件卡片、日程状态、可展开轮次和原始 JSON。点击“清空全部记录”会一键删除当前设备的全部领域记录和旧迁移备份。正式构建不显示调试入口。

浏览器使用 IndexedDB，原生端使用 SQLite；没有跨设备同步、账号或数据导出／恢复。Routine 按设备本地自然日执行，不补做过去漏期；跨日的待确认完成仍保留到确认或撤销。确认完成记录只是提交 RealityEvent，不产生游戏奖励。

## 验证

```sh
npm run typecheck
npm test
npm run build:web
```

自动测试覆盖独立日程窗口、跨日、星期规则、过期拒绝、事件区分、快照隔离、排序、事务持久化、并发提交／完成、旧格式一次性清空和调试清空。

2026-09-15：23 项测试、类型检查与 Web 导出通过；正式构建验证了旧记录清空、新数据刷新保留、确认不续建 occurrence，以及隐藏调试入口。

浏览器验收包含桌面／390px 窄屏、新建编辑、Today 窗口过滤、非执行日 Routine 管理、确认后清理、模拟跨日、刷新恢复、调试和清空后重新使用。iPhone 原生尚未通过真机或模拟器验收。

## 代码位置

```text
App.tsx                          页面编排、时钟刷新、操作入口
src/domain/models.ts             Todo / Routine / RealityEvent 独立类型
src/domain/schedule.ts           日程与本地自然日窗口
src/domain/today.ts              当前 occurrence、完成查询与 Today 投影
src/domain/reality.ts            纯领域操作、确认与清空规则
src/storage/repository.web.ts    IndexedDB 原子读写
src/storage/repository.ts        SQLite 适配
src/ui/RealityEditor.tsx         新建与编辑弹窗
src/ui/TodayList.tsx             统一展示投影
src/ui/DebugPanel.tsx            卡片调试与一键清空
tests/                           领域与存储测试
docs/design.md                   单一设计基线
```
