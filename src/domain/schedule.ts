export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Schedule = {
  version: 1; calendar: 'local'; startDate: string;
} & ({ frequency: 'daily' } | { frequency: 'weekly'; weekdays: Weekday[] } | { frequency: 'interval'; intervalDays: number });

export function checkedDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('日期无效，请使用 YYYY-MM-DD。');
  return value;
}
export function localDate(at: string): string {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) throw new Error('时间无效。');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validateSchedule(input: Schedule): Schedule {
  checkedDate(input.startDate);
  if (input.version !== 1 || input.calendar !== 'local') throw new Error('不支持此日程格式。');
  if (input.frequency === 'daily') return { version: 1, calendar: 'local', startDate: input.startDate, frequency: 'daily' };
  if (input.frequency === 'interval') {
    if (!Number.isInteger(input.intervalDays) || input.intervalDays < 1 || input.intervalDays > 365) throw new Error('重复间隔须为 1–365 天。');
    return { version: 1, calendar: 'local', startDate: input.startDate, frequency: 'interval', intervalDays: input.intervalDays };
  }
  if (input.frequency === 'weekly' && input.weekdays.length && input.weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return { version: 1, calendar: 'local', startDate: input.startDate, frequency: 'weekly', weekdays: [...new Set(input.weekdays)].sort() };
  }
  throw new Error('请选择有效的日程和至少一个星期。');
}
export function matchesSchedule(schedule: Schedule, date: string): boolean {
  checkedDate(date);
  if (date < schedule.startDate) return false;
  if (schedule.frequency === 'daily') return true;
  if (schedule.frequency === 'interval') {
    // Compare calendar dates, not elapsed local hours (which vary with DST).
    const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${schedule.startDate}T00:00:00Z`)) / 86400000;
    return days % schedule.intervalDays === 0;
  }
  return schedule.weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay() as Weekday);
}
export function dayWindow(date: string) {
  checkedDate(date);
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { date, startsAt: start.toISOString(), endsAt: end.toISOString() };
}
export function scheduleLabel(schedule: Schedule): string {
  if (schedule.frequency === 'daily') return '每天';
  if (schedule.frequency === 'interval') return `每 ${schedule.intervalDays} 天`;
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  return `每周${[...schedule.weekdays].sort((a, b) => (a || 7) - (b || 7)).map(d => names[d]).join('、')}`;
}
