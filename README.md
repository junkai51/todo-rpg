# Todo RPG

现实任务记录优先的本地应用。电脑浏览器是当前主要使用端，兼顾 iPhone。

唯一设计基线见 [docs/design.md](docs/design.md)。

已实现第一个现实记录闭环：添加事项 → 完成／调整 → 手动提交轮次 → 本地保存与历史查看。

## 本地运行

使用 Node.js 24 LTS（见 `.nvmrc`）和 npm。

```sh
npm ci
npm run web
```

打开 <http://localhost:8081>。浏览器数据按站点保存，日常使用请保持这个地址和端口一致。

已经安装依赖后只需运行 `npm run web`。开发服务在本机提供页面，现实记录无需 AI 服务或 API key。

## 验证

```sh
npm run typecheck
npm test
npm run build:web
```

2026-09-10 已使用 Node 24.19.0 验证：

- 类型检查与 Web 导出通过。
- 8 项领域和 IndexedDB 事务测试通过，包括重复提交、并发提交、保存失败回退及重新打开数据库。
- Chromium 实际操作通过：新增、编辑、取消完成、取消事项、提交最终记录、刷新恢复与历史快照隔离。
- 已检查 1360px 桌面和 390px 窄屏；未发现横向溢出或页面运行时错误。

iPhone 原生 SQLite 适配已留出实现，但尚未进行真机或模拟器验收。窄屏浏览器检查不等同于 iPhone 原生验证。

## 代码位置

```text
App.tsx                         现实事项与轮次记录页面
src/domain/reality.ts            现实记录与提交规则
src/storage/repository.web.ts    浏览器 IndexedDB 事务
src/storage/repository.ts        原生 SQLite 适配
tests/                          领域与持久化测试
docs/design.md                  唯一设计基线
```

v0.1 用一个带格式版本的本地状态保存任务、待提交记录和轮次。领域逻辑与界面、数据库驱动分离；后续需要更多查询或迁移时再拆分存储结构。

浏览器数据保存在 IndexedDB；原生端使用 SQLite。不同浏览器、设备之间暂不共享数据。请勿清除站点数据来解决普通页面问题，清除会删除本地记录；本版尚无导出和恢复功能。

已提交轮次只读。未完成任务仍可在下一轮继续调整，过去的记录保持不变。

GM、奖励预算、Quest、游戏状态与世界生成均未实现；未来行为只在设计基线中保留边界，不以当前页面猜定游戏规则。
