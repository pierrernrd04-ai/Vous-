# V4 · « Film cinématique » : 10 plans écrits, 6 retenus, un seul film

> **Ambrel est une marque fictive (démonstration).** Film de marque contemplatif, 16:9, 1920×1080, 30 i/s, 23 s, voix féminine lente (Piper `siwis`).
> Méthode de la vidéo source (format 4, « cinématique ») : une image de référence → 10 plans qui racontent une histoire → sélection de 6 → un prompt unique qui enchaîne les 6 plans → test en basse résolution → rendu final 1080p.
> Ici, tout est dessiné par code : shaders WebGL2 (brume, eau, pierre, lumière volumétrique, caustiques, grain, fuites de lumière), canvas 2D (main stylisée, carafe, verre, pot Ambrel en vraie rotation) et textes HTML. Aucune image générée, aucune banque d’images, aucune personne réelle.

## 1. Image de référence

`brand/png/packshot-1080.png` : le pot en verre ambré sur son socle de pierre, lumière chaude, cristaux et gélules. Elle fixe la palette (bleu d’aube → ambre), la matière (verre, pierre, eau) et la lumière (douce, à 45° en haut à gauche, contre-jour chaud).

**L’histoire :** de l’aube froide au geste chaud du matin. On part du paysage (le minéral, l’eau), on se rapproche jusqu’au détail, puis au geste humain, puis au produit, et on finit sur la signature.

## 2. Les 10 plans écrits

| N° | Plan | Valeur | Description | Intention |
|---|---|---|---|---|
| 1 | **Éveil** | Large | Vallée minérale à l’aube bleue, brume en couches, crêtes en silhouette, lac au fond ; lent travelling avant. | La respiration d’ouverture, le froid de départ. |
| 2 | **Source** | Moyen | Un filet d’eau coule sur une roche lisse, reflets froids. | L’eau comme origine. |
| 3 | **Texture** | Macro | Une goutte tombe sur une pierre polie et dessine une onde ; une gélule végétale se pose sur la pierre humide. | Eau + minéral + produit dans un seul cadre. |
| 4 | **Geste** | Moyen | Des mains stylisées (silhouette, sans visage) versent un verre d’eau près d’une fenêtre voilée de lin ; la lumière se réchauffe. | Le rituel, le mode de consommation (avec de l’eau). |
| 5 | **Objet du quotidien** | Détail | Un verre sur le rebord de la fenêtre, un rideau de lin qui bouge. | Le calme du matin. |
| 6 | **Produit en contexte** | Moyen | Le pot posé sur une tablette de pierre près de la fenêtre. | Le produit dans la vie réelle. |
| 7 | **Produit héros** | Héros | Le pot sur un socle de pierre, un rayon de lumière, orbite de caméra de 30°. | La révélation : nom et dose lisibles. |
| 8 | **Mouvement de vie** | Large | Une silhouette s’étire face au soleil levant. | L’élan du matin. |
| 9 | **Détail lumière** | Macro | La lumière traverse le verre ambré, poussière dorée, reflets mouvants. | Le lien avec le nom (ambre), la chaleur. |
| 10 | **Signature** | Fin | Aplat ambre, le logo se pose et reste jusqu’à la fin. | Mémorisation, mentions légales. |

## 3. Les 6 plans retenus : 1, 3, 4, 7, 9, 10

| Retenu | Pourquoi |
|---|---|
| **1 Éveil** | L’ouverture large, la « respiration ». Elle installe le bleu froid de l’aube, point de départ de la progression vers le chaud. Le lac et la brume posent l’eau et le minéral dès la première image. |
| **3 Texture** | Le détail qui répond au large. Il réunit l’eau, le minéral et la gélule : le produit (la gélule) apparaît dès 5,8 s. Une onde sur une pierre mouillée se calcule très bien en code (reflets, profondeur de champ). |
| **4 Geste** | Le rituel humain, sans visage (pas d’hypertrucage de visage) : une main en silhouette contre-jour. Il montre le mode de consommation, avec un verre d’eau, sans écran. |
| **7 Héros** | La révélation sur la montée musicale. Le pot tourne vraiment (étiquette plaquée sur un cylindre) : le nom et la dose sont lisibles. |
| **9 Détail lumière** | Il fait le lien avec le nom (ambre) et réchauffe la palette avant la fin ; il garde l’alternance large / détail et porte l’allégation, entière, dans un seul plan. |
| **10 Signature** | Le logo reste à l’écran jusqu’à la fin, avec la signature, l’allégation en rappel et le carton légal. |

