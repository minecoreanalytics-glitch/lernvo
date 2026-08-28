import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useStore } from 'zustand';

import { authStore } from '../../src/auth/authRuntime';

export default function SignInScreen() {
  const { status, error, signIn } = useStore(authStore);
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const busy = status === 'signingIn';

  if (status === 'authenticated') return <Redirect href="/" />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Lernvo</Text>
        <Text style={styles.intro}>A few focused minutes, built for your work.</Text>

        <Text style={styles.label}>Company</Text>
        <TextInput
          accessibilityLabel="Company"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          onChangeText={setTenantSlug}
          placeholder="company-name"
          style={styles.input}
          value={tenantSlug}
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
          keyboardType="email-address"
          onChangeText={setEmail}
          style={styles.input}
          value={email}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          autoComplete="current-password"
          editable={!busy}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy || !tenantSlug.trim() || !email.trim() || !password}
          onPress={() => void signIn({ tenantSlug, email, password }).catch(() => undefined)}
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Continue</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F4F7F5', flex: 1, justifyContent: 'center', padding: 24 },
  card: { alignSelf: 'center', maxWidth: 480, width: '100%' },
  title: { color: '#123B2A', fontSize: 38, fontWeight: '800' },
  intro: { color: '#476354', fontSize: 17, lineHeight: 24, marginBottom: 32, marginTop: 8 },
  label: { color: '#183D2D', fontSize: 14, fontWeight: '600', marginBottom: 7, marginTop: 14 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#B9C9C0', borderRadius: 12, borderWidth: 1, color: '#10281D', fontSize: 17, minHeight: 52, paddingHorizontal: 15 },
  error: { color: '#A52A2A', fontSize: 14, marginTop: 16 },
  button: { alignItems: 'center', backgroundColor: '#146B45', borderRadius: 14, justifyContent: 'center', marginTop: 24, minHeight: 54 },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
