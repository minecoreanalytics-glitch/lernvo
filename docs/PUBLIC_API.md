# Public read API (website integration)

No authentication. Serves only the **last approved version** of knowledge items an admin marked
**« Publiable sur le site web »**. What your customers read is exactly what your employees were
trained on and acknowledged. CORS open (GET), 120 req/min/IP, responses cacheable 60 s.

Base URL: `https://<slug>.lernvo.com/api/public` (or add `?tenant=<slug>` on `https://lernvo.com/api/public`).

| Endpoint | Returns |
|---|---|
| `GET /tenant` | `{ name, slug, logoUrl, supportEmail }` |
| `GET /categories` | `[{ id, name, icon, color }]` |
| `GET /articles?category=<id>&tag=<tag>&q=<text>` | `[{ slug, title, excerpt, tags, category, version, approvedAt }]` |
| `GET /articles/:slug` | `{ slug, title, body (markdown), tags, category, version, approvedAt, format: "markdown" }` |

Example (Next.js / any site, build time or runtime):
```js
const res = await fetch('https://acme.lernvo.com/api/public/articles?tag=tarif')
const offers = await res.json()
```

Workflow on the Lernvo side: write/import the article → tick *Publiable sur le site web* → submit →
approve. Editing creates a draft; the website keeps serving the approved version until the next
approval. Untick *Publiable* (or unpublish) to remove it from the API immediately.