**Écartés**
- **2 Source** : doublon du plan 3 (l’eau sur la pierre), moins fort, sans produit.
- **5 Objet du quotidien** : doublon du plan 4 (verre, fenêtre, lin).
- **6 Produit en contexte** : doublon du héros ; il affaiblirait la révélation du plan 7.
- **8 Mouvement de vie** : une silhouette en pied est plus difficile à rendre crédible en code, et le corps qui s’étire risque de suggérer un effet « énergie » non autorisé. <!-- lint-ok -->

## 4. Découpage final (le film)

Fondus enchaînés doux entre chaque plan (0,5 à 0,9 s), letterbox 2,39:1 (bandes de 138 px) pendant les plans 1 à 9, qui s’ouvrent sur la signature.

| Temps | Plan | Image et caméra | Texte à l’écran | Son et voix |
|---|---|---|---|---|
| 0,0-3,8 | **S1 Éveil** | Dégradé nuit → aube → brume, 5 crêtes en parallaxe, brume volumétrique entre les couches, rayons crépusculaires, lac qui reflète la vallée (ondulations), gouttelettes de brume en bokeh ; push-in lent 1,00 → 1,075 avec dérive latérale | Ouverture « Film publicitaire généré par IA · Images virtuelles · Voix générée par IA » (0-2,5 s, bande basse), badge « Publicité · Contenu généré par IA » permanent | Vent (bruit brun filtré), nappe `calm` 72 BPM qui entre |
| 3,8-7,4 | **S3 Texture** | Macro sur pierre polie mouillée (veines minérales, paillettes), reflet de fenêtre ; goutte qui tombe (4,6 s), jet de Worthington, couronne de gouttelettes, ondes concentriques ; gélule qui se pose à 6,2 s avec reflet et ombre de contact ; mise au point qui glisse de la goutte à la gélule ; travelling latéral et avant | Sous-titre mot à mot L1 | `drop` 4,6 et 5,0 ; `glass` doux 6,2 ; L1 (4,10) « Avant le jour, il y a l’eau. » |
| 7,4-11,0 | **S4 Geste** | Rideau de lin translucide en contre-jour (plis qui ondulent), fente de lumière et rayons volumétriques, poussière ; main stylisée en silhouette qui verse une carafe dans un verre (filet d’eau, bulles, niveau qui monte, ombre et caustique sur la table de pierre) ; la lumière passe du froid au chaud ; plan fixe puis légère rotation et push-in | Sous-titre mot à mot L2 | Versement ; L2 (7,70) « La pierre. Et un geste simple. » ; `swell` 8,5 → 11,0 |
| 11,0-15,6 | **S7 Héros** | Éclair chaud de révélation ; pot Ambrel sur socle de pierre (travertin), orbite de 30° : l’étiquette tourne réellement, le socle et le fond glissent en parallaxe, reflet qui balaie le verre ; rayon de lumière volumétrique, caustique ambrée sur le socle, poussière dorée sur trois profondeurs | Bas de cadre : « AMBREL » puis « Magnésium *bisglycinate* + vitamine B6 », mot à mot sur la voix | L3 (11,40) « Ambrel. Magnésium bisglycinate et vitamine B6. » |
| 15,6-18,2 | **S9 Détail lumière** | Très gros plan sur le verre ambré : bord du couvercle strié, gélules floues à l’intérieur, caustiques, reflet qui balaie, poussière dorée, bord de l’étiquette ; travelling latéral lent | Allégation entière, mot actif en miel, qui reste à l’écran jusqu’à la fin | L4 (16,00) « Le magnésium et la vitamine B6 contribuent à réduire la fatigue. » |
| 18,2-23,0 | **S10 Signature** (4,8 s) | Aplat ambre profond, les bandes s’ouvrent, logo clair qui se pose (mise au point), signature écrite sur la voix | Logo · « Tout est écrit. » · allégation en rappel · bloc légal complet · « Ambrel est une marque fictive (démonstration). » | `chime` 18,3 ; L5 (21,20) « Tout est écrit. » |

