import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { learnerTabs, type LearnerTabKey } from '../navigation/capabilities';

const glass = isLiquidGlassAvailable();
const BAR_HEIGHT = 70;
const ORB = 58;
const PAGE_BG = '#F4F6FA';

const icons: Record<LearnerTabKey, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  today: ['home', 'home-outline'],
  learn: ['book', 'book-outline'],
  data: ['documents', 'documents-outline'],
  ask: ['chatbubble-ellipses', 'chatbubble-ellipses-outline'],
  top: ['trophy', 'trophy-outline'],
};

function TabItem({
  routeKey,
  focused,
  onPress,
}: {
  routeKey: LearnerTabKey;
  focused: boolean;
  onPress: () => void;
}) {
  const rise = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(rise, { toValue: focused ? 1 : 0, useNativeDriver: true, damping: 14, stiffness: 180, mass: 0.8 }).start();
  }, [focused, rise]);

  const tab = learnerTabs.find((entry) => entry.key === routeKey);
  const label = tab ? t(tab.labelKey) : routeKey;
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -(ORB / 2 + 6)] });
  const scale = rise.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const idleOpacity = rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={t('tabs.a11y', { tab: label })}
      onPress={onPress}
      style={styles.item}
    >
      {/* Raised orb: the active destination "pops" out of the bar, notch faked with a page-coloured ring. */}
      <Animated.View pointerEvents="none" style={[styles.orbWrap, { transform: [{ translateY }, { scale }], opacity: rise }]}>
        <View style={styles.orbRing}>
          <View style={styles.orb}>
            <Ionicons color="#FFFFFF" name={icons[routeKey][0]} size={24} />
          </View>
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.idle, { opacity: idleOpacity }]}>
        <Ionicons color="#8A97A8" name={icons[routeKey][1]} size={22} />
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[styles.label, focused && styles.labelActive, { transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }] }]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * Floating pill tab bar (reference: "Modern Floating Navbar" kit): detached from the
 * screen edge, rounded, with the active destination raised in a navy orb. Liquid
 * Glass surface on iOS 26+, frosted white elsewhere.
 */
// Structural subset of @react-navigation/bottom-tabs' BottomTabBarProps (the package is
// nested under expo-router, so we type only what we use).
type TabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12) + 4;

  const items = state.routes.map((route, index) => {
    const focused = state.index === index;
    return (
      <TabItem
        key={route.key}
        routeKey={route.name as LearnerTabKey}
        focused={focused}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      />
    );
  });

  const Surface = glass ? GlassView : View;
  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: bottom }]}>
      <View style={styles.shadow}>
        <Surface
          {...(glass ? { glassEffectStyle: 'regular' as const, isInteractive: true, tintColor: 'rgba(255,255,255,0.62)' } : {})}
          style={[styles.bar, !glass && styles.barFallback]}
        >
          {items}
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', bottom: 0, left: 0, position: 'absolute', right: 0 },
  shadow: {
    borderRadius: BAR_HEIGHT / 2,
    marginHorizontal: 18,
    shadowColor: '#0F2849',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 12,
    width: undefined,
    alignSelf: 'stretch',
  },
  bar: {
    alignItems: 'flex-end',
    borderRadius: BAR_HEIGHT / 2,
    flexDirection: 'row',
    height: BAR_HEIGHT,
    overflow: 'visible',
    paddingHorizontal: 6,
  },
  barFallback: {
    backgroundColor: Platform.select({ ios: 'rgba(255,255,255,0.92)', default: '#FFFFFF' }),
    borderColor: 'rgba(22,58,107,0.08)',
    borderWidth: 1,
  },
  item: { alignItems: 'center', flex: 1, height: BAR_HEIGHT, justifyContent: 'center' },
  idle: { alignItems: 'center', height: 26, justifyContent: 'center', marginTop: -6 },
  orbWrap: { alignItems: 'center', position: 'absolute', top: (BAR_HEIGHT - ORB) / 2 },
  orbRing: {
    alignItems: 'center',
    backgroundColor: PAGE_BG,
    borderRadius: (ORB + 10) / 2,
    height: ORB + 10,
    justifyContent: 'center',
    width: ORB + 10,
  },
  orb: {
    alignItems: 'center',
    backgroundColor: '#163A6B',
    borderRadius: ORB / 2,
    height: ORB,
    justifyContent: 'center',
    shadowColor: '#163A6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    width: ORB,
    elevation: 8,
  },
  label: { color: '#8A97A8', fontSize: 11, fontWeight: '600', marginTop: 4 },
  labelActive: { color: '#163A6B', fontWeight: '800' },
});
