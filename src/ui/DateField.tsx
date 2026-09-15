import { TextInput } from 'react-native';
export function DateField({ value, onChange, disabled, label = '截止日期' }: { value: string; onChange: (value: string) => void; disabled?: boolean; label?: string }) {
  return <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
    placeholder="YYYY-MM-DD" autoCapitalize="none" keyboardType="numbers-and-punctuation"
    style={{ minHeight: 40, borderWidth: 1, borderColor: '#CCD1D8', borderRadius: 6, padding: 10, fontSize: 14 }} />;
}
