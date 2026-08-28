import { StyleSheet, Text } from 'react-native';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';

export default function LearnScreen() {
  return <ScreenScaffold eyebrow="Explore" title="Learn"><Text style={styles.copy}>Assignments, saved learning, and the catalog will live here.</Text></ScreenScaffold>;
}
const styles = StyleSheet.create({ copy: { color: '#476354', fontSize: 17, lineHeight: 25, marginTop: 18 } });
