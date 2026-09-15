import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isCompletion, type RealityEvent, type RealityState } from '../domain/models';
import { currentOccurrence } from '../domain/today';
import { scheduleLabel } from '../domain/schedule';
import { Button } from './Button';
const labels: Record<RealityEvent['type'], string> = {
  TODO_PLANNED: '新建一次性事项', TODO_UPDATED: '调整一次性事项', TODO_COMPLETED: '完成一次性事项', TODO_CANCELLED: '取消一次性事项',
  ROUTINE_PLANNED: '新建例行事项', ROUTINE_UPDATED: '调整例行事项', ROUTINE_STOPPED: '停用例行事项', ROUTINE_COMPLETED: '完成例行窗口',
};
function EventCard({ event }: { event: RealityEvent }) {
  return <View style={styles.card}><Text style={styles.name}>{event.subject.title} · {labels[event.type]}</Text>
    <Text style={styles.meta}>{event.type} · {new Date(event.recordedAt).toLocaleString()}</Text>
    {event.type === 'ROUTINE_COMPLETED' && <Text style={styles.meta}>执行日期 {event.occurrence.date} · 窗口 {new Date(event.occurrence.startsAt).toLocaleString()} → {new Date(event.occurrence.endsAt).toLocaleString()}</Text>}
    {event.type === 'TODO_COMPLETED' && <Text style={styles.meta}>完成于 {new Date(event.subject.completedAt!).toLocaleString()}</Text>}
  </View>;
}
export function DebugPanel({ state, at, busy, onReset }: { state: RealityState; at: string; busy: boolean; onReset: () => void }) {
  const [raw, setRaw] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  return <View style={styles.panel}><Text style={styles.title}>开发调试</Text>
    <View style={styles.stats}>{[
      ['Todo', state.todos.filter(x => !x.archivedAt).length], ['Routine', state.routines.filter(x => x.status === 'active').length],
      ['待提交事件', state.pending.length], ['已确认轮次', state.turns.length],
    ].map(([label, count]) => <View key={label} style={styles.stat}><Text style={styles.number}>{count}</Text><Text style={styles.meta}>{label}</Text></View>)}</View>
    <Text style={styles.title}>待提交 · 完成 {state.pending.filter(isCompletion).length} 项</Text>
    {!state.pending.length && <Text style={styles.meta}>无待提交事件</Text>}{state.pending.map(event => <EventCard key={event.id} event={event} />)}
    <Text style={styles.title}>日程状态</Text>{!state.routines.length && <Text style={styles.meta}>暂无 Routine</Text>}
    {state.routines.map(routine => { const occurrence = currentOccurrence(routine, at); return <View key={routine.id} style={styles.card}><Text style={styles.name}>{routine.title} · {routine.status === 'active' ? '启用' : '停用'}</Text>
      <Text style={styles.meta}>{scheduleLabel(routine.schedule)} · 开始于 {routine.schedule.startDate} · {routine.scheduleHistory.length} 个日程版本</Text>
      <Text style={styles.meta}>{occurrence ? `当前日程窗口：${occurrence.date}` : '当前不在执行日程内'}</Text></View>; })}
    <Text style={styles.title}>已确认轮次</Text>{!state.turns.length && <Text style={styles.meta}>暂无已确认轮次</Text>}
    {[...state.turns].reverse().map(turn => <View key={turn.id} style={styles.card}><Button label={`第 ${turn.number} 轮 · ${turn.events.filter(isCompletion).length} 项完成 · ${turn.events.length} 个事件 · ${new Date(turn.submittedAt).toLocaleString()}`} small onPress={() => setExpanded(expanded === turn.id ? null : turn.id)} />
      {expanded === turn.id && turn.events.map(event => <EventCard key={event.id} event={event} />)}</View>)}
    <Text style={styles.meta}>清空会删除此设备的 Todo、Routine、待提交事件、历史轮次和迁移备份。</Text>
    <Button label="清空全部记录" kind="danger" disabled={busy} onPress={onReset} />
    <Button label={raw ? '收起原始数据' : '查看原始数据'} small onPress={() => setRaw(!raw)} />
    {raw && <Text selectable style={styles.json}>{JSON.stringify(state, null, 2)}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderTopWidth: 1, borderColor: '#DBDEE3', paddingTop: 20, marginTop: 20, gap: 10 }, title: { fontSize: 14, color: '#535E6E', fontWeight: '600', marginTop: 8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stat: { backgroundColor: '#EAF0F6', borderRadius: 8, padding: 14, minWidth: 110, flexGrow: 1 }, number: { fontSize: 22, color: '#344A63', fontWeight: '600' },
  card: { padding: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E3E7ED', borderRadius: 6, gap: 5 }, name: { fontSize: 13, color: '#354254' },
  meta: { fontSize: 12, color: '#6D7683', lineHeight: 19 }, json: { fontFamily: 'monospace', fontSize: 11, lineHeight: 17, color: '#535E6E', backgroundColor: '#EFF1F4', padding: 12 },
});
