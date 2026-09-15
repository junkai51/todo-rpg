# Todo RPG

本地优先的现实记录应用，电脑浏览器优先，兼顾 iPhone。唯一设计基线见 [docs/design.md](docs/design.md)。

当前为 **Reality Domain 初步完成版本**，实现两个独立领域：

- **Todo**：一次性事项，可选截止日期，完成并确认后从列表归档移除。
- **Routine**：每天、每 N 天或指定星期当天执行。每 N 天以开始日期为固定起点（N 为 1–365），完成或提交不改变节奏。日程表示执行窗口，不是截止日期；完成不会立即生成下一次，窗口随日期变化，与确认轮次无关。

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

验收记录与修复历史见 [开发日志](docs/devlog.md)。iPhone 原生仍待真机或模拟器完整验收。

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
docs/devlog.md                   开发与验收记录
```

## 演进约定与文档

当前 `src/domain`、`src/ui` 和 JSON-blob repository 保持不变。新增第一个 Game Domain 文件时再分 `src/domain/reality` / `src/domain/game`；新增第一个 Game UI 时再将业务 UI 移到 `src/features/reality` / `src/features/game`，`src/ui` 留作通用 primitive。

Game Turn 建模前重新确认 `RealityTurn` 命名，优先考虑 `RealitySubmission`；现在不重命名。pending event coalescing 保存的是“最终待确认事实”，不是完整用户操作日志。存储正规化等 GameEvent／history 规模实际增长后再评估。

- [设计基线](docs/design.md)：领域语义、当前边界与演进触发条件。
- [开发日志](docs/devlog.md)：日期化的验证结果和修复记录。
