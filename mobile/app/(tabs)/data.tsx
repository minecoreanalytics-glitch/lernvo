import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { learnerApi } from '../../src/api/learner';
import { web, type SearchPayload } from '../../src/api/web';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { Segmented } from '../../src/components/Segmented';
import { StatusCopy } from '../../src/components/StatusCopy';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, t } from '../../src/i18n';

type Segment = 'docs' | 'pricing';

/** "Données": approved documents, pricing grids and cross-content search, same sources as the web. */
export default function DataScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('docs');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchPayload | null>(null);
  const [brand, setBrand] = useState<string | undefined>(undefined);
  const docs = useAsync(() => learnerApi.kb(), []);
  const pricing = useAsync(() => web.pricing(brand), [brand]);
  const alerts = useAsync(() => web.pricingAlerts().catch(() => ({ alerts: [] })), []);
  const active = segment === 'docs' ? docs : pricing;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      web.search(q).then(setResults).catch(() => setResults(null));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const hasResults = results && (results.modules.length + results.articles.length + results.departments.length + results.paths.length > 0);

  return (
    <ScreenScaffold accountBar eyebrow={t('data.eyebrow')} title={t('data.title')} onRefresh={() => Promise.all([docs.reload(), pricing.reload()])}>
      <View style={styles.search}>
        <Ionicons color="#6B7A8D" name="search" size={18} />
        <TextInput
          accessibilityLabel={t('search.placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor="#9BA8BB"
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
      </View>

      {query.trim().length >= 2 ? (
        <View style={styles.results}>
          {!hasResults ? <Text style={styles.copy}>{t('search.empty', { q: query.trim() })}</Text> : null}
          {results?.modules.map((m) => (
            <Pressable key={`m-${m.id}`} accessibilityRole="button" onPress={() => router.push(`/module/${m.id}` as Href)} style={styles.result}>
              <Ionicons color="#1E4F8C" name="book" size={18} />
              <View style={styles.resultText}><Text style={styles.resultKicker}>{t('search.modules')}</Text><Text style={styles.resultTitle}>{m.title}</Text></View>
            </Pressable>
          ))}
          {results?.articles.map((a) => (
            <Pressable key={`a-${a.id}`} accessibilityRole="button" onPress={() => router.push(`/kb/${a.id}` as Href)} style={styles.result}>
              <Ionicons color="#0D8F8A" name="document-text" size={18} />
              <View style={styles.resultText}><Text style={styles.resultKicker}>{t('search.articles')}</Text><Text style={styles.resultTitle}>{a.title}</Text></View>
            </Pressable>
          ))}
          {results?.paths.map((p) => (
            <Pressable key={`p-${p.id}`} accessibilityRole="button" onPress={() => router.push(`/career/${p.id}` as Href)} style={styles.result}>
              <Ionicons color="#7C5CFC" name="git-branch" size={18} />
              <View style={styles.resultText}><Text style={styles.resultKicker}>{t('search.paths')}</Text><Text style={styles.resultTitle}>{p.title}</Text></View>
            </Pressable>
          ))}
          {results?.departments.map((d) => (
            <Pressable key={`d-${d.id}`} accessibilityRole="button" onPress={() => router.push('/departments' as Href)} style={styles.result}>
              <Ionicons color="#B45309" name="business" size={18} />
              <View style={styles.resultText}><Text style={styles.resultKicker}>{t('search.departments')}</Text><Text style={styles.resultTitle}>{d.name}</Text></View>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Segmented
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'docs', label: t('pricing.segmentDocs'), badge: docs.data?.articles.length },
              { value: 'pricing', label: t('pricing.segmentPricing'), badge: alerts.data?.alerts.length },
            ]}
          />
          <StatusCopy loading={active.loading} error={active.error} onRetry={() => void active.reload()} />

          {segment === 'docs' ? (
            <>
              {docs.data && docs.data.articles.length === 0 ? <Text style={styles.copy}>{t('docs.empty')}</Text> : null}
              {docs.data?.articles.map((article) => (
                <Pressable key={article.id} accessibilityRole="button" onPress={() => router.push(`/kb/${article.id}` as Href)} style={styles.card}>
                  {article.category ? <Text style={styles.kicker}>{article.category}</Text> : null}
                  <Text style={styles.cardTitle}>{article.title}</Text>
                  <View style={styles.tags}>
                    {article.tags.slice(0, 3).map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
                    <Text style={styles.updated}>{formatDate(article.updatedAt)}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              {alerts.data?.alerts.map((alert) => (
                <View key={alert.id} style={styles.alert}>
                  <Ionicons color="#B45309" name="pricetag" size={18} />
                  <View style={styles.resultText}>
                    <Text style={styles.alertKicker}>{t('pricing.alert')} · {alert.brand} · {formatDate(alert.createdAt)}</Text>
                    <Text style={styles.alertText}>{alert.summary}</Text>
                  </View>
                </View>
              ))}
              {pricing.data && pricing.data.brands.length > 1 ? (
                <View style={styles.brands}>
                  <Pressable accessibilityRole="button" onPress={() => setBrand(undefined)} style={[styles.brandChip, !brand && styles.brandChipOn]}>
                    <Text style={[styles.brandText, !brand && styles.brandTextOn]}>{t('pricing.allBrands')}</Text>
                  </Pressable>
                  {pricing.data.brands.map((b) => (
                    <Pressable key={b.brand} accessibilityRole="button" onPress={() => setBrand(b.brand)} style={[styles.brandChip, brand === b.brand && styles.brandChipOn]}>
                      <Text style={[styles.brandText, brand === b.brand && styles.brandTextOn]}>{b.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {pricing.data && pricing.data.categories.length === 0 ? <Text style={styles.copy}>{t('pricing.empty')}</Text> : null}
              {pricing.data?.categories.map((cat) => (
                <View key={cat.id} style={styles.card}>
                  <Text style={styles.kicker}>{cat.brand}</Text>
                  <Text style={styles.cardTitle}>{cat.name}</Text>
                  {cat.items.map((item) => (
                    <View key={item.id} style={styles.priceRow}>
                      <View style={styles.resultText}>
                        <Text style={styles.priceName}>{item.serviceName}</Text>
                        {item.description ? <Text style={styles.priceDesc} numberOfLines={2}>{item.description}</Text> : null}
                        {item.features.length > 0 ? <Text style={styles.priceDesc} numberOfLines={2}>{item.features.join(' · ')}</Text> : null}
                      </View>
                      <View style={styles.priceTag}>
                        <Text style={styles.price}>{item.price}</Text>
                        <Text style={styles.priceUnit}>{item.currency}{item.unit ? ` / ${item.unit}` : ''}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  search: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, flexDirection: 'row', gap: 10, marginTop: 18, minHeight: 52, paddingHorizontal: 16, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  searchInput: { color: '#1A202C', flex: 1, fontSize: 16, minHeight: 52 },
  results: { marginTop: 12 },
  result: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 8, minHeight: 56, paddingHorizontal: 14 },
  resultText: { flex: 1 },
  resultKicker: { color: '#8A97A8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  resultTitle: { color: '#1A202C', fontSize: 15, fontWeight: '700' },
  copy: { color: '#5C6B7E', fontSize: 17, lineHeight: 25, marginTop: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, marginTop: 14, padding: 18, shadowColor: '#0F2849', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  kicker: { color: '#1E4F8C', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: '#0F1923', fontSize: 19, fontWeight: '800', marginTop: 6 },
  tags: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { backgroundColor: '#EEF4FB', borderRadius: 999, color: '#1E4F8C', fontSize: 12, fontWeight: '600', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 },
  updated: { color: '#9BA8BB', fontSize: 12, marginLeft: 'auto' },
  alert: { alignItems: 'flex-start', backgroundColor: '#FFF7E6', borderRadius: 18, flexDirection: 'row', gap: 10, marginTop: 14, padding: 14 },
  alertKicker: { color: '#B45309', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  alertText: { color: '#3D2E0A', fontSize: 14, lineHeight: 20, marginTop: 4 },
  brands: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  brandChip: { backgroundColor: '#E4E8EF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  brandChipOn: { backgroundColor: '#163A6B' },
  brandText: { color: '#2D3748', fontSize: 13, fontWeight: '700' },
  brandTextOn: { color: '#FFFFFF' },
  priceRow: { alignItems: 'flex-start', borderTopColor: '#F0F2F5', borderTopWidth: 1, flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12 },
  priceName: { color: '#1A202C', fontSize: 15, fontWeight: '700' },
  priceDesc: { color: '#6B7A8D', fontSize: 13, lineHeight: 18, marginTop: 3 },
  priceTag: { alignItems: 'flex-end' },
  price: { color: '#163A6B', fontSize: 17, fontWeight: '800' },
  priceUnit: { color: '#8A97A8', fontSize: 11, fontWeight: '600' },
});
