import { Pressable, StyleSheet, Text } from 'react-native';

export function Button({ label, onPress, disabled = false, kind = 'secondary', small = false, accessibilityLabel, selected }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'danger';
  small?: boolean; accessibilityLabel?: string; selected?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled }} aria-pressed={selected} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, small && styles.small, kind === 'primary' && styles.primary,
      kind === 'danger' && styles.danger, selected && styles.selected, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={[styles.text, kind === 'primary' && styles.primaryText, kind === 'danger' && styles.dangerText]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 38, borderRadius: 6, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#F2F3F5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E3E5E8' },
  small: { minHeight: 30, paddingVertical: 4, paddingHorizontal: 9 },
  text: { color: '#3F4650', fontSize: 13, fontWeight: '500' },
  primary: { backgroundColor: '#344A63', borderColor: '#344A63' }, primaryText: { color: '#FFF' },
  danger: { backgroundColor: '#FFF5F4', borderColor: '#F2CFCA' }, dangerText: { color: '#A53427' },
  selected: { backgroundColor: '#E6EDF5', borderColor: '#7E96B2' }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72 },
});
