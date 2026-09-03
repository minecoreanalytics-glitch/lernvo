import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Segmented control (pill track, white raised segment), with optional count badges. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; badge?: number }>;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>{option.label}</Text>
            {option.badge ? (
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>{option.badge > 99 ? '99+' : option.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: '#E4E8EF', borderRadius: 14, flexDirection: 'row', marginTop: 18, padding: 3 },
  segment: { alignItems: 'center', borderRadius: 12, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 40, paddingHorizontal: 8 },
  segmentSelected: { backgroundColor: '#FFFFFF', shadowColor: '#0F2849', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  label: { color: '#5C6B7E', fontSize: 14, fontWeight: '600' },
  labelSelected: { color: '#163A6B', fontWeight: '800' },
  badge: { backgroundColor: '#CDD3DE', borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1 },
  badgeSelected: { backgroundColor: '#163A6B' },
  badgeText: { color: '#2D3748', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  badgeTextSelected: { color: '#FFFFFF' },
});
