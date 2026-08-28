import { StyleSheet, Text } from 'react-native';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';

export default function InboxScreen() {
  return <ScreenScaffold eyebrow="Updates" title="Inbox"><Text style={styles.copy}>Announcements, assignments, and required acknowledgements will arrive here.</Text></ScreenScaffold>;
}
const styles = StyleSheet.create({ copy: { color: '#476354', fontSize: 17, lineHeight: 25, marginTop: 18 } });
