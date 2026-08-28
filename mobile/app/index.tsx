import { StyleSheet, Text, View } from 'react-native';

export default function StartScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Lernvo
      </Text>
      <Text style={styles.subtitle}>Your daily learning starts here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F4F7F5',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#123B2A',
    fontSize: 36,
    fontWeight: '700',
  },
  subtitle: {
    color: '#385747',
    fontSize: 17,
    marginTop: 8,
  },
});
