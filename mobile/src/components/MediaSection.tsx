import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { t } from '../i18n';

type Props = {
  type: string;
  url: string;
  /** Absolute media URL already carrying the `?t=` media token. */
  authorizedUrl: string;
  onCompleted?: () => void;
};

function VideoBlock({ uri, onCompleted }: { uri: string; onCompleted?: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = 5;
  });
  const [fired, setFired] = useState(false);
  player.addListener('playToEnd', () => {
    if (!fired) {
      setFired(true);
      onCompleted?.();
    }
  });
  return <VideoView player={player} style={styles.video} nativeControls />;
}

function AudioBlock({ uri, onCompleted }: { uri: string; onCompleted?: () => void }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const [fired, setFired] = useState(false);
  if (status.didJustFinish && !fired) {
    setFired(true);
    onCompleted?.();
  }
  const pct = status.duration ? Math.min(100, (status.currentTime / status.duration) * 100) : 0;
  return (
    <View style={styles.audio}>
      <Pressable accessibilityRole="button" onPress={() => (status.playing ? player.pause() : player.play())} style={styles.playBtn}>
        <Ionicons color="#FFFFFF" name={status.playing ? 'pause' : 'play'} size={22} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
        <Text style={styles.time}>
          {Math.floor(status.currentTime / 60)}:{String(Math.floor(status.currentTime % 60)).padStart(2, '0')} / {Math.floor((status.duration || 0) / 60)}:{String(Math.floor((status.duration || 0) % 60)).padStart(2, '0')}
        </Text>
      </View>
    </View>
  );
}

/** Inline player for a module section: video, audio, PDF/slides; anything else opens in the browser. */
export function MediaSection({ type, url, authorizedUrl, onCompleted }: Props) {
  const [open, setOpen] = useState(false);
  const label = type === 'VIDEO' ? t('module.watch') : type === 'AUDIO' ? t('module.listen') : t('module.read');

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.launch}>
        <View style={styles.launchIcon}>
          <Ionicons color="#FFFFFF" name={type === 'VIDEO' ? 'play' : type === 'AUDIO' ? 'headset' : 'document'} size={22} />
        </View>
        <Text style={styles.launchText}>{label}</Text>
        <Ionicons color="#8A97A8" name="chevron-forward" size={18} />
      </Pressable>
    );
  }

  if (type === 'VIDEO') return <VideoBlock uri={authorizedUrl} onCompleted={onCompleted} />;
  if (type === 'AUDIO') return <AudioBlock uri={authorizedUrl} onCompleted={onCompleted} />;
  if (type === 'PDF' || type === 'PRESENTATION' || /\.pdf($|\?)/i.test(url)) {
    return (
      <View style={styles.webWrap}>
        <WebView source={{ uri: authorizedUrl }} style={styles.web} originWhitelist={['*']} allowsInlineMediaPlayback />
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(authorizedUrl)} style={styles.launch}>
      <Text style={styles.launchText}>{t('module.mediaUnavailable')}</Text>
      <Ionicons color="#8A97A8" name="open-outline" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  launch: { alignItems: 'center', backgroundColor: '#EEF4FB', borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 12, minHeight: 60, paddingHorizontal: 14 },
  launchIcon: { alignItems: 'center', backgroundColor: '#163A6B', borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  launchText: { color: '#163A6B', flex: 1, fontSize: 15, fontWeight: '800' },
  video: { aspectRatio: 16 / 9, backgroundColor: '#0E1116', borderRadius: 16, marginTop: 12, overflow: 'hidden', width: '100%' },
  audio: { alignItems: 'center', backgroundColor: '#163A6B', borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 12, padding: 14 },
  playBtn: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  track: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, height: 6, overflow: 'hidden' },
  fill: { backgroundColor: '#F5B700', borderRadius: 999, height: 6 },
  time: { color: '#CDE5FA', fontSize: 12, fontWeight: '700', marginTop: 6 },
  webWrap: { borderRadius: 16, height: 480, marginTop: 12, overflow: 'hidden' },
  web: { flex: 1 },
});
