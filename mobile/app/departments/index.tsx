import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { web, type DepartmentFlat, type DepartmentMember } from '../../src/api/web';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { t } from '../../src/i18n';

function DepartmentCard({ dept, depth, members, onToggle, open, loadingMembers }: {
  dept: DepartmentFlat;
  depth: number;
  open: boolean;
  members: DepartmentMember[] | undefined;
  loadingMembers: boolean;
  onToggle: () => void;
}) {
  const accent = dept.color ?? '#1E4F8C';
  return (
    <View style={[styles.card, { marginLeft: depth * 16 }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.cardHead}>
        <View style={[styles.swatch, { backgroundColor: accent }]}>
          <Text style={styles.swatchText}>{dept.icon ?? dept.name.slice(0, 1)}</Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.title}>{dept.name}</Text>
          <Text style={styles.meta}>
            {t('dept.people', { count: dept._count.users })}
            {dept.managerName ? ` · ${t('dept.manager', { name: dept.managerName })}` : ''}
          </Text>
        </View>
        <Ionicons color="#9BA8BB" name={open ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {open ? (
        <View style={styles.members}>
          {dept.mission ? <Text style={styles.mission}>{dept.mission}</Text> : null}
          {loadingMembers ? <ActivityIndicator color="#1E4F8C" /> : null}
          {members?.map((m) => (
            <View key={m.id} style={styles.member}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{`${m.firstName[0] ?? ''}${m.lastName[0] ?? ''}`.toUpperCase()}</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={styles.memberName}>{m.firstName} {m.lastName}</Text>
                <Text style={styles.meta}>{m.role} · {m.totalPoints} pts</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Organization browser: department tree with members on demand (same data as the web org chart). */
export default function DepartmentsScreen() {
  const { data, error, loading, reload } = useAsync(() => web.departments(), []);
  const [open, setOpen] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, DepartmentMember[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggle(id: string) {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    if (!members[id]) {
      setLoadingId(id);
      try {
        const rows = await web.departmentMembers(id);
        setMembers((current) => ({ ...current, [id]: rows }));
      } catch {
        setMembers((current) => ({ ...current, [id]: [] }));
      } finally {
        setLoadingId(null);
      }
    }
  }

  // Flatten the tree in display order (parents first, then their children).
  const ordered: Array<{ dept: DepartmentFlat; depth: number }> = [];
  if (data) {
    const byParent = new Map<string | null, DepartmentFlat[]>();
    for (const d of data) byParent.set(d.parentId, [...(byParent.get(d.parentId) ?? []), d]);
    const walk = (parentId: string | null, depth: number) => {
      for (const d of (byParent.get(parentId) ?? []).sort((a, b) => a.order - b.order)) {
        ordered.push({ dept: d, depth });
        walk(d.id, depth + 1);
      }
    };
    walk(null, 0);
    // Orphans whose parent is not visible to this user.
    const seen = new Set(ordered.map((o) => o.dept.id));
    for (const d of data) if (!seen.has(d.id)) ordered.push({ dept: d, depth: 0 });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: t('dept.title') }} />
      <ScreenScaffold eyebrow={t('dept.eyebrow')} title={t('dept.title')} onRefresh={reload}>
        <StatusCopy loading={loading} error={error} onRetry={() => void reload()} />
        {data && data.length === 0 ? <Text style={styles.copy}>{t('dept.empty')}</Text> : null}
        {ordered.map(({ dept, depth }) => (
          <DepartmentCard
            key={dept.id}
            dept={dept}
            depth={Math.min(depth, 2)}
            open={open === dept.id}
            members={members[dept.id]}
            loadingMembers={loadingId === dept.id}
            onToggle={() => void toggle(dept.id)}
          />
        ))}
      </ScreenScaffold>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, marginTop: 12, padding: 14, shadowColor: '#0F2849', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  swatch: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  swatchText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  cardText: { flex: 1 },
  title: { color: '#0F1923', fontSize: 16, fontWeight: '800' },
  meta: { color: '#6B7A8D', fontSize: 13, marginTop: 3 },
  members: { borderTopColor: '#F0F2F5', borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  mission: { color: '#4A5568', fontSize: 14, lineHeight: 21, marginBottom: 8 },
  member: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 8 },
  avatar: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  avatarText: { color: '#163A6B', fontSize: 13, fontWeight: '800' },
  memberName: { color: '#1A202C', fontSize: 15, fontWeight: '700' },
});
