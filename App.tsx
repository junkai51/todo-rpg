import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { randomUUID } from 'expo-crypto';
import { emptyState, isCompletion, type Action, type EditorInput, type Routine, type Todo } from './src/domain/reality';
import { todayItems } from './src/domain/today';
import { scheduleLabel } from './src/domain/schedule';
import { repository } from './src/storage/repository';
import { Button } from './src/ui/Button';
import { RealityEditor } from './src/ui/RealityEditor';
import { TodayList } from './src/ui/TodayList';
import { DebugPanel } from './src/ui/DebugPanel';

export default function App() {
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [editor, setEditor] = useState<{ entity: Todo | Routine | null } | null>(null);
  const [sorting, setSorting] = useState(false), [showEnded, setShowEnded] = useState(true);
  const [showDebug, setShowDebug] = useState(false), [manage, setManage] = useState(false);
  const [at, setAt] = useState(() => new Date().toISOString());
  const inFlight = useRef(false);
  const { width } = useWindowDimensions();
  async function load() {
    setError('');
    try { setState(await repository.load()); setReady(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '读取失败，请重试。'); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refreshClock() {
      clearTimeout(timer);
      const now = new Date(); setAt(now.toISOString());
      const next = new Date(now); next.setHours(24, 0, 0, 0);
      timer = setTimeout(refreshClock, Math.min(next.getTime() - now.getTime() + 20, 60_000));
    }
    refreshClock();
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') refreshClock(); });
    // React Native defines window too, but it does not provide DOM event listeners.
    const browserWindow = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    browserWindow?.addEventListener('focus', refreshClock);
    return () => {
      clearTimeout(timer);
      subscription.remove();
      browserWindow?.removeEventListener('focus', refreshClock);
    };
  }, []);
  async function run(action: Action, feedback: string) {
    if (inFlight.current || (!ready && action.type !== 'reset')) return false;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try { const now = new Date().toISOString(); setAt(now); setState(await repository.dispatch({ id: randomUUID(), at: now, action })); setReady(true); setMessage(feedback); return true; }
    catch (cause) { setAt(new Date().toISOString()); setError(cause instanceof Error ? cause.message : '保存失败，请重试。'); return false; }
    finally { inFlight.current = false; setBusy(false); }
  }
  function openEditor(entity: Todo | Routine | null) {
    const current = entity?.kind === 'routine' ? state.routines.find(x => x.id === entity.id) ?? entity : entity;
    setError(''); setMessage(''); setEditor({ entity: current });
  }
  function save(input: EditorInput) {
    const entity = editor?.entity;
    if (input.kind === 'todo') return run(entity ? { type: 'editTodo', id: entity.id, input } : { type: 'createTodo', input }, '已保存。');
    return run(entity ? { type: 'editRoutine', id: entity.id, input } : { type: 'createRoutine', input }, '已保存。');
  }
  function toggleEntity() {
    const entity = editor?.entity;
    if (!entity) return Promise.resolve(false);
    return run(entity.kind === 'todo' ? { type: 'todoStatus', id: entity.id, status: entity.status === 'cancelled' ? 'todo' : 'cancelled' }
      : { type: 'routineStatus', id: entity.id, status: entity.status === 'active' ? 'stopped' : 'active' }, '已保存。');
  }
  const items = todayItems(state, at);
  const endedCount = items.filter(item => item.status !== 'todo').length;
  return <View style={styles.page}><StatusBar style="dark" />
    <ScrollView contentContainerStyle={[styles.shell, width < 600 && styles.smallShell]} keyboardShouldPersistTaps="handled">
      <View style={styles.headingRow}><View style={styles.headingGroup}><Text style={styles.heading}>Today</Text><Text style={styles.count}>{items.length - endedCount} 项待办</Text></View>
        <Button label="新建事项" kind="primary" disabled={!ready || busy} onPress={() => openEditor(null)} /></View>
      <View style={styles.toolbar}>
        <Button label={manage ? '返回 Today' : `例行事项（${state.routines.length}）`} small selected={manage} onPress={() => setManage(!manage)} />
        {!manage && <><Button label={sorting ? '结束排序' : '调整排序'} selected={sorting} small disabled={busy || !items.length} onPress={() => setSorting(!sorting)} />
          <Button label={`${showEnded ? '隐藏' : '显示'}已结束（${endedCount}）`} small onPress={() => setShowEnded(!showEnded)} /></>}
        {__DEV__ && <View style={styles.debugButton}><Button label={showDebug ? '关闭调试' : '调试'} small onPress={() => setShowDebug(!showDebug)} /></View>}
      </View>
      {!!error && !editor && <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{!ready && <Button label="重新读取" onPress={() => void load()} />}</View>}
      <Text role="status" accessibilityLiveRegion="polite" style={styles.feedback}>{busy ? '保存中…' : message || ' '}</Text>
      {!ready && !error ? <ActivityIndicator /> : manage ? <View style={{ gap: 8 }}>
        {!state.routines.length && <Text style={styles.summary}>暂无例行事项</Text>}
        {[...state.routines].sort((a, b) => a.position - b.position).map(routine => <View key={routine.id} style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DFE3E8', borderRadius: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1}>{routine.title}</Text><Text style={styles.summary}>{scheduleLabel(routine.schedule)} · {routine.status === 'active' ? '启用' : '停用'} · {routine.schedule.startDate} 起</Text></View>
          <Button label="编辑" accessibilityLabel={`编辑：${routine.title}`} small disabled={busy} onPress={() => openEditor(routine)} /></View>)}
      </View> : <TodayList items={showEnded ? items : items.filter(item => item.status === 'todo')} at={at} busy={busy} sorting={sorting} onEdit={openEditor} onAction={(action, feedback) => { void run(action, feedback); }} />}
      <View style={styles.confirmRow}><Text style={styles.summary}>待确认完成 {state.pending.filter(isCompletion).length} 项</Text><Button label="确认本轮" disabled={!ready || busy || !state.pending.length} onPress={() => void run({ type: 'submit' }, '本轮已确认。')} /></View>
      {__DEV__ && showDebug && <DebugPanel state={state} at={at} busy={busy} onReset={() => { void run({ type: 'reset' }, '全部记录已清空。'); }} />}
    </ScrollView>
    {editor && <RealityEditor key={editor.entity?.id ?? 'new'} entity={editor.entity} busy={busy} error={error} onClose={() => { setEditor(null); setError(''); }} onSave={save} onToggle={toggleEntity} />}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7F8FA' }, shell: { width: '100%', maxWidth: 1020, alignSelf: 'center', padding: 36, paddingTop: 44, gap: 12 },
  smallShell: { padding: 14, paddingTop: 28 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  headingGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 12 }, heading: { fontSize: 25, fontWeight: '600', color: '#252C35' },
  count: { fontSize: 12, color: '#78818D' }, toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, debugButton: { marginLeft: 'auto' },
  feedback: { minHeight: 18, lineHeight: 18, fontSize: 12, color: '#58697C', marginVertical: -4 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  summary: { fontSize: 12, color: '#697482' }, errorBox: { gap: 10, padding: 12, backgroundColor: '#FFF2F0', borderRadius: 6 },
  error: { color: '#A53427', fontSize: 13, lineHeight: 20 },
});
