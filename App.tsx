import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { randomUUID } from 'expo-crypto';
import { emptyState, type Action, type RealityRecord, type Task, type TaskStatus } from './src/domain/reality';
import { repository } from './src/storage/repository';

const statusLabel: Record<TaskStatus, string> = { todo: '未完成', completed: '已完成', cancelled: '已取消' };
const dateLabel = (value: string) => new Date(value).toLocaleString('zh-CN', {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

function Button({ label, onPress, disabled = false, subtle = false, accessibilityLabel }: {
  label: string; onPress: () => void; disabled?: boolean; subtle?: boolean; accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, subtle && styles.subtleButton,
      disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <Text style={[styles.buttonText, subtle && styles.subtleText]}>{label}</Text>
  </Pressable>;
}

function RecordRow({ record }: { record: RealityRecord }) {
  return <View style={styles.recordRow}>
    <Text style={[styles.tag, record.status === 'completed' && styles.completedTag]}>{statusLabel[record.status]}</Text>
    <View style={styles.recordContent}>
      <Text style={styles.recordTitle}>{record.title}</Text>
      {!!record.note && <Text style={styles.muted}>{record.note}</Text>}
    </View>
  </View>;
}

export default function App() {
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [tab, setTab] = useState<'tasks' | 'history'>('tasks');
  const inFlight = useRef(false);
  const { width } = useWindowDimensions();
  const wide = width >= 960;

  async function load() {
    setError('');
    try { setState(await repository.load()); setReady(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取本地记录，请重试。'); }
  }
  useEffect(() => { void load(); }, []);

  async function run(action: Action, feedback: string) {
    if (inFlight.current || !ready) return false;
    inFlight.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await repository.dispatch({ id: randomUUID(), at: new Date().toISOString(), action });
      setState(next); setMessage(feedback);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。');
      return false;
    } finally { inFlight.current = false; setBusy(false); }
  }

  function clearForm() { setTitle(''); setNote(''); setEditing(null); }
  async function save() {
    const action: Action = editing
      ? { type: 'edit', taskId: editing, title, note } : { type: 'create', title, note };
    if (await run(action, editing ? '修改已保存，本轮将使用最新记录。' : '事项已保存。')) clearForm();
  }
  function editTask(task: Task) {
    setEditing(task.id); setTitle(task.title); setNote(task.note); setMessage('');
  }

  const tasks = state.tasks.filter(task => !task.closed);
  const pendingCompletions = state.pending.filter(record => record.status === 'completed').length;
  const dirty = !!(editing || title || note);

  return <View style={styles.page}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={[styles.shell, width < 600 && styles.smallShell]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View><Text style={styles.brand}>TODO RPG</Text><Text style={styles.heading}>先把现实记下来。</Text></View>
        <Text style={styles.localBadge}>{busy ? '正在保存…' : ready ? '本地保存' : '正在打开…'}</Text>
      </View>
      <Text style={styles.intro}>一点点完成，按自己的节奏告一段落。</Text>

      <View style={styles.tabs}>
        <Button label="现实事项" subtle={tab !== 'tasks'} onPress={() => setTab('tasks')} />
        <Button label={`轮次记录 · ${state.turns.length}`} subtle={tab !== 'history'} onPress={() => setTab('history')} />
      </View>
      {!!error && <View style={styles.errorBox}>
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
        {!ready && <Button label="重新读取" subtle onPress={() => void load()} />}
      </View>}
      <Text accessibilityLiveRegion="polite" role="status" style={styles.feedback}>{message || ' '}</Text>

      {!ready && !error ? <ActivityIndicator color="#2E5B48" accessibilityLabel="正在读取记录" /> :
        tab === 'tasks' ? <View style={[styles.columns, wide && styles.wideColumns]}>
          <View style={styles.mainColumn}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{editing ? '编辑事项' : '记一件事'}</Text>
              <Text style={styles.inputLabel}>事项</Text>
              <TextInput accessibilityLabel="事项标题" placeholder="接下来想做什么？" value={title}
                onChangeText={setTitle} maxLength={200} editable={ready && !busy} style={styles.input}
                onSubmitEditing={() => { if (title.trim()) void save(); }} returnKeyType="done" />
              <Text style={styles.inputLabel}>备注 · 可选</Text>
              <TextInput accessibilityLabel="事项备注" placeholder="留下一点背景，或者完成后的感受" value={note}
                onChangeText={setNote} multiline maxLength={4000} editable={ready && !busy} style={[styles.input, styles.noteInput]} />
              <View style={styles.actions}>
                <Button label={editing ? '保存修改' : '添加事项'} disabled={!ready || busy || !title.trim()} onPress={() => void save()} />
                {dirty && <Button label={editing ? '取消编辑' : '清空输入'} subtle disabled={busy} onPress={clearForm} />}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>当前事项</Text><Text style={styles.muted}>{tasks.length} 件</Text></View>
              {!tasks.length && <View style={styles.empty}>
                <Text style={styles.emptyTitle}>给今天留一个小起点</Text><Text style={styles.muted}>添加事项后，就可以在这里记录完成情况。</Text>
              </View>}
              {tasks.map(task => <View key={task.id} style={styles.taskRow}>
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`完成：${task.title}`}
                  accessibilityState={{ checked: task.status === 'completed', disabled: busy || task.status === 'cancelled' }}
                  disabled={busy || task.status === 'cancelled'} style={styles.checkTarget}
                  onPress={() => void run({ type: 'status', taskId: task.id, status: task.status === 'completed' ? 'todo' : 'completed' },
                    task.status === 'completed' ? '已取消完成，本轮记录已更新。' : '已记录完成。提交前可以继续调整。')}>
                  <View style={[styles.checkbox, task.status === 'completed' && styles.checked]}>
                    <Text style={styles.checkmark}>{task.status === 'completed' ? '✓' : ''}</Text>
                  </View>
                </Pressable>
                <View style={styles.taskContent}>
                  <Text style={[styles.taskTitle, task.status !== 'todo' && styles.finishedTitle]}>{task.title}</Text>
                  {!!task.note && <Text style={styles.muted}>{task.note}</Text>}
                  <Text style={styles.small}>{statusLabel[task.status]} · {dateLabel(task.updatedAt)}</Text>
                  <View style={styles.actions}>
                    <Button label="编辑" accessibilityLabel={`编辑：${task.title}`} subtle disabled={busy || (dirty && editing !== task.id)} onPress={() => editTask(task)} />
                    <Button label={task.status === 'cancelled' ? '恢复事项' : '取消事项'} accessibilityLabel={task.status === 'cancelled' ? `恢复：${task.title}` : `取消事项：${task.title}`} subtle disabled={busy}
                      onPress={() => void run({ type: 'status', taskId: task.id, status: task.status === 'cancelled' ? 'todo' : 'cancelled' }, '事项状态已保存。')} />
                  </View>
                </View>
              </View>)}
            </View>
          </View>

          <View style={[styles.card, styles.roundColumn, wide && styles.roundWide]}>
            <Text style={styles.eyebrow}>按你的节奏</Text>
            <Text style={styles.sectionTitle}>第 {state.turns.length + 1} 轮 · 待提交</Text>
            <Text style={styles.roundCount}>{pendingCompletions}<Text style={styles.countUnit}> 件完成</Text></Text>
            <Text style={styles.muted}>本轮有 {state.pending.length} 条有效记录。确认前，仍可添加、修改或取消。</Text>
            <View style={styles.preview}>
              {state.pending.length ? state.pending.map(record => <RecordRow key={record.taskId} record={record} />)
                : <Text style={styles.muted}>你的下一条记录会出现在这里。</Text>}
            </View>
            <Button label="提交本轮" disabled={!ready || busy || dirty || !state.pending.length}
              onPress={() => void run({ type: 'submit' }, '本轮已提交，可以在轮次记录中查看。')} />
            <Text style={styles.small}>{dirty ? '请先保存或清空输入，再提交本轮。' : '提交后保留这一刻的记录，本版暂不支持撤回。'}</Text>
          </View>
        </View> : <View style={styles.history}>
          {!state.turns.length && <View style={[styles.card, styles.empty]}>
            <Text style={styles.emptyTitle}>还没有提交的轮次</Text><Text style={styles.muted}>在现实事项里完成记录，再按自己的节奏提交。</Text>
          </View>}
          {[...state.turns].reverse().map(turn => <View key={turn.id} style={styles.card}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>第 {turn.number} 轮</Text><Text style={styles.muted}>{dateLabel(turn.submittedAt)}</Text></View>
            <Text style={styles.small}>已提交 · {turn.records.filter(record => record.status === 'completed').length} 件完成 · {turn.records.length} 条记录</Text>
            {turn.records.map(record => <RecordRow key={record.id} record={record} />)}
          </View>)}
        </View>}
      <Text style={styles.footer}>记录保存在当前浏览器或设备，各端独立保存。</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F4EE' },
  shell: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 40, paddingTop: 56, gap: 12 },
  smallShell: { padding: 18, paddingTop: 52 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  brand: { fontSize: 12, fontWeight: '700', letterSpacing: 2.5, color: '#52725D', marginBottom: 14 },
  heading: { fontSize: 30, fontWeight: '700', color: '#243D30', lineHeight: 42 },
  localBadge: { fontSize: 12, color: '#41604B', backgroundColor: '#E4EBDF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  intro: { color: '#6A7268', fontSize: 15, lineHeight: 24 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  feedback: { color: '#2E5B48', fontSize: 13, minHeight: 22, lineHeight: 22 },
  columns: { gap: 22, alignItems: 'stretch' }, wideColumns: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { flex: 1, gap: 22, minWidth: 0 },
  card: { backgroundColor: '#FFFEFA', padding: 24, borderRadius: 18, borderWidth: 1, borderColor: '#E5E6DD', gap: 14 },
  sectionTitle: { color: '#2B4033', fontSize: 18, fontWeight: '600', lineHeight: 27 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  inputLabel: { color: '#5B665D', fontSize: 13, marginBottom: -6 },
  input: { borderWidth: 1, borderColor: '#D6DCD0', backgroundColor: '#FFF', borderRadius: 10, padding: 13, fontSize: 15, color: '#263B2D', minHeight: 48 },
  noteInput: { minHeight: 78, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2E5B48', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 15 },
  buttonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  subtleButton: { backgroundColor: '#EEF1E9' }, subtleText: { color: '#4A604E' },
  disabled: { opacity: 0.42 }, pressed: { opacity: 0.75 },
  taskRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#ECEDE5', paddingTop: 16, gap: 6 },
  taskContent: { flex: 1, gap: 8, minWidth: 0 }, taskTitle: { fontSize: 16, fontWeight: '500', color: '#293D30', lineHeight: 24 },
  finishedTitle: { color: '#737D70', textDecorationLine: 'line-through' },
  checkTarget: { width: 44, minHeight: 44, alignItems: 'center', paddingTop: 2 },
  checkbox: { width: 24, height: 24, borderWidth: 1.5, borderColor: '#A5B29F', borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: '#2E5B48', borderColor: '#2E5B48' }, checkmark: { color: '#FFF', fontSize: 17 },
  muted: { fontSize: 13, color: '#6B7568', lineHeight: 22 }, small: { fontSize: 12, color: '#7A8275', lineHeight: 20 },
  roundColumn: { gap: 18 }, roundWide: { width: 350 },
  eyebrow: { fontSize: 12, color: '#7A8069', letterSpacing: 1 }, roundCount: { fontSize: 46, color: '#2E5B48', fontWeight: '600' },
  countUnit: { fontSize: 15, fontWeight: '400', color: '#6B7568' }, preview: { gap: 10, paddingVertical: 6 },
  recordRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 },
  recordContent: { flex: 1, gap: 3, minWidth: 0 }, recordTitle: { fontSize: 14, color: '#3B4D3D', lineHeight: 22 },
  tag: { backgroundColor: '#EEF0E9', color: '#6D7766', fontSize: 11, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5 },
  completedTag: { backgroundColor: '#E3EFE2', color: '#2E5B48' },
  empty: { paddingVertical: 36, alignItems: 'center', gap: 10 }, emptyTitle: { fontSize: 17, color: '#566A53', textAlign: 'center' },
  history: { gap: 18 }, errorBox: { backgroundColor: '#FBECE8', padding: 16, borderRadius: 10, gap: 10 },
  errorText: { color: '#9A4432', lineHeight: 22 }, footer: { fontSize: 12, color: '#878D81', marginTop: 22, textAlign: 'center', lineHeight: 20 },
});
