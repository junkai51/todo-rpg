export type TaskStatus = 'todo' | 'completed' | 'cancelled';

export type Task = {
  id: string;
  title: string;
  note: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  closed: boolean;
};

export type RealityRecord = {
  id: string;
  taskId: string;
  title: string;
  note: string;
  status: TaskStatus;
  recordedAt: string;
  completedAt: string | null;
};

export type RealityTurn = {
  id: string;
  number: number;
  submittedAt: string;
  records: RealityRecord[];
};

export type RealityState = {
  version: 1;
  tasks: Task[];
  pending: RealityRecord[];
  turns: RealityTurn[];
};

export type Action =
  | { type: 'create'; title: string; note: string }
  | { type: 'edit'; taskId: string; title: string; note: string }
  | { type: 'status'; taskId: string; status: TaskStatus }
  | { type: 'submit' };

export type Command = { id: string; at: string; action: Action };

export const emptyState = (): RealityState => ({ version: 1, tasks: [], pending: [], turns: [] });

function checkedTitle(title: string): string {
  const value = title.trim();
  if (!value) throw new Error('请先填写事项标题。');
  if (value.length > 200) throw new Error('事项标题请控制在 200 字以内。');
  return value;
}

export function applyCommand(state: RealityState, command: Command): RealityState {
  const { action, at, id } = command;
  if (action.type === 'submit') {
    if (state.turns.some(turn => turn.id === id)) return state;
    if (!state.pending.length) return state;
    const closingIds = new Set(state.pending.filter(r => r.status !== 'todo').map(r => r.taskId));
    return {
      ...state,
      tasks: state.tasks.map(task => closingIds.has(task.id) ? { ...task, closed: true } : task),
      pending: [],
      turns: [...state.turns, {
        id, number: state.turns.length + 1, submittedAt: at,
        records: state.pending.map(record => ({ ...record })),
      }],
    };
  }

  let task: Task;
  if (action.type === 'create') {
    if (state.tasks.some(item => item.id === id)) return state;
    task = {
      id, title: checkedTitle(action.title), note: action.note.trim(), status: 'todo',
      createdAt: at, updatedAt: at, completedAt: null, closed: false,
    };
  } else {
    const existing = state.tasks.find(item => item.id === action.taskId);
    if (!existing) throw new Error('这条事项已不存在，请刷新后重试。');
    if (existing.closed) throw new Error('这条记录已提交，本版暂不支持修改或撤回。');
    task = action.type === 'edit'
      ? { ...existing, title: checkedTitle(action.title), note: action.note.trim(), updatedAt: at }
      : {
        ...existing, status: action.status, updatedAt: at,
        completedAt: action.status === 'completed' ? (existing.completedAt ?? at) : null,
      };
  }

  const record: RealityRecord = {
    id, taskId: task.id, title: task.title, note: task.note, status: task.status,
    recordedAt: at, completedAt: task.completedAt,
  };
  return {
    ...state,
    tasks: action.type === 'create' ? [...state.tasks, task]
      : state.tasks.map(item => item.id === task.id ? task : item),
    // Pending records describe the latest reality, not the number of clicks.
    pending: [...state.pending.filter(item => item.taskId !== task.id), record],
  };
}

export function readStoredState(value: unknown): RealityState {
  if (value === undefined || value === null) return emptyState();
  const state = value as RealityState;
  if (state.version !== 1 || !Array.isArray(state.tasks)
    || !Array.isArray(state.pending) || !Array.isArray(state.turns)) {
    throw new Error('本地记录的格式无法读取。请保留站点数据，勿清空后重试。');
  }
  return state;
}