Écart avec le brief : la frontière S7 / S9 passe de 15,4 à 15,6 s pour que le nom du produit (voix jusqu’à 15,6 s) reste en entier sur le plan héros. Le carton légal est affiché, fixe, de 18,55 à 23,0 s (4,45 s).

## 5. Prompt équivalent (forme « Seedance » de la vidéo, références @Image1…@Image6)

> 23 s, 16:9, cinematic, soft natural light, slow camera, cold blue dawn progressively warming to amber, minimal, no clinical look, film grain, gentle light leaks, 2.39 letterbox, gentle crossfades. Shot 1 (0-3.8 s) @Image1 | wide, misty mineral valley at blue dawn, layered ridges, still lake reflecting the valley, slow push-in, light wind. Shot 2 (3.8-7.4 s) @Image2 | macro, a water drop falls on wet polished stone, ripples, a vegetable capsule settles on the wet stone, focus pull. Shot 3 (7.4-11 s) @Image3 | stylised silhouette hand (no face) pours a glass of water by a linen-curtained window, light warming, static then slight rotation. Shot 4 (11-15.6 s) @Image4 | amber glass jar on a stone pedestal, light ray, 30° orbit, golden dust, music swell. Shot 5 (15.6-18.2 s) @Image5 | extreme close-up, light through amber glass, caustics, drifting golden dust. Shot 6 (18.2-23 s) @Image6 | flat deep amber, logo lands and holds to the end. Sound: wind, water drop, glass tink, pouring water, warm pad, soft chime.

## 6. Fabrication (tout en code)

| Fichier | Rôle |
|---|---|
| `scene.html` | Scène seekable (`__seek(t)`) : minutage des plans et des fondus, textes (copiés de `brand/brand.js`), sous-titres mot à mot calés sur `audio/v4-timings.js` |
| `gl-shots.js` | Un shader WebGL2 par plan (S1, S3, S4, S7, S9, S10) rendu dans un FBO mipmappé, puis une passe de finition : fondu enchaîné, halo (bloom par mipmaps), éclair de révélation, fuites de lumière, vignettage, grain argentique, letterbox |
| `fg.js` | Avant-plans en canvas 2D, envoyés au shader comme textures : main stylisée, carafe, verre et filet d’eau (S4) ; pot Ambrel avec `tools/lib/jar3d.js`, étiquette déroulée plaquée sur le cylindre (S7) |
| `v4.vo.json` → `audio/` | Voix Piper (vo-build), musique `calm` 72 BPM, effets synthétisés, vent et versement (ffmpeg), liste `audio/sfx.list` |

Itération comme dans la méthode : images fixes (`tools/snap.mjs`), aperçu demi-résolution à 15 i/s (`--downscale 0.5`), puis rendu final 1080p 30 i/s.

## 7. Conformité

- Allégation unique : `AMBREL.claims.fatigue`, mot pour mot, nutriments nommés, entière dans un seul plan puis en rappel sur le carton.
- Aucun visuel interdit : pas de lune, pas de nuit étoilée, pas de lit, pas d’écran, pas de visage ; aucune incitation à dépasser la dose (une gélule et un verre d’eau à l’image).
- Mentions IA et publicité : ouverture 0-2,5 s + badge permanent ; « Images virtuelles » pour la main stylisée (loi 2023-451). À la mise en ligne : activer le marqueur IA de la plateforme, ciblage 18 ans et plus.
- Musique et sons 100 % synthétisés, polices locales sous licence OFL.
