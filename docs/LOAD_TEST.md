# Test de charge

Scénario réel : *9 h du matin, toute l'équipe se connecte, ouvre son tableau de bord et sa file
« à lire et valider »*. C'est le moment où une plateforme d'assurance de connaissance est le plus
sollicitée — une procédure vient d'être approuvée et tout le monde arrive en même temps.

```bash
# 1. une base de test + un serveur en mode production
cd backend && export $(cat .env.test | xargs) && PORT=4010 NODE_ENV=production npx tsx src/index.ts &

# 2. 200 employés fictifs dans un tenant « loadtest »
npx tsx scripts/loadtest-seed.ts

# 3. la charge (nombre d'employés simultanés en argument)
node scripts/loadtest.mjs 200
```

## Référence — 19 août 2026, MacBook (1 process, Postgres local)

| | 50 simultanés | 200 simultanés |
|---|---|---|
| Connexions réussies | 50/50 | 200/200 |
| Rejets (429) | 0 | 0 |
| Débit connexion | 10,5 /s | 12,2 /s |
| Latence connexion p50 / p95 | 2,5 s / 4,4 s | 8,6 s / 15,7 s |
| Navigation (3 requêtes par employé) | 268 req/s | 1 124 req/s |
| Requêtes lentes (> 300 ms) | 0 | 0 |

**Lecture.** La navigation n'est pas le sujet : plus de 1 000 requêtes/s sans une seule requête lente.
Le plafond, c'est **bcrypt** : le hachage coûte volontairement ~250 ms, donc ~12 connexions/s par
process. Une vague parfaitement simultanée de 200 personnes met donc ~16 s à s'écouler — en réalité
les arrivées s'étalent sur plusieurs minutes. Les leviers, dans l'ordre : plusieurs process (le poste
a plusieurs cœurs), puis abaisser le coût bcrypt de 12 à 10 (×4, et toujours conforme aux
recommandations OWASP). À ne toucher que si la mesure le demande.

**Ce que ce test a servi à prouver** : avant correction, la 21ᵉ connexion depuis une même IP
d'entreprise recevait un 429 et bloquait tout le bureau pendant 15 minutes.
