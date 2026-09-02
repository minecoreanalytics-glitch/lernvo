import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useStore } from 'zustand';

import { authStore } from '../../src/auth/authRuntime';
import { AuthTransportError, type TenantChoice } from '../../src/auth/authTransport';
import { t } from '../../src/i18n';

const markChip = require('../../assets/brand/mark-chip.png');

export default function SignInScreen() {
  const { status, error, signIn } = useStore(authStore);
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenants, setTenants] = useState<TenantChoice[]>([]);
  const busy = status === 'signingIn';

  function submit(nextTenant = tenantSlug) {
    setTenants([]);
    void signIn({ tenantSlug: nextTenant.trim().toLowerCase(), email: email.trim(), password }).catch((caught) => {
      if (caught instanceof AuthTransportError && caught.needTenant) {
        setTenants(caught.tenants);
      }
    });
  }

  if (status === 'authenticated') return <Redirect href="/" />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <Image accessibilityIgnoresInvertColors source={markChip} style={styles.mark} />
            <Text accessibilityRole="header" style={styles.title}>lernvo</Text>
          </View>
          <Text style={styles.intro}>{t('signIn.intro')}</Text>

          <Text style={styles.label}>{t('signIn.company')}</Text>
          <TextInput
            accessibilityLabel={t('signIn.company')}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setTenantSlug}
            placeholder={t('signIn.companyPlaceholder')}
            placeholderTextColor="#9BA8BB"
            style={styles.input}
            value={tenantSlug}
          />
          <Text style={styles.label}>{t('signIn.email')}</Text>
          <TextInput
            accessibilityLabel={t('signIn.email')}
            autoCapitalize="none"
            autoComplete="email"
            editable={!busy}
            keyboardType="email-address"
            onChangeText={setEmail}
            style={styles.input}
            value={email}
          />
          <Text style={styles.label}>{t('signIn.password')}</Text>
          <TextInput
            accessibilityLabel={t('signIn.password')}
            autoComplete="current-password"
            editable={!busy}
            onChangeText={setPassword}
            onSubmitEditing={() => submit()}
            returnKeyType="go"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {tenants.length > 0 ? (
            <View>
              <Text style={styles.label}>{t('signIn.selectCompany')}</Text>
              {tenants.map((tenant) => (
                <Pressable
                  key={tenant.slug}
                  accessibilityRole="button"
                  onPress={() => {
                    setTenantSlug(tenant.slug);
                    submit(tenant.slug);
                  }}
                  style={styles.tenant}
                >
                  <Text style={styles.tenantText}>{tenant.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={busy || !email.trim() || !password}
            onPress={() => submit()}
            style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('signIn.continue')}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F7F8FA', flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { alignSelf: 'center', maxWidth: 480, width: '100%' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  mark: { borderRadius: 12, height: 48, width: 48 },
  title: { color: '#163A6B', fontSize: 38, fontWeight: '800', letterSpacing: -1.5 },
  intro: { color: '#5C6B7E', fontSize: 17, lineHeight: 24, marginBottom: 32, marginTop: 10 },
  label: { color: '#2D3748', fontSize: 14, fontWeight: '600', marginBottom: 7, marginTop: 14 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E4E8EF', borderRadius: 12, borderWidth: 1, color: '#1A202C', fontSize: 17, minHeight: 52, paddingHorizontal: 15 },
  error: { color: '#B42318', fontSize: 14, marginTop: 16 },
  button: { alignItems: 'center', backgroundColor: '#1E4F8C', borderRadius: 14, justifyContent: 'center', marginTop: 24, minHeight: 54 },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  tenant: { backgroundColor: '#FFFFFF', borderColor: '#E4E8EF', borderRadius: 12, borderWidth: 1, marginTop: 8, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  tenantText: { color: '#163A6B', fontSize: 16, fontWeight: '700' },
});
