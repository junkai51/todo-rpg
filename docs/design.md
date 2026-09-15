# Todo RPG 设计基线

更新：2026-09-15。本文是后续开发的单一设计基线。

## 1. 当前范围

先实现可用的现实记录工具，电脑浏览器优先，兼顾 iPhone。当前实现 Todo + Routine；Habit 仅保留设计。GM、Mock GM、奖励预算、GameState、Quest、World Chat 和世界生成不属于当前实现。

现实层文案采用简洁、工具性的语言。用户自己确认现实轮次；计划、日程与时间流逝都不能替代现实完成事实。

## 2. Reality 的三个领域概念

| 概念 | 含义 | 生命周期 | 当前范围 |
| --- | --- | --- | --- |
| Todo | 一次性事项，可选 `dueAt` | 完成后永久结束；确认前允许取消完成 | 实现 |
| Routine | 根据 `schedule` 提供可执行时间窗口的例行事项 | 定义持续存在，每个有效窗口分别完成；可停用／启用 | 实现每天、指定星期 |
| Habit | 希望增加或减少的行为 | 记录行为与观察，不存在“完成一次后结束” | 仅设计，不建 UI 或伪完成状态 |

不再以 `Task + recurrence` 承载这些语义。Todo 和 Routine 使用独立类型与集合；UI 可以把它们投影到同一个 Today 列表，投影类型不成为领域实体。Habit 后续需要独立确定行为记录方式、方向与统计周期，不能直接套用 Todo 或 Routine completion。

### Todo

- 标题必填；描述、难度、截止日期可选。难度为 1–4 级，仅记录，不计算奖励。
- 当前 `dueAt` 为本地日期 `YYYY-MM-DD`，精确到日，不包含提醒或具体时刻。
- 状态为 `todo / completed / cancelled`。确认前可修改内容、完成、取消完成、取消或恢复。
- 完成／取消并确认后记录归档，永久从 Today 移除，即便没有选择隐藏已结束也不会再次出现；底层实体与事件历史保留。
- 未结束 Todo 在确认后仍可继续处理，不改写以前的快照。

### Routine

- Routine 持有标题、描述、难度、日程和启用状态；没有 `dueAt` 或整个 Routine 的 `completed` 状态。
- `schedule` 表示 occurrence 的计划窗口，不是 deadline。当前只有每天和每周指定的一个或多个星期，附开始日期。
- 本版窗口为设备本地自然日：当天 00:00 到次日 00:00，前闭后开。新建、启用或修改日程后，当前可执行部分不早于该变更生效时刻。
- 只有当前有效窗口内的 occurrence 可以完成。未来窗口不能提前做，过去未完成窗口不补建为 actionable 项；UI 旧页面发来的过期点击也由领域层拒绝。
- 当前 occurrence 是由 Routine、日程和当前时间推导的值，不预先生成无限行，也没有创建下一次任务的后台队列。
- 同一 Routine 在同一天拥有稳定 occurrence ID，修改日程、停用再启用或重复点击不会额外获得同一天的完成机会。
- 完成后当前窗口不再 actionable；确认前可取消完成。若取消的是已过期窗口，只移除该完成记录，不恢复补做入口。
- 下一有效日期到来时自然出现下一窗口。当天完成不会立即在 Today 出现下一次；昨天未确认也不阻止今天执行。
- 确认只将完成事件提交；不修改 Routine，不产生下一次 occurrence，不推进日程。
- 停用立即移除当前可执行入口；已有完成记录保留，仍可提交。启用不抹掉已有完成。

### 未来 adherence / missed windows

Routine 保存 `scheduleHistory`，包括创建、日程变更、停用和启用的生效时刻；完成事件保存发生时的 Routine 快照、occurrence 日期及实际窗口边界。未来可以按历史生效日程与完成历史计算应执行窗口和漏做窗口，不需要现在补建过去任务。

当前不计算 adherence，不生成 missed 事件，不实现惩罚。用户清空数据后无法计算此前的 adherence。本版使用设备本地日历；未来若增加跨时区或固定时区，应明确升级规则，不能把当前本地日期直接解释成 UTC 日期。日期窗口以本地午夜计算，不能用固定 24 小时代替，避免夏令时偏移。

## 3. RealityEvent 与现实轮次

所有操作由纯领域函数处理，UI 通过 repository 在数据库事务中保存结果。

