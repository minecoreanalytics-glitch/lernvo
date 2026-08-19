// Scénario réel : 9 h du matin, l'équipe se connecte puis lit et valide la procédure du jour.
const BASE = process.env.BASE ?? 'http://127.0.0.1:4010'
const N = Number(process.argv[2] ?? 50)

const t0 = Date.now()
const results = await Promise.all(Array.from({ length: N }, async (_, i) => {
  const s = Date.now()
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `load${i}@loadtest.test`, password: 'LoadTest2026!' }),
  })
  const ms = Date.now() - s
  let token = null
  if (r.ok) token = (await r.json()).accessToken
  return { status: r.status, ms, token }
}))
const loginMs = Date.now() - t0
const ok = results.filter(r => r.status === 200)
const lat = ok.map(r => r.ms).sort((a, b) => a - b)
const p = (q) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] : 0

console.log(`CONNEXIONS  ${N} simultanées`)
console.log(`  succès    ${ok.length}/${N}   429: ${results.filter(r=>r.status===429).length}   autres: ${results.filter(r=>r.status!==200&&r.status!==429).length}`)
console.log(`  latence   p50 ${p(.5)} ms · p95 ${p(.95)} ms · max ${lat.at(-1)} ms`)
console.log(`  total     ${loginMs} ms  (${(N/(loginMs/1000)).toFixed(1)} connexions/s)`)

// Puis la navigation : chaque employé charge son tableau de bord + ses validations en attente
const tokens = ok.map(r => r.token).filter(Boolean)
const t1 = Date.now()
const nav = await Promise.all(tokens.flatMap(tok => [
  fetch(`${BASE}/api/modules?limit=20`, { headers: { Authorization: `Bearer ${tok}` } }),
  fetch(`${BASE}/api/approvals/my-pending`, { headers: { Authorization: `Bearer ${tok}` } }),
  fetch(`${BASE}/api/notifications`, { headers: { Authorization: `Bearer ${tok}` } }),
]))
const navMs = Date.now() - t1
const navOk = nav.filter(r => r.ok).length
console.log(`NAVIGATION  ${nav.length} requêtes (${tokens.length} employés × 3)`)
console.log(`  succès    ${navOk}/${nav.length}   429: ${nav.filter(r=>r.status===429).length}`)
console.log(`  total     ${navMs} ms  (${(nav.length/(navMs/1000)).toFixed(0)} req/s)`)
