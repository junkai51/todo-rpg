import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { localDate, type Schedule, type Weekday } from '../domain/schedule';
import type { Difficulty, EditorInput, Routine, Todo } from '../domain/models';
import { Button } from './Button';
import { DateField } from './DateField';
export const difficultyNames = ['未设置', '简单', '普通', '困难', '很难'];
const weekdays: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function RealityEditor({ entity, busy, error, onClose, onSave, onToggle }: {
  entity: Todo | Routine | null; busy: boolean; error: string; onClose: () => void;
  onSave: (input: EditorInput) => Promise<boolean>; onToggle: () => Promise<boolean>;
}) {
  const [kind, setKind] = useState<'todo' | 'routine'>(entity?.kind ?? 'todo');
  const [title, setTitle] = useState(entity?.title ?? '');
  const [description, setDescription] = useState(entity?.description ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(entity?.difficulty ?? null);
  const [dueAt, setDueAt] = useState(entity?.kind === 'todo' ? entity.dueAt ?? '' : '');
  const existingSchedule = entity?.kind === 'routine' ? entity.schedule : null;
  const [startDate, setStartDate] = useState(existingSchedule?.startDate ?? localDate(new Date().toISOString()));
  const [frequency, setFrequency] = useState<Schedule['frequency']>(existingSchedule?.frequency ?? 'daily');
  const [days, setDays] = useState<Weekday[]>(existingSchedule?.frequency === 'weekly' ? existingSchedule.weekdays : []);
  const [intervalDays, setIntervalDays] = useState(String(existingSchedule?.frequency === 'interval' ? existingSchedule.intervalDays : 2));
  async function save() {
    const shared = { title, description, difficulty };
    const schedule: Schedule = frequency === 'weekly'
      ? { version: 1, calendar: 'local', startDate, frequency, weekdays: days }
      : frequency === 'interval' ? { version: 1, calendar: 'local', startDate, frequency, intervalDays: Number(intervalDays) }
      : { version: 1, calendar: 'local', startDate, frequency: 'daily' };
    if (await onSave(kind === 'todo' ? { ...shared, kind, dueAt: dueAt || null } : { ...shared, kind, schedule })) onClose();
  }
  return <Modal visible transparent animationType="none" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={styles.backdrop}><View style={styles.dialog} accessibilityViewIsModal>
      <View style={styles.header}><Text accessibilityRole="header" style={styles.heading}>{entity ? '编辑事项' : '新建事项'}</Text><Button label="关闭" small disabled={busy} onPress={onClose} /></View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.options}><Button label="一次性事项" selected={kind === 'todo'} disabled={busy || !!entity} onPress={() => setKind('todo')} />
          <Button label="例行事项" selected={kind === 'routine'} disabled={busy || !!entity} onPress={() => setKind('routine')} /></View>
        <Text style={styles.label}>名称</Text><TextInput accessibilityLabel="事项名称" autoFocus value={title} onChangeText={setTitle} editable={!busy} maxLength={200} placeholder="必填" style={styles.input} />
        <Text style={styles.label}>描述</Text><TextInput accessibilityLabel="事项描述" value={description} onChangeText={setDescription} editable={!busy} multiline maxLength={4000} placeholder="可选" style={[styles.input, styles.description]} />
        <Text style={styles.label}>难度</Text><View style={styles.options}>{([null, 1, 2, 3, 4] as const).map(value =>
          <Button key={value ?? 'none'} label={value ? `${value} · ${difficultyNames[value]}` : '未设置'} accessibilityLabel={`难度：${difficultyNames[value ?? 0]}`} selected={difficulty === value} disabled={busy} small onPress={() => setDifficulty(value)} />)}</View>
        {kind === 'todo' ? <><Text style={styles.label}>截止日期</Text><View style={styles.dateRow}><View style={styles.dateInput}><DateField value={dueAt} onChange={setDueAt} disabled={busy} /></View>
          {!!dueAt && <Button label="清除日期" small disabled={busy} onPress={() => setDueAt('')} />}</View></>
          : <><Text style={styles.label}>日程</Text><View style={styles.options}>
            <Button label="每天" selected={frequency === 'daily'} disabled={busy} small onPress={() => setFrequency('daily')} />
            <Button label="每 N 天" selected={frequency === 'interval'} disabled={busy} small onPress={() => setFrequency('interval')} />
            <Button label="指定星期" selected={frequency === 'weekly'} disabled={busy} small onPress={() => setFrequency('weekly')} />
          </View>{frequency === 'weekly' && <View style={styles.options}>{weekdays.map(day => <Button key={day} label={dayNames[day]} selected={days.includes(day)} disabled={busy} small onPress={() => setDays(days.includes(day) ? days.filter(d => d !== day) : [...days, day])} />)}</View>}
          {frequency === 'interval' && <View style={styles.intervalRow}><Text style={styles.help}>每</Text><TextInput accessibilityLabel="间隔天数" value={intervalDays} onChangeText={setIntervalDays} editable={!busy} keyboardType="number-pad" maxLength={3} style={[styles.input, styles.intervalInput]} /><Text style={styles.help}>天（1–365）</Text></View>}
          <Text style={styles.label}>开始日期</Text><DateField label="开始日期" value={startDate} onChange={setStartDate} disabled={busy} />
          <Text style={styles.help}>以开始日期为日程起点，在指定的当天执行。完成后等待下一个有效日期，不随轮次确认提前出现。</Text></>}
      </ScrollView>
      <View style={styles.footer}><View style={styles.statusAction}>{entity && <Button kind="danger" disabled={busy}
        label={entity.kind === 'routine' ? entity.status === 'active' ? '停用例行事项' : '启用例行事项' : entity.status === 'cancelled' ? '恢复事项' : '取消事项'}
        onPress={() => { void onToggle().then(ok => { if (ok) onClose(); }); }} />}</View><Button label="保存" kind="primary" disabled={busy || !title.trim()} onPress={() => void save()} /></View>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.32)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 550, maxHeight: '92%', backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 60px rgba(0,0,0,0.16)' },
  header: { padding: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: '#ECEEF1', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 19, fontWeight: '600', color: '#202630' }, scroll: { flexShrink: 1 },
  form: { padding: 20, gap: 12 }, label: { fontSize: 13, color: '#404956', fontWeight: '500', marginBottom: -5 },
  input: { borderWidth: 1, borderColor: '#CCD1D8', borderRadius: 6, minHeight: 40, padding: 10, color: '#252B33', fontSize: 14 },
  description: { minHeight: 76, textAlignVertical: 'top' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, dateInput: { flex: 1, minWidth: 0 },
  intervalRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, intervalInput: { width: 70 },
  help: { fontSize: 12, lineHeight: 20, color: '#6A7280' }, error: { color: '#A53427', backgroundColor: '#FFF2F0', padding: 10, borderRadius: 6, fontSize: 13 },
  footer: { padding: 16, borderTopWidth: 1, borderColor: '#ECEEF1', flexDirection: 'row', alignItems: 'center', gap: 10 }, statusAction: { flex: 1 },
});
