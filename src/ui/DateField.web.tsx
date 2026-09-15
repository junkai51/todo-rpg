export function DateField({ value, onChange, disabled, label = '截止日期' }: { value: string; onChange: (value: string) => void; disabled?: boolean; label?: string }) {
  return <input aria-label={label} type="date" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
    style={{ boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 40, padding: '8px 10px', border: '1px solid #CCD1D8', borderRadius: 6, color: '#252B33', background: disabled ? '#F5F6F7' : '#FFF', font: 'inherit', fontSize: 14 }} />;
}
