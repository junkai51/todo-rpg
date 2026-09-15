import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Action } from '../domain/reality';
import type { Routine, Todo } from '../domain/models';
import type { TodayItem } from '../domain/today';
import { localDate } from '../domain/schedule';
import { Button } from './Button';
import { difficultyNames } from './RealityEditor';

export function TodayList({ items, at, busy, sorting, onEdit, onAction }: {
  items: TodayItem[]; at: string; busy: boolean; sorting: boolean; onEdit: (entity: Todo | Routine) => void;
  onAction: (action: Action, message: string) => void;
}) {
  return <View style={styles.list}>{!items.length && <Text style={styles.empty}>暂无待办事项</Text>}
    {items.map((item, index) => {
      const ended = item.status !== 'todo';
      const entity = item.subject;
      const date = item.kind === 'todo' ? item.subject.dueAt : item.occurrence.date;
      const sameGroup = (other?: TodayItem) => other && (other.status === 'todo') === !ended;
      const disabled = busy || item.status === 'cancelled';
      function toggle(): Action {
        if (item.kind === 'todo') return { type: 'todoStatus', id: entity.id, status: ended ? 'todo' : 'completed' };
        return ended ? { type: 'undoRoutineCompletion', occurrenceId: item.id } : { type: 'completeRoutine', id: entity.id, occurrenceId: item.id };
      }
      return <View key={item.id} testID={`item-${item.id}`} style={[styles.row, index === 0 && styles.firstRow, ended && styles.endedRow]}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`完成：${entity.title}${date ? `，${date}` : ''}`} aria-checked={item.status === 'completed'} aria-disabled={disabled}
          accessibilityState={{ checked: item.status === 'completed', disabled }} disabled={disabled} style={styles.checkTarget}
          onPress={() => onAction(toggle(), ended ? '已取消完成。' : '已完成。')}>
          <View style={[styles.checkbox, item.status === 'completed' && styles.checked]}><Text style={[styles.checkText, item.status === 'cancelled' && styles.cancelledMark]}>{item.status === 'completed' ? '✓' : item.status === 'cancelled' ? '−' : ''}</Text></View>
        </Pressable>
        <View style={styles.content}><View style={styles.line}>
          <Text numberOfLines={1} style={[styles.title, ended && styles.endedTitle]}>{entity.title}</Text>
          {!!entity.difficulty && <Text accessibilityLabel={`难度：${difficultyNames[entity.difficulty]}`} style={styles.difficulty}>{entity.difficulty}</Text>}
          {item.kind === 'routine' && <Text style={styles.status}>例行</Text>}
          {item.status === 'cancelled' && <Text style={styles.status}>已取消</Text>}
          {!!date && <Text accessibilityLabel={`${item.kind === 'todo' ? '截止日期' : '执行日期'}：${date}`} style={[styles.date, item.kind === 'todo' && !ended && date < localDate(at) && styles.overdue]}>{date.startsWith(localDate(at).slice(0, 4)) ? date.slice(5).replace('-', '/') : date.replaceAll('-', '/')}</Text>}
          <Button label="编辑" accessibilityLabel={`编辑：${entity.title}`} disabled={busy} small onPress={() => onEdit(entity)} />
        </View>{!!entity.description && <Text numberOfLines={1} style={styles.description}>{entity.description}</Text>}
        {item.kind === 'routine' && ended && item.occurrence.date !== localDate(at) && <Text style={styles.description}>已完成，待确认</Text>}
        {sorting && <View style={styles.reorder}><Button label="↑" accessibilityLabel={`上移：${entity.title}`} small disabled={busy || !sameGroup(items[index - 1])} onPress={() => onAction({ type: 'move', id: item.id, direction: 'up' }, '顺序已保存。')} />
          <Button label="↓" accessibilityLabel={`下移：${entity.title}`} small disabled={busy || !sameGroup(items[index + 1])} onPress={() => onAction({ type: 'move', id: item.id, direction: 'down' }, '顺序已保存。')} /></View>}
        </View>
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  list: { borderWidth: 1, borderColor: '#DFE3E8', borderRadius: 8, backgroundColor: '#FFF', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingVertical: 9, paddingLeft: 8, paddingRight: 12, borderTopWidth: 1, borderTopColor: '#ECEEF1' },
  firstRow: { borderTopWidth: 0 }, endedRow: { backgroundColor: '#FAFBFC' },
  checkTarget: { width: 34, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 19, height: 19, borderWidth: 1, borderColor: '#A6AFBB', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: '#596E87', borderColor: '#596E87' }, closedCheck: { opacity: 0.5 }, checkText: { color: '#FFF', fontSize: 13 },
  cancelledMark: { color: '#8B949F' },
  content: { flex: 1, minWidth: 0 }, line: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  title: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 22, color: '#252C35' }, endedTitle: { color: '#7B838D', textDecorationLine: 'line-through' },
  description: { fontSize: 12, color: '#737C89', lineHeight: 18, paddingRight: 8 },
  date: { fontSize: 12, color: '#697383', fontVariant: ['tabular-nums'] }, overdue: { color: '#B63D30' },
  difficulty: { fontSize: 11, color: '#697586', backgroundColor: '#F0F3F7', minWidth: 18, textAlign: 'center', paddingVertical: 2, borderRadius: 4 },
  repeat: { fontSize: 17, color: '#718097' }, status: { fontSize: 11, color: '#848B94' },
  reorder: { flexDirection: 'row', gap: 6, marginTop: 6 }, empty: { padding: 32, textAlign: 'center', fontSize: 14, color: '#7A828E' },
});
