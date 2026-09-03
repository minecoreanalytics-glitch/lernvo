import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { t } from '../i18n';
import { parseSlides, type BulletIcon } from '../slides/parseSlides';

const ICONS: Record<BulletIcon, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  target: { name: 'locate', color: '#FDBA74' },
  alert: { name: 'warning', color: '#FCD34D' },
  zap: { name: 'flash', color: '#93C5FD' },
  users: { name: 'people', color: '#A5B4FC' },
  chart: { name: 'stats-chart', color: '#6EE7B7' },
  shield: { name: 'shield-checkmark', color: '#FDA4AF' },
  lightbulb: { name: 'bulb', color: '#FDE68A' },
  check: { name: 'checkmark-circle', color: '#86EFAC' },
  book: { name: 'book', color: '#67E8F9' },
  arrow: { name: 'arrow-forward-circle', color: '#BFDBFE' },
};

const THEMES = ['#0F2849', '#14213D', '#0F3B2E', '#2A1B4D', '#0B3A44', '#3B1D2A'];

type Props = {
  body: string;
  completed?: boolean;
  onComplete?: () => void;
};

/** Native counterpart of the web SlideViewer: swipeable dark slides, bullets with icons, speaker note, completion on the last slide. */
export function SlideDeck({ body, completed, onComplete }: Props) {
  const slides = useMemo(() => parseSlides(body), [body]);
  const { width } = useWindowDimensions();
  const slideWidth = width - 40; // screen padding (20 each side)
  const scroller = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [showNote, setShowNote] = useState(false);

  if (slides.length === 0) return null;
  const isLast = current === slides.length - 1;
  const allVisited = visited.size >= slides.length;

  function goTo(index: number) {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    scroller.current?.scrollTo({ x: next * slideWidth, animated: true });
    setCurrent(next);
    setVisited((v) => new Set(v).add(next));
    setShowNote(false);
  }

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    if (index !== current) {
      setCurrent(index);
      setVisited((v) => new Set(v).add(index));
      setShowNote(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        style={{ width: slideWidth }}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slide, { width: slideWidth, backgroundColor: THEMES[index % THEMES.length] }]}>
            <View style={styles.blob} />
            <Text style={styles.counter}>{t('slides.of', { n: index + 1, total: slides.length })}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <View style={styles.bullets}>
              {slide.bullets.map((bullet, i) => {
                const icon = ICONS[slide.icons[i] ?? 'arrow'];
                return (
                  <View key={i} style={styles.bullet}>
                    <Ionicons color={icon.color} name={icon.name} size={18} style={styles.bulletIcon} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                );
              })}
            </View>
            {slide.presenterNote ? (
              <Pressable accessibilityRole="button" onPress={() => setShowNote((v) => !v)} style={styles.noteToggle}>
                <Ionicons color="#CDE5FA" name="chatbubble-ellipses-outline" size={16} />
                <Text style={styles.noteToggleText}>{t('slides.note')}</Text>
              </Pressable>
            ) : null}
            {slide.presenterNote && showNote && index === current ? <Text style={styles.note}>{slide.presenterNote}</Text> : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('slides.prev')} disabled={current === 0} onPress={() => goTo(current - 1)} style={[styles.navBtn, current === 0 && styles.navDisabled]}>
          <Ionicons color="#163A6B" name="chevron-back" size={20} />
        </Pressable>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <Pressable key={i} accessibilityRole="button" hitSlop={6} onPress={() => goTo(i)}>
              <View style={[styles.dot, i === current && styles.dotActive, visited.has(i) && i !== current && styles.dotVisited]} />
            </Pressable>
          ))}
        </View>
        {isLast ? (
          <Pressable
            accessibilityRole="button"
            disabled={!allVisited || completed || !onComplete}
            onPress={onComplete}
            style={[styles.finish, (!allVisited || completed || !onComplete) && styles.finishDisabled]}
          >
            <Text style={styles.finishText}>{completed ? t('module.done') : t('slides.finish')}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={t('slides.next')} onPress={() => goTo(current + 1)} style={styles.navBtn}>
            <Ionicons color="#163A6B" name="chevron-forward" size={20} />
          </Pressable>
        )}
      </View>
      {isLast && !allVisited ? <Text style={styles.hint}>{t('slides.seeAll')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  slide: { borderRadius: 22, minHeight: 300, overflow: 'hidden', padding: 22 },
  blob: { backgroundColor: '#F5B700', borderRadius: 999, height: 180, opacity: 0.12, position: 'absolute', right: -60, top: -80, width: 180 },
  counter: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.3, lineHeight: 28, marginTop: 10 },
  bullets: { gap: 12, marginTop: 18 },
  bullet: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  bulletIcon: { marginTop: 2 },
  bulletText: { color: '#E4E8EF', flex: 1, fontSize: 16, lineHeight: 23 },
  noteToggle: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 18 },
  noteToggleText: { color: '#CDE5FA', fontSize: 13, fontWeight: '700' },
  note: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 12, color: '#F7F8FA', fontSize: 14, lineHeight: 20, marginTop: 10, padding: 12 },
  controls: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 12 },
  navBtn: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  navDisabled: { opacity: 0.35 },
  dots: { alignItems: 'center', flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  dot: { backgroundColor: '#CDD3DE', borderRadius: 999, height: 7, width: 7 },
  dotVisited: { backgroundColor: '#7AADD9' },
  dotActive: { backgroundColor: '#163A6B', width: 20 },
  finish: { alignItems: 'center', backgroundColor: '#163A6B', borderRadius: 14, justifyContent: 'center', minHeight: 40, paddingHorizontal: 14 },
  finishDisabled: { opacity: 0.45 },
  finishText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  hint: { color: '#8A97A8', fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'right' },
});
