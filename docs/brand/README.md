# Marque Lernvo

Le signe : une **mallette dont la ligne de fermeture porte la coche du fermoir** — l'objet du travail,
validé. La fermeture est *évidée* (mask SVG), donc le signe fonctionne sur n'importe quel fond.

| Fichier | Usage |
|---|---|
| `mark-amber.svg` | signe seul, fonds sombres (ambre `#F5B700`) |
| `mark-navy.svg` | signe seul, papier et documents (navy `#163A6B`) |
| `mark-white.svg` | signe seul, fonds navy ou photo |
| `mark-chip.svg` | pastille sombre + signe ambre — usage par défaut dans l'interface claire, et icône d'application |
| `lockup-light.svg` / `lockup-dark.svg` / `lockup-navy.svg` | signe + mot « lernvo » (Inter ExtraBold, tracé vectorisé — aucune police requise) |
| `../../frontend/public/favicon.svg` | favicon (= pastille, variante simplifiée) |

**Deux variantes du signe.** La version complète garde la ligne de fermeture ; sous ~20 px elle
se referme, donc le favicon, l'icône d'app et la pastille utilisent la variante **compacte**
(une seule coche, plus grasse). Même famille, même lecture.

**Couleurs.** Ambre `#F5B700` sur sombre `#0E1116` · navy `#163A6B` sur papier · blanc sur navy.
Le mot s'écrit **en minuscules** (`lernvo`), Inter ExtraBold, interlettrage −4,5 %.
La baseline « ASSURANCE DE CONNAISSANCE » est en capitales espacées à +28 %.

**Composant React** : `frontend/src/components/BrandMark.tsx` (`tone="chip|amber|navy|white"`, `compact`).
**Régénérer les fichiers** : `python3 docs/brand/gen.py` puis `node frontend/scripts/generate-icons.js`
(les PNG PWA/OG sont produits par sharp à partir des SVG).
