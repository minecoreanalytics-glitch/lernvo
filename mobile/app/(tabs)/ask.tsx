import { StyleSheet, Text } from 'react-native';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';

export default function AskScreen() {
  return <ScreenScaffold eyebrow="Knowledge assistant" title="Ask"><Text style={styles.copy}>Ask a work question and get an answer grounded in approved company knowledge.</Text></ScreenScaffold>;
}
const styles = StyleSheet.create({ copy: { color: '#476354', fontSize: 17, lineHeight: 25, marginTop: 18 } });