| 事件 | 来源 | 后续是否可作为完成事实 |
| --- | --- | --- |
| `TODO_PLANNED` / `TODO_UPDATED` / `TODO_CANCELLED` | Todo 的计划、调整或取消 | 否 |
| `TODO_COMPLETED` | Todo 当前有效的完成状态 | 确认后可以 |
| `ROUTINE_PLANNED` / `ROUTINE_UPDATED` / `ROUTINE_STOPPED` | Routine 定义的建立或调整 | 否 |
| `ROUTINE_COMPLETED` | 当前有效窗口的一次完成 | 确认后可以 |

- 待提交 Todo 记录按 Todo ID 合并；确认前多次勾选／编辑只保留最终有效状态。取消完成后不留下可供奖励使用的完成事件。
- Routine 配置记录按 Routine ID 合并；完成记录按 occurrence ID 独立保留。配置和完成不是同一条记录，修改日程不会覆盖已发生的完成快照。
- 事件含事件 ID、时间、合并 key 和不可变主体快照。`ROUTINE_COMPLETED` 另含 occurrence 和完成时间。
- `RealityTurn.events` 是确认时的一批独立事件快照；提交后不可修改或撤回。未提交的早期完成记录可以跨日保留。
- 提交读取当前有效事件、归档已结束 Todo、写入轮次和清空 pending 必须原子完成。
- 空 pending 不创建轮次；双击、重试或两个页面并发提交不能重复消费同一批记录。两个页面并发完成同一 occurrence 也只能保留一个完成事件。
- 用户确认现实轮次、未来确认游戏草稿是不同动作；当前确认不调用 GM、不计算预算、不改变 GameState。

## 4. UI 与调试

### Today 与编辑

- Today 展示所有未归档 Todo 和 Routine 当前 actionable 窗口。Todo 暂不按未来 dueAt 筛掉，Routine 严格按有效窗口筛选。
- 待确认的完成／取消记录下移；跨日的 Routine 完成仍可审核，标明执行日期和待确认状态，不作为旧窗口补做入口。
- 每次确认后，已完成和已取消记录从 Today 移除；隐藏开关只作用于尚未确认的已结束记录。
- 新建／编辑共用弹窗。新建时选择“一次性事项”或“例行事项”；建立后不直接转换领域类型。
- Todo 编辑截止日期；Routine 编辑日程和开始日期。取消 Todo、停用／启用 Routine 放在编辑界面内。
- 新建事项置顶，列表紧凑显示名称、日期、编辑按钮，有描述时显示第二行小字。
- 上移／下移只改变展示排序，不产生 RealityEvent。未完成与已结束分组排序。
- “例行事项”管理入口始终可以查看、编辑尚未开始、今天不执行或已经停用的 Routine，不把它们冒充为 Today 的 actionable 项。
- 页面在本地午夜、应用重新激活／窗口聚焦时更新日期，并每分钟校准；操作本身再次使用当前时间校验，后台休眠或旧 UI 不能绕过有效窗口。

### 调试面板

仅开发模式提供默认关闭的“调试”入口，正式构建不显示。

- 汇总卡片：Todo、Routine、待提交事件、已确认轮次数量。
- 待提交事件卡片：事项名称、中文动作说明、事件类型、发生时间、完成窗口。
- Routine 日程状态：启用状态、计划、开始日期、版本数量和当前窗口。
- 轮次列表：确认时间、事件数、完成数，点击展开事件快照。
- 原始 JSON 按需展开，默认不占满页面。
- “清空全部记录”一键清空当前设备本地 Todo、Routine、pending、轮次以及旧迁移备份；同一事务完成。清空后刷新保持为空，可以重新新建事项。该操作不可恢复，不影响其他设备的存储。

创建时间、内部 ID、轮次与提交元数据不会逐项展示在日常列表中。面向最终用户的历史页面以后另行设计。

## 5. 存储与本次旧数据处理

- TypeScript + React Native + Expo，浏览器优先。浏览器使用 IndexedDB，原生端使用 SQLite。
- 当前仍用一份带格式版本的 JSON 状态保存独立的 `todos`、`routines`、`pending`、`turns`，不引入 ORM、后端、消息队列或完整 event sourcing。
- 格式为 v4。根据用户 2026-09-15 的补充授权，本次不迁移旧记录：首次读到 v1、v2 或重构中间版本 v3 时，清空原记录和迁移备份，并原子保存空 v4 状态。后续读取 v4 不会重复清空。
- 沿用浏览器数据库 `todo-rpg-v1` / store `reality` / key `current`，避免留下另一个仍在使用的旧库；数据库名字不是领域格式版本。
- 原生仍使用 `todo-rpg.db`，当前状态为 `reality.id = 1`，清空包含旧备份行及备份表。
- 保存失败显示错误；不能把未持久化的变更当成功。清空后旧页面的无效实体操作被拒绝。
- 每个站点、浏览器、设备独立保存，无账号、同步或云数据库。不需要 LLM 服务或 API key。
- 当前没有用户数据导出／恢复。iPhone 原生适配存在，但仍需真机或模拟器验收。

## 6. 游戏边界：保留，不实现

最高原则：The LLM never decides whether progress was earned. Reality does. The LLM decides what earned progress means in the game world.

- Reality 与 Game Domain 分离，Todo／Routine 不携带 XP、游戏奖励或强制 Quest 映射。
- 只有确认过的完成类 RealityEvent 才能由程序产生游戏进展预算。Routine 计划窗口出现、计划／调整／取消、用户聊天和 AI narration 都不能赚取进展。
- 未来 Turn Interpreter 读取冻结的 RealityEvents、GameState、active quests 和受控记忆，提出 structured Proposed GameEvents。Rules／Validator 校验预算、合法性与剧情阶段，用户确认游戏 TurnDraft 后才 commit canonical GameEvents 并更新 GameState。
- Narration 是表现，GameState + committed GameEvents 才是事实来源。
- World Chat 只读 player-visible state / known lore，不读取 hidden state，也不可写状态，不能通过聊天刷进度或剧透。
- Quest 不与单个现实事项一一对应。长期 Project／重复主题可以作为素材，经 StoryHook／QuestProposal、promotion／玩家确认成为 active Quest，并限制主线／支线数量。
- 世界记忆分当前状态、近期回合摘要和压缩长期记忆，不把全量原始历史塞给模型。
- engine 固定、WorldPack 可变。未来允许自然语言创建 WorldPackDraft，经 schema validation 和确认后启用。
- World Builder、Turn Interpreter、Narrator、World Chat 是不同权限的逻辑角色，MVP 可使用同一模型和不同 context／prompt 实现。
- 游戏内容草稿可重新生成，但不能重复消费现实完成事实。次数、可变范围及秘密展示时机以后确定。
- 开始 GM 开发时先 Mock 验证提案／校验／确认，再接真实 LLM；这不是当前 Reality 验收条件。

## 7. 验收与留白

当前验收重点：Todo 完成与撤销的最终有效状态、Routine 当前窗口／跨日／指定星期／过期拒绝、完成和 Turn 独立、提交后清理、事件类型区分、快照隔离、并发幂等、一次性旧格式清空、手动清空与重开、桌面和窄屏操作、正式构建隐藏调试。

暂不实现 Habit UI、复杂 RRULE、每 N 天新建、月／年重复、时段窗口、节假日、提醒、日历视图、Project、子任务、时间追踪、统计、已确认历史纠错或跨设备同步。

游戏预算、角色属性、升级、战斗、装备、经济、世界题材、Quest 阶段／数量、模型供应商、prompt、Python／FastAPI 接入时机继续留白，不因搭建 Reality 层提前冻结。

## 8. 决策记录

| 日期 | 决定 |
| --- | --- |
| 2026-09-10 | 现实记录优先，电脑浏览器最重要，兼顾 iPhone；保留 Expo／React Native。 |
| 2026-09-10 | 用户手动确认轮次；确认前可调整，确认后不可撤回；游戏草稿未来可重新生成。 |
| 2026-09-11 | 共用编辑弹窗、描述／难度／日期、紧凑列表、手动排序、开发信息分离。 |
| 2026-09-15 | Todo、Routine、Habit 分离；废止 Task 附加 recurrence 的统一模型。 |
| 2026-09-15 | Routine schedule 独立于 Turn，只提供有效时间窗口；当前只实现每天和指定星期。 |
| 2026-09-15 | 两类完成生成不同 RealityEvent；确认后已完成项从页面清除，历史仍保留。 |
| 2026-09-15 | 调试改为可视卡片；用户允许清空旧记录，并要求一键清空功能。 |
