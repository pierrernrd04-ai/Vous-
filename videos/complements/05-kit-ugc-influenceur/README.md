# Kit 05 · UGC IA et influenceur IA · Ambrel

> Formats 1 (UGC IA) et 2 (influenceur IA) de la méthode source, plus la dernière étape : la prospection. Ces deux formats ont besoin d’un modèle vidéo IA réaliste (visage, mains, synchro labiale) : rien n’est rendu en local. Le kit contient ce qu’il faut pour lancer la génération : casting, prompts, répliques chronométrées, réglages, mentions, budget de crédits et contrôle qualité.
> **Ambrel est une marque fictive.** La référence unique est [`../brand/brand-system.md`](../brand/brand-system.md). Les textes réglementés viennent de [`../brand/brand.js`](../brand/brand.js) : on les copie, on ne les retape pas.

```
05-kit-ugc-influenceur/
  README.md                                ce kit
  actors/acteur-01-ines.svg                fiches casting (silhouettes sans visage)
  actors/acteur-02-bastien.svg
  actors/acteur-03-jade.svg
  product/ambrel-pot-face.jpg              photo produit : pot de face sur fond crème (1000×1200)
  product/ambrel-etiquette-face.jpg        face avant de l’étiquette (aide à la lisibilité)
  product/ambrel-etiquette-composition.jpg panneau composition (gros plans)
  product/*-480.jpg                        versions légères pour les appels vidIQ (base64)
  à créer pendant la production :
  actors/ines.jpg, bastien.jpg, jade.jpg   portraits générés avec les prompts A.1
  influenceur/avatar.jpg, p1.jpg … p7.jpg  avatar et photos (partie B)
  out/                                     vidéos téléchargées et montages
```

**Démarrage rapide (le test « 1 minute » de la vidéo)**
1. Génère `actors/ines.jpg` avec le prompt A.1.
2. Dans Omni (Alexya, ou vidIQ avec `gemini-omni-flash`), importe `actors/ines.jpg` puis `product/ambrel-pot-face.jpg`. Règle **720p, 9:16, 4 s** et colle le prompt A1 « 4 s ».
3. Contrôle le résultat avec la checklist C.5. S’il est bon, lance la version 8 s, puis la finale (C.1).
4. Montage : mentions et carton final (A.3).

---

## 0. Règles du kit

- **L’acteur présente, il ne témoigne pas d’un résultat.** Interdit : « depuis que je le prends », « ça a changé », avant/après, avis, notes, « je suis cliente ». <!-- lint-ok -->
- **Ce qui est dit vient de `brand.js`, et de là seulement** : allégations `AMBREL.claims` mot pour mot, faits produit `AMBREL.product` (« 60 gélules végétales », « 3 gélules par jour », « Sans arôme ni édulcorant »…), signature `AMBREL.tagline`. Dans la réplique, écris les nombres en lettres (« trois gélules ») pour que le modèle les prononce bien.
- **On ne parle jamais de l’état du spectateur** (pas de « Tu es fatigué ? »). C’est le nutriment qui contribue, jamais le produit.
- **Visuels interdits** (brand-system §7) : lit, chambre, nuit, lune, écran au moment de la prise, blouse, croix de pharmacie, blister, plusieurs doses, corps qui se transforme, pose de musculation.
- **Personnes** : uniquement les 3 acteurs fictifs (A.1) et l’avatar (B). Aucun visage réel, aucune célébrité, aucun logo d’une autre marque.
- **Public** : ciblage 18 ans et plus (produit réservé à l’adulte).
- **Mentions** : ouverture, badge permanent et carton final (A.3), plus l’étiquette IA de la plateforme à la publication.

Pour afficher les textes exacts à copier :

```bash
cd /home/user/Vous-/videos/complements
node -e 'const fs=require("fs"),vm=require("vm"),s={};s.window=s;vm.runInNewContext(fs.readFileSync("brand/brand.js","utf8"),s);const A=s.AMBREL,m=A.mentions;console.log([m.ad,m.virtual,m.aiVoice].join(" · "));console.log([m.ad,m.aiBadge].join(" · "));console.log(A.claims.fatigue+"\n"+A.claims.muscle+"\n\n"+A.legal.full+"\n\n"+A.legal.short+"\n\n"+A.legal.fictive)'
node tools/lint-copy.mjs 05-kit-ugc-influenceur/README.md      # 0 erreur attendue
```

---

## A. UGC IA (format Omni, 9:16)

### A.1 Casting : 3 acteurs fictifs

| Fiche | Acteur | Variantes | Traits verrouillés |
|---|---|---|---|
| [`acteur-01-ines.svg`](actors/acteur-01-ines.svg) | **Inès, 41 ans** | A1 routine du soir | carré court gris argent, yeux marron foncé, peau brune, lunettes rondes monture miel, pull en maille couleur lin ; voix posée |
| [`acteur-02-bastien.svg`](actors/acteur-02-bastien.svg) | **Bastien, 36 ans** | A2 unboxing | châtain foncé court, barbe de 3 jours, yeux gris-vert, fine cicatrice au sourcil gauche, chemise en lin couleur pierre ; voix grave et souriante |
| [`acteur-03-jade.svg`](actors/acteur-03-jade.svg) | **Jade, 27 ans** | A3 ASMR, A4 mystery box | cheveux noirs longs en chignon haut, yeux marron, grain de beauté au menton, ongles courts nus, sweat crème ; voix douce, chuchotement net |

**Prompts image** (n’importe quel générateur d’images photoréaliste, Alexya « Image » par exemple ; les modèles d’image suivent mieux l’anglais). Enregistre le portrait retenu dans `actors/ines.jpg`, `actors/bastien.jpg` et `actors/jade.jpg`.

```text
Photorealistic vertical 9:16 smartphone photo, UGC style, of a fictional 41-year-old French woman who does not resemble any real person or celebrity. Short silver-grey bob with a side part, dark brown eyes, brown skin with fine expression lines, thin round glasses with honey-coloured frames, small gold hoop earrings, linen-coloured crew-neck knit sweater. She sits at a wooden table in a bright, simple kitchen at dinner time: warm pendant light, a plate and a full glass of water in front of her. Chest-up framing, facing the camera, mouth closed, calm friendly expression, both hands empty and resting on the table, five fingers visible on each hand. Real skin texture, no retouching, slight phone grain. No bed, no candles, no screen, no text, no logo, no brand.
```

```text
Photorealistic vertical 9:16 smartphone photo, UGC style, of a fictional 36-year-old French man who does not resemble any real person or celebrity. Short dark-brown slightly messy hair, three-day stubble, grey-green eyes, fair lightly tanned skin, a thin scar through the left eyebrow, stone-coloured linen shirt with rolled-up sleeves. He sits on a sofa in a bright living room in daylight, a closed kraft cardboard parcel on the coffee table in front of him. Chest-up framing, facing the camera, mouth closed, friendly half smile, both hands empty and visible on his knees, five fingers on each hand. Real skin texture, no retouching, slight phone grain. No text, no logo, no brand.
```

```text
Photorealistic vertical 9:16 smartphone photo, UGC style, of a fictional 27-year-old woman of East Asian descent living in France, who does not resemble any real person or celebrity. Long straight black hair tied in a high bun, brown eyes, fair skin, a small mole on the chin, short unpainted nails, oversized cream sweatshirt. She sits at a light wood worktop by a window in soft daylight. Close chest-up framing, facing the camera, mouth closed, soft calm expression, both hands resting flat on the worktop, five fingers visible on each hand. Real skin texture, no retouching, slight phone grain. No text, no logo, no brand.
```

**Photo acteur pour Omni** : 9:16, au moins 1080×1920, buste, visage de face et net, bouche fermée, mains vides et visibles, décor de la variante. Génère 4 candidats et garde le plus net. Passe-le ensuite dans une recherche d’image inversée (Google Lens, TinEye) : si une personne réelle ressort, régénère.

**Photo produit** : `product/ambrel-pot-face.jpg` (pot entier, de face, étiquette lisible, fond uni). Si l’outil accepte une 3e image, ajoute `product/ambrel-etiquette-face.jpg` : elle aide le modèle à garder le texte de l’étiquette. Ordre d’import : acteur (image 1), pot (image 2), étiquette (image 3). Avec seulement 2 images, retire « (image 3) » du prompt.

### A.2 Les 4 variantes

**Réglages** : test **720p · 9:16 · 4 s** → version **8 s** (720p) → finale **1080p** (C.1). Une réplique de 4 s tient en 3 s parlées au plus, une réplique de 8 s en 6,5 s. Les durées ci-dessous ont été mesurées avec Piper au débit neutre (`tools/tts.sh`, `length_scale` 1,0), plus lent qu’un acteur IA : la marge est comprise.

| | Variante | Acteur | Réplique 4 s | Réplique 8 s | Source `brand.js` | Carton |
|---|---|---|---|---|---|---|
| A1 | Témoignage « ma routine du soir » | Inès | « Ma routine du soir : trois gélules au dîner. » (2,85 s) | « Ma routine du soir, au dîner. Le magnésium et la vitamine B6 contribuent à réduire la fatigue. » (6,31 s) | `product.dose`, `claims.fatigue` | 4 s : `legal.short` · 8 s : `legal.full` |
| A2 | Unboxing | Bastien | « Je vous présente Ambrel. Tout est écrit. » (2,93 s) | « Je vous présente Ambrel : magnésium bisglycinate et vitamine B6. Tout est écrit. » (6,20 s) | `name`, `tagline`, `product.name` | `legal.short` |
| A3 | ASMR | Jade | « Soixante gélules végétales. » (1,59 s, plus lent en chuchotant) | « Soixante gélules végétales. Sans arôme ni édulcorant. Trois par jour. » (4,77 s) | `product.format`, `product.free`, `product.dose` | `legal.short` |
| A4 | Mystery box | Jade | « Ce qu’il y a dans la boîte ? Ambrel. » (2,21 s) | « Dans la boîte : Ambrel. Le magnésium contribue à une fonction musculaire normale. » (5,63 s) | `name`, `claims.muscle` | 4 s : `legal.short` · 8 s : `legal.full` |

« Ma routine du soir » décrit un geste (au dîner, avec un verre d’eau, comme le conseille l’étiquette), pas un résultat. Elle se passe dans la cuisine, jamais dans une chambre.

#### A1 · Témoignage « ma routine du soir » (Inès)
Images : `actors/ines.jpg`, `product/ambrel-pot-face.jpg`, `product/ambrel-etiquette-face.jpg`.

4 s :
```text
Vidéo verticale 9:16 au format UGC, filmée au smartphone posé sur la table, cadrage buste, léger mouvement de caméra à la main. Cette femme (image 1) est assise à la table de sa cuisine, au dîner, une assiette et un grand verre d’eau devant elle. Elle tient dans les mains ce pot (image 2) : verre ambré, couvercle strié couleur pierre, étiquette crème au logo « ambrel », tournée vers la caméra et nette (image 3). Elle regarde la caméra, sourit et dit en français, d’un ton posé et spontané : « Ma routine du soir : trois gélules au dîner. » Lumière chaude d’une suspension, cuisine claire. Garde exactement le visage de l’image 1 et le pot de l’image 2. Pas de chambre, pas de lit, pas d’écran, pas de musique, pas de sous-titres, aucun texte incrusté, aucune autre marque.
```
8 s :
```text
Vidéo verticale 9:16 au format UGC, filmée au smartphone posé sur la table, cadrage buste, léger mouvement de caméra à la main. Cette femme (image 1) est assise à la table de sa cuisine, au dîner, une assiette et un grand verre d’eau devant elle. Elle prend ce pot (image 2) et le tient à hauteur de poitrine, étiquette crème au logo « ambrel » tournée vers la caméra et nette (image 3). Elle regarde la caméra et dit en français, d’un ton posé et spontané : « Ma routine du soir, au dîner. Le magnésium et la vitamine B6 contribuent à réduire la fatigue. » À la fin, elle repose le pot à côté de son verre d’eau et sourit. Lumière chaude d’une suspension, cuisine claire. Garde exactement le visage de l’image 1 et le pot de l’image 2. Pas de chambre, pas de lit, pas d’écran, pas de musique, pas de sous-titres, aucun texte incrusté, aucune autre marque.
```

#### A2 · Unboxing (Bastien)
Images : `actors/bastien.jpg`, `product/ambrel-pot-face.jpg`, `product/ambrel-etiquette-face.jpg`.

4 s :
```text
Vidéo verticale 9:16 au format UGC, smartphone tenu à la main, cadrage buste. Cet homme (image 1) est assis dans son salon lumineux, un colis en carton kraft ouvert sur la table basse. Il en sort ce pot (image 2) : verre ambré, couvercle strié couleur pierre, étiquette crème au logo « ambrel ». Il le tient à hauteur de poitrine, étiquette tournée vers la caméra et nette (image 3), et dit en français, d’un ton souriant et spontané : « Je vous présente Ambrel. Tout est écrit. » Lumière du jour. Garde exactement le visage de l’image 1 et le pot de l’image 2. Pas de musique, pas de sous-titres, aucun texte incrusté, aucune autre marque.
```
8 s :
```text
Vidéo verticale 9:16 au format UGC, smartphone tenu à la main, cadrage buste. Cet homme (image 1) est assis dans son salon lumineux, un colis en carton kraft fermé sur la table basse. Il soulève les rabats, écarte un papier de soie couleur crème et sort ce pot (image 2) : verre ambré, couvercle strié couleur pierre, étiquette crème au logo « ambrel ». Il le tourne vers la caméra, étiquette nette (image 3), et dit en français, d’un ton souriant et spontané : « Je vous présente Ambrel : magnésium bisglycinate et vitamine B6. Tout est écrit. » Il termine en tapotant le couvercle du doigt. On entend le carton et le papier de soie. Lumière du jour. Garde exactement le visage de l’image 1 et le pot de l’image 2. Pas de musique, pas de sous-titres, aucun texte incrusté, aucune autre marque.
```

#### A3 · ASMR (Jade)
Images : `actors/jade.jpg`, `product/ambrel-pot-face.jpg`, `product/ambrel-etiquette-face.jpg`.

4 s :
```text
Vidéo verticale 9:16 au format ASMR, smartphone fixe sur un petit trépied, cadrage serré sur le visage et les mains de cette femme (image 1), micro très proche. Sur un plan de travail en bois clair, elle dévisse lentement le couvercle strié couleur pierre de ce pot en verre ambré (image 2), étiquette crème au logo « ambrel » tournée vers la caméra et nette (image 3). On entend le clic du couvercle et le frottement du verre. Elle chuchote en français, tout près du micro : « Soixante gélules végétales. » Lumière du jour douce. Garde exactement le visage de l’image 1 et le pot de l’image 2. Pas de musique, pas de sous-titres, aucun texte incrusté, aucune autre marque.
```
8 s :
```text
Vidéo verticale 9:16 au format ASMR, smartphone fixe sur un petit trépied, cadrage serré sur le visage et les mains de cette femme (image 1), micro très proche. Sur un plan de travail en bois clair, elle dévisse lentement le couvercle strié couleur pierre de ce pot en verre ambré (image 2), verse trois gélules végétales couleur crème dans le creux de sa main (on entend les gélules rouler), referme le pot et le tourne vers la caméra, étiquette crème au logo « ambrel » nette (image 3). Elle chuchote en français, tout près du micro : « Soixante gélules végétales. Sans arôme ni édulcorant. Trois par jour. » Lumière du jour douce. Garde exactement le visage de l’image 1 et le pot de l’image 2. Pas de musique, pas de sous-titres, aucun texte incrusté, aucune autre marque.
```

#### A4 · Mystery box (Jade)
Images : `actors/jade.jpg`, `product/ambrel-pot-face.jpg`, `product/ambrel-etiquette-face.jpg`.

4 s :
```text
Vidéo verticale 9:16 au format UGC, smartphone tenu à la main, cadrage buste. Cette femme (image 1) tient une petite boîte en carton couleur crème fermée par un ruban ambre. Elle la secoue doucement près de son oreille, l’ouvre et en sort ce pot (image 2) : verre ambré, couvercle strié couleur pierre, étiquette crème au logo « ambrel », tournée vers la caméra et nette (image 3). Elle dit en français, d’un ton complice : « Ce qu’il y a dans la boîte ? Ambrel. » Salon lumineux, lumière du jour. Garde exactement le visage de l’image 1 et le pot de l’image 2. Pas de musique, pas de sous-titres, aucun texte incrusté, aucune autre marque.
```
8 s :
```text
Vidéo verticale 9:16 au format UGC, smartphone tenu à la main, cadrage buste. Cette femme (image 1) tient une petite boîte en carton couleur crème fermée par un ruban ambre. Elle la secoue doucement, dénoue le ruban, soulève le couvercle, écarte un papier de soie et sort ce pot (image 2) : verre ambré, couvercle strié couleur pierre, étiquette crème au logo « ambrel ». Elle le tient à hauteur de poitrine, étiquette tournée vers la caméra et nette (image 3), et dit en français, d’un ton complice : « Dans la boîte : Ambrel. Le magnésium contribue à une fonction musculaire normale. » Salon lumineux, lumière du jour. Garde exactement le visage de l’image 1 et le pot de l’image 2. Pas de salle de sport, pas de geste sportif, pas de musique, pas de sous-titres, aucun texte incrusté, aucune autre marque.
```

### A.3 Montage, mentions et carton final

Le modèle livre un clip sans texte. On ajoute ensuite, dans un éditeur (CapCut, Premiere, DaVinci) ou avec le toolkit :

| Élément | Texte exact (`brand.js`) | Où et quand |
|---|---|---|
| Ouverture | « Publicité · Images virtuelles · Voix générée par IA » (`mentions.ad`, `mentions.virtual`, `mentions.aiVoice` : brand-system §15) | 0 à 2,2 s, haut de cadre, sous le badge (style `.ak-disclosure`, y 360) |
| Badge permanent | « Publicité · Contenu généré par IA » (`mentions.ad`, `mentions.aiBadge`) | toute la vidéo, x 80, y 300 (`.ak-badge`) |
| Sous-titres | la réplique exacte, 2 à 4 mots par carte, mot actif en miel | y 1010 à 1248 (`.ak-captions`) |
| Carton final | allégation dite (si la version en contient une) + CTA « Découvre la composition » + `legal.full` + `legal.fictive` ; sans allégation : `legal.short` + `legal.fictive` | **4 s fixes** après le clip, 31 px minimum, fond crème opaque (`.ak-legal`) |
| Plateforme | étiquette « contenu IA » de la plateforme activée, ciblage 18 ans et plus | à la publication |

Durée finale : 4 s + 4 s = 8 s, ou 8 s + 4 s = 12 s. Rien d’important dans les 20 % du bas ni dans les 12 % de droite.

Avec le toolkit : copie `../tools/scene-template.html` en `05-kit-ugc-influenceur/carton.html`. Garde le bloc `#end` (logo, CTA, `.ak-legal`), fixe `DUR = 4`, fais apparaître `#end` dès 0 s et choisis `legal.full` ou `legal.short`. Ensuite :

```bash
cd /home/user/Vous-/videos/complements
node tools/render.mjs 05-kit-ugc-influenceur/carton.html 05-kit-ugc-influenceur/out/carton-full.mp4 --w 1080 --h 1920 --fps 30 --dur 4
cd 05-kit-ugc-influenceur
# clip IA (720×1280) remis en 1080×1920 30 fps + carton 4 s muet, son à -14 LUFS
ffmpeg -i out/a1-routine-8s.mp4 -i out/carton-full.mp4 -f lavfi -t 4 -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]scale=1080:1920:flags=lanczos,fps=30,setsar=1[v0];[1:v]fps=30,setsar=1[v1];[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];[v0][a0][v1][2:a]concat=n=2:v=1:a=1[v][a];[a]loudnorm=I=-14:TP=-1:LRA=11,aresample=48000[ao]" \
  -map "[v]" -map "[ao]" -c:v libx264 -crf 18 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -movflags +faststart out/ambrel-ugc-a1-routine-9x16.mp4
cd .. && tools/qa.sh 05-kit-ugc-influenceur/out/ambrel-ugc-a1-routine-9x16.mp4 --at 1.0,6.0
```
(La commande d’assemblage a été testée sur des clips factices : sortie en 1080×1920, 30 fps, AAC 48 kHz.) L’ouverture et le badge s’ajoutent ensuite dans l’éditeur, en calques de texte sur la vidéo assemblée.

---

## B. Influenceur IA

### B.1 Créer l’avatar : d’une référence à une identité unique

1. **Brief** : demande à la marque le genre, l’âge apparent (adulte), le style et 2 ou 3 traits voulus (la vidéo prend l’exemple d’une « blonde aux yeux bleus »). Pour Ambrel : une femme de 30 à 32 ans, active, au style sobre (persona Camille du brand-system §3).
2. **Références** : la vidéo source tape « woman Instagram » sur Pinterest et en garde une dizaine. Ces photos montrent de vraies personnes : sers-t’en seulement comme planche d’ambiance (cadrage, lumière, style). N’importe pas le visage d’une inconnue : génère plutôt une référence de départ avec un prompt (âge, style, lumière), puis transforme-la à l’étape 3.
3. **Alexya, fonction Avatar** : importe la référence et règle les traits un par un, de façon explicite (fiche B.2) : couleur et coupe des cheveux, couleur des yeux, peau, signe distinctif, âge apparent. Génère 4 propositions et garde la plus crédible.
4. **Contrôle d’unicité** : l’avatar ne doit plus être la même personne que la référence (la vidéo y insiste : « une personne unique qui n’existe pas »). Change au moins les cheveux (couleur et coupe), les yeux et un signe distinctif. Compare les deux images côte à côte, puis lance une recherche d’image inversée sur l’avatar. Si une personne réelle ou une célébrité ressort, régénère.
5. **Verrouillage** : télécharge l’avatar (portrait de face, lumière neutre, fond uni) dans `influenceur/avatar.jpg`. Copie la fiche B.2 en tête de chaque prompt et réimporte toujours le même fichier.
6. **Alexya, fonction Image** : importe l’avatar (et la photo produit, avant de générer, pour B.5), colle le prompt, règle **9:16** et la **qualité haute**.

### B.2 Fiche d’identité (traits verrouillés)

| Champ | Valeur |
|---|---|
| Statut | **Personnage virtuel** généré par IA, adulte (31 ans apparents) |
| Prénom (fictif) | Maëlle |
| Vie | Lyon, cheffe de projet, vélo pour aller au bureau, footing le matin, salle de sport deux fois par semaine, cuisine maison |
| Visage | ovale, pommettes hautes, menton fin, sourcils fournis non retouchés |
| Cheveux | châtain cuivré, ondulés, mi-longs aux épaules, raie au milieu |
| Yeux | vert noisette |
| Peau | claire, taches de rousseur légères sur le nez et les pommettes, petit grain de beauté sous l’œil gauche |
| Morphologie | sportive et fine, 1,68 m |
| Style | basiques en lin et en maille, tons crème, ambre et encre ; anneaux dorés fins ; montre de sport sans logo |
| Jamais | logos, maquillage lourd, tenue de soirée, lunettes de marque |

### B.3 Master prompt (à coller dans Claude avec la photo de l’avatar)

```text
Tu es le directeur photo d’un influenceur IA. Je te donne la photo de son avatar, et parfois la photo d’un produit. Tu écris des prompts pour un générateur d’images qui prend l’avatar en référence (Alexya, fonction Image). Le but : des photos qui ont l’air prises par une vraie personne avec un iPhone, jamais des photos de studio.

Étape 1. Avant d’écrire, pose-moi ces questions en une seule fois et attends mes réponses :
1. Identité : prénom fictif, âge apparent (adulte), ville, métier, loisirs, style vestimentaire, traits physiques à verrouiller (cheveux, yeux, peau, signes distinctifs, morphologie).
2. Combien de prompts, et pour quels moments ou quels lieux.
3. Un produit doit-il apparaître ? Si oui, je joins sa photo et je décris le packaging.

Étape 2. Écris les prompts en anglais, un paragraphe de 80 à 130 mots chacun, dans cet ordre :
- Verrou d’identité : « Same person as the reference photo: keep exactly … », suivi des traits verrouillés.
- Qui prend la photo (selfie caméra avant, selfie miroir, photo prise par un ami, téléphone posé) et le cadrage.
- Le lieu, l’action, la tenue, l’expression : spontanée, jamais posée comme en shooting.
- La lumière réelle du lieu (fenêtre, néon, soleil bas), avec ses défauts.
- Le rendu amateur : « amateur iPhone photo, vertical 9:16, light grain, slightly imperfect framing, a touch of motion blur, real skin texture, no retouching, no studio lighting, no heavy portrait blur ».
- Si produit : « Use the product reference image exactly as it is », la description du packaging, une taille réaliste, l’étiquette face caméra et lisible, un seul produit.
- Les interdits : « no added text, no logo or brand other than the product, no other recognisable person, no celebrity likeness ».

Règles de contenu, toujours :
- Adulte uniquement. Pas de lit ni de chambre, pas de nuit, pas d’écran au moment de prendre un complément, pas de corps qui se transforme, pas de pose de culturiste, pas de blouse ni de pharmacie, un seul produit et une seule dose.
- Le produit n’apparaît jamais à la salle de sport ni juste après un effort.
- Rien ne suggère un effet du produit sur le corps ou sur l’humeur.

Format de réponse : pour chaque prompt, un titre court en français, le prompt en anglais dans un bloc de code, puis une ligne « À vérifier : … » (mains, étiquette, cohérence du visage). Termine par ce rappel : format 9:16, qualité haute, importer l’avatar (et la photo produit) avant de générer.
```

Réponse à donner à l’étape 1 pour Ambrel : la fiche B.2 + « 5 prompts : salle de sport, footing, cuisine, bureau, matin » + « pas de produit pour ces 5 ». Pour B.5, envoie ensuite la photo `product/ambrel-pot-face.jpg` avec la phrase de la vidéo : « Génère-moi deux prompts d’elle qui tient ce produit dans les mains dans son quotidien. »

### B.4 Les 5 prompts photo, déjà écrits (sans produit)

Préfixe et suffixe communs (déjà inclus dans chaque prompt) : le verrou d’identité de la fiche B.2 et le rendu iPhone amateur.

**P1 · Salle de sport** (`influenceur/p1.jpg`)
```text
Same young woman as the reference photo (Maëlle, fictional virtual character, 31): keep exactly her face, copper-brown wavy shoulder-length hair with a middle part, green-hazel eyes, light freckles across nose and cheeks, small mole under the left eye, slim athletic build. Mirror selfie in a small neighbourhood gym, phone without visible logo held at chest height in her left hand, face fully visible. Plain stone-coloured sports top, black leggings, hair in a loose ponytail, slightly flushed cheeks, easy smile, standing casually with her weight on one leg, no flexing. Behind her: a dumbbell rack, rubber floor, a window; other people blurred and unrecognisable. Mixed neon and window light, the window a bit overexposed. Amateur iPhone photo, vertical 9:16, light grain, slightly imperfect framing, a touch of motion blur, real skin texture, no retouching, no studio lighting. No added text, no logo, no brand, no other recognisable person.
```

**P2 · Footing** (`influenceur/p2.jpg`)
```text
Same young woman as the reference photo (Maëlle, fictional virtual character, 31): keep exactly her face, copper-brown wavy shoulder-length hair with a middle part, green-hazel eyes, light freckles across nose and cheeks, small mole under the left eye, slim athletic build. Front-camera selfie at arm’s length during an early morning run on a riverside path in Lyon, slightly out of breath, genuine smile, a few strands of hair stuck to her forehead, plain deep-amber running jacket zipped up, earbuds without logo. Background: river, stone quay and trees, softly blurred; cool blue morning light with a warm sun flare at the edge of the frame; horizon slightly tilted. Amateur iPhone photo, vertical 9:16, light grain, slightly imperfect framing, a touch of motion blur, real skin texture, no retouching, no studio lighting. No added text, no logo, no brand, no other recognisable person.
```

**P3 · Cuisine** (`influenceur/p3.jpg`)
```text
Same young woman as the reference photo (Maëlle, fictional virtual character, 31): keep exactly her face, copper-brown wavy shoulder-length hair with a middle part, green-hazel eyes, light freckles across nose and cheeks, small mole under the left eye, slim athletic build. Candid photo taken by a friend in her small Lyon apartment kitchen in the evening. She is chopping vegetables on a wooden board, laughing and looking slightly off-camera, linen apron over a cream t-shirt, steam rising from a pot, warm light from a ceiling lamp. Slightly cluttered counter: plain jars without labels, a fruit bowl, a wooden spoon. Slightly soft focus. Amateur iPhone photo, vertical 9:16, light grain, slightly imperfect framing, a touch of motion blur, real skin texture, no retouching, no studio lighting. No added text, no logo, no brand, no other recognisable person.
```

**P4 · Bureau** (`influenceur/p4.jpg`)
```text
Same young woman as the reference photo (Maëlle, fictional virtual character, 31): keep exactly her face, copper-brown wavy shoulder-length hair with a middle part, green-hazel eyes, light freckles across nose and cheeks, small mole under the left eye, slim athletic build. Candid photo taken from across the desk in a bright open-plan office. She is writing in a paper notebook, pen in hand, focused half smile, cream knit cardigan over a white t-shirt; a plain ceramic mug and a closed laptop without logo on the desk. Daylight from large windows, colleagues in the background blurred and unrecognisable. Amateur iPhone photo, vertical 9:16, light grain, slightly imperfect framing, a touch of motion blur, real skin texture, no retouching, no studio lighting. No added text, no logo, no brand, no other recognisable person.
```

**P5 · Matin** (`influenceur/p5.jpg`)
```text
Same young woman as the reference photo (Maëlle, fictional virtual character, 31): keep exactly her face, copper-brown wavy shoulder-length hair with a middle part, green-hazel eyes, light freckles across nose and cheeks, small mole under the left eye, slim athletic build. Morning photo by the living-room window, taken by a friend from the side. She stands in an oversized linen shirt and loose trousers, holding a glass of water, looking out of the window with a calm half smile, hair a little messy. Soft golden sunrise light on her face, plants on the windowsill, a linen curtain moving slightly. Living room only: no bed, no bedroom. Amateur iPhone photo, vertical 9:16, light grain, slightly imperfect framing, a touch of motion blur, real skin texture, no retouching, no studio lighting. No added text, no logo, no brand, no other recognisable person.
```

### B.5 Deux prompts « elle tient le produit dans son quotidien »

Importe l’avatar **et** `product/ambrel-pot-face.jpg` avant de générer (comme dans la vidéo). Pas de selfie miroir avec le produit : le miroir inverse le texte de l’étiquette.

**P6 · Petit-déjeuner, pot en main** (`influenceur/p6.jpg`)
```text
Same young woman as the reference photo (Maëlle, fictional virtual character, 31): keep exactly her face, copper-brown wavy shoulder-length hair with a middle part, green-hazel eyes, light freckles across nose and cheeks, small mole under the left eye. Use the second reference image (the Ambrel jar) exactly as it is: amber glass jar, ribbed stone-coloured lid, cream label with the "ambrel" logo and a deep amber band, realistic size that fits in one hand. Candid photo taken by a friend at breakfast: she sits at a small wooden table by the kitchen window and holds the jar in her right hand at chest height, label facing the camera, sharp and readable, looking at the camera with an easy smile. A full glass of water and a simple breakfast (bread, fruit) on the table. Soft morning light. Only one jar, no loose capsules, no other product. Amateur iPhone photo, vertical 9:16, light grain, slightly imperfect framing, real skin texture, no retouching, no studio lighting. No added text, no other logo or brand, no other recognisable person.
```

**P7 · Départ à vélo, pot glissé dans le sac** (`influenceur/p7.jpg`)
```text
Same young woman as the reference photo (Maëlle, fictional virtual character, 31): keep exactly her face, copper-brown wavy shoulder-length hair with a middle part, green-hazel eyes, light freckles across nose and cheeks, small mole under the left eye. Use the second reference image (the Ambrel jar) exactly as it is: amber glass jar, ribbed stone-coloured lid, cream label with the "ambrel" logo and a deep amber band, realistic size that fits in one hand. Candid photo taken by a friend in her apartment entrance in the morning, just before leaving by bike: a canvas backpack on one shoulder, she holds the jar in her hand next to the open front pocket, label facing the camera and readable, smiling at the camera. Coat rack, a bike without brand leaning against the wall, daylight from the open door. Only one jar. Amateur iPhone photo, vertical 9:16, light grain, slightly imperfect framing, a touch of motion blur, real skin texture, no retouching, no studio lighting. No added text, no other logo or brand, no other recognisable person.
```

### B.6 Deux prompts de mouvement (photo → vidéo, 5 s, sans parole)

Comme dans la vidéo : on importe une photo générée et on décrit seulement le mouvement. Réglages : 9:16, 5 s, test en 720p puis finale en 1080p (C.1).

**M1 · depuis P6 (petit-déjeuner)**
```text
Vidéo verticale 9:16, 5 secondes, filmée au téléphone par une amie, léger tremblé de caméra à la main. Elle tourne doucement le pot d’un quart de tour pour que l’étiquette soit bien face à la caméra, le garde immobile une seconde, puis le pose à côté du verre d’eau et sourit en regardant la caméra. Mouvements lents et réalistes. Le visage, la tenue et le pot restent identiques à l’image de départ, étiquette nette. Aucune parole, son d’ambiance de cuisine discret, pas de musique, aucun texte incrusté.
```

**M2 · depuis P7 (départ à vélo)**
```text
Vidéo verticale 9:16, 5 secondes, filmée au téléphone par une amie, léger tremblé de caméra à la main. Elle fait un pas vers la caméra, passe sa main libre dans ses cheveux, glisse le pot dans la poche avant de son sac à dos, puis pose la main sur sa hanche et sourit. Mouvements fluides et réalistes. Le visage, la tenue et le pot restent identiques à l’image de départ ; l’étiquette reste lisible tant que le pot est visible. Aucune parole, pas de musique, aucun texte incrusté.
```

### B.7 Plan de publication sur 7 jours

3 posts produit sur 7 : le compte doit d’abord ressembler à une vie, pas à un catalogue.

| Jour | Format | Visuel | Produit | Légende (début) | Mentions sur le visuel |
|---|---|---|---|---|---|
| Lundi | Photo | P5 matin | non | « Lundi. Fenêtre ouverte, un grand verre d’eau, on y va. » | Images virtuelles |
| Mardi | Photo | P6 petit-déjeuner | **oui** | « Au petit-déj, je lis l’étiquette : magnésium bisglycinate + vitamine B6, trois gélules par jour. » puis `legal.short` | Collaboration commerciale avec Ambrel · Images virtuelles |
| Mercredi | Photo | P2 footing | non | « Les quais étaient vides ce matin. » | Images virtuelles |
| Jeudi | Reel 5 s | M1 (depuis P6) | **oui** | « Le magnésium et la vitamine B6 contribuent à réduire la fatigue. Tout est écrit sur le pot : 300 mg de magnésium (80 % VNR), 1,4 mg de vitamine B6 (100 % VNR). » puis `legal.full` | Collaboration commerciale avec Ambrel · Images virtuelles (toute la durée) |
| Vendredi | Carrousel | P4 bureau + P3 cuisine | non | « Carnet papier le jour, légumes le soir. » | Images virtuelles |
| Samedi | Photo | P1 salle de sport | non (jamais de produit à la salle) | « Séance du samedi, sans chrono. » | Images virtuelles |
| Dimanche | Reel 5 s | M2 (depuis P7) | **oui** | « Dans le sac avant de partir : 60 gélules végétales, sans arôme ni édulcorant. » puis `legal.short` | Collaboration commerciale avec Ambrel · Images virtuelles (toute la durée) |

À la fin de chaque légende : « Ambrel est une marque fictive (démonstration). » (`legal.fictive`). Publie en ciblage 18 ans et plus.

### B.8 Mentions « Images virtuelles » et étiquetage IA

- **Sur chaque photo et chaque vidéo** où l’on voit le visage ou la silhouette de l’avatar : « Images virtuelles » (`AMBREL.mentions.virtual`, loi 2023-451, art. 5), sur l’image elle-même et pas seulement dans la légende. Elle doit être lisible ; sur une vidéo, elle reste affichée tout du long. Copie le libellé de `brand.js` sans le reformuler.
- **Sur chaque post produit** : « Collaboration commerciale avec Ambrel » (brand-system §15), visible sur le visuel, plus l’outil « partenariat rémunéré » de la plateforme.
- **Bio du compte** : « Personnage virtuel », pour que personne ne prenne Maëlle pour une personne réelle. En message privé, ne te fais jamais passer pour un humain (AI Act, art. 50).
- **Étiquette IA de la plateforme** activée sur chaque post (AI Act, art. 50.4 : signalement dès la première exposition).
- **Légendes** : allégation mot pour mot depuis `AMBREL.claims`, suivie du texte `legal.full` ; sans allégation, `legal.short`. Pas d’avant/après, pas de promesse sur les muscles ou la silhouette, pas de résultat vécu. <!-- lint-ok -->

---

## C. Lancer la génération

### C.1 Quel outil, quel modèle

| Usage | Outil et modèle | Test | Finale | Images de référence |
|---|---|---|---|---|
| UGC parlé en français (A) | vidIQ `gemini-omni-flash` (son inclus, 3 à 10 s) ou Alexya **Omni** | 720p · 9:16 · 4 s | 720p · 8 s | jusqu’à 3 (`ingredients`) : acteur, pot, étiquette |
| UGC en 1080p | Alexya Omni si l’option 1080p est proposée ; sinon vidIQ `veo-3.1-fast` ou `veo-3.1` | 1 rendu de mesure (C.3) | 1080p · 9:16 · 8 s (8 s obligatoire avec `ingredients` chez Veo) | jusqu’à 3, JPEG ou PNG. Vérifie la diction française sur un premier test. |
| Mouvement influenceur (B.6) et plans cinématiques sans parole | vidIQ `seedance-2-fast` puis `seedance-2` ; Alexya Vidéo ou Seedance | `seedance-2-fast` · 720p · 5 s | `seedance-2` · 1080p · 5 s (1 à 15 s possibles) | la photo en `startFrameB64`, ou jusqu’à 9 `ingredients` |

Dans vidIQ, `gemini-omni-flash` plafonne à 720p. Une UGC « amateur » peut être livrée en 720p remis à l’échelle 1080×1920 au montage (A.3). Ne paie le 1080p qu’après validation du 720p.

### C.2 vidIQ pas à pas (dans une session Claude avec le connecteur vidIQ)

1. `vidiq_balance` (gratuit) : note `totalCredits`.
2. Estime le lot (C.3) et annonce le total avant de lancer plusieurs plans.
3. Demande à Claude : « Encode en base64 `actors/ines-576.jpg`, `product/ambrel-pot-face-480.jpg` et `product/ambrel-etiquette-face-480.jpg`, puis lance `vidiq_generate_video` avec le prompt A1 4 s. » Les images passent en base64 dans l’appel (10 Mo maximum chacune) : utilise les versions légères `-480.jpg` (20 à 40 Ko) et réduis l’acteur de la même façon (`ffmpeg -i actors/ines.jpg -vf scale=576:-2 -q:v 4 actors/ines-576.jpg`).

```json
{
  "model": "gemini-omni-flash",
  "aspectRatio": "9:16",
  "resolution": "720p",
  "duration": 4,
  "ingredients": ["<base64 actors/ines-576.jpg>", "<base64 product/ambrel-pot-face-480.jpg>", "<base64 product/ambrel-etiquette-face-480.jpg>"],
  "prompt": "<prompt A1 4 s, copié tel quel>"
}
```
Pour le mouvement (B.6) : `"model": "seedance-2-fast", "resolution": "720p", "duration": 5, "startFrameB64": "<base64 influenceur/p6.jpg>"`, sans `ingredients` (les deux sont exclusifs).

4. L’appel renvoie un `mcpJobId`. Interroge `vidiq_job_poll` (gratuit) toutes les 30 s environ, jusqu’à `completed`. Un échec (`failed`, `expired`) est remboursé automatiquement.
5. Ne relance jamais un plan en cours ou déjà livré. Si l’appel répond `duplicate_submission`, interroge le job existant. `confirmNewAttempt: true` ne sert que pour une nouvelle version payante demandée explicitement. Après `content_policy_rejected` ou `invalid_input`, modifie le prompt avant de relancer.
6. Télécharge tout de suite (l’URL signée expire) : `curl -L -o out/a1-routine-4s-720p.mp4 "<url>"`. Nommage : `out/<variante>-<durée>-<résolution>.mp4`.
7. Passe la checklist C.5, puis seulement ensuite la version 8 s ou 1080p.

### C.3 Estimer les crédits avant de lancer

vidIQ facture **durée (s) × tarif du modèle par seconde × 20 crédits**. Le coût exact est annoncé et débité à la soumission. Le tarif par seconde n’est pas publié dans l’outil : mesure-le une fois par couple modèle et résolution.

1. `vidiq_balance` → solde S0.
2. Lance le premier test (par exemple A1, 4 s, `gemini-omni-flash`, 720p) et note le coût annoncé, ou relis le solde → S1.
3. Coût d’une seconde pour ce couple : **k = (S0 − S1) / 4**. Le tarif du modèle vaut k / 20.
4. Remplis le tableau, multiplie par **1,3** pour les reprises et compare au solde. Si ça ne passe pas, garde les finales en 720p ou retire une variante.

| Lot | Modèle · résolution | Rendus | Secondes | Crédits |
|---|---|---|---|---|
| A tests | `gemini-omni-flash` · 720p | 4 × 4 s | 16 | 16 × k(omni 720p) |
| A finales | `gemini-omni-flash` · 720p | 4 × 8 s | 32 | 32 × k(omni 720p) |
| A finales 1080p (option) | `veo-3.1-fast` · 1080p | 4 × 8 s | 32 | 32 × k(veo 1080p), à mesurer d’abord sur 1 rendu |
| B tests | `seedance-2-fast` · 720p | 2 × 5 s | 10 | 10 × k(seedance-fast 720p) |
| B finales | `seedance-2` · 1080p | 2 × 5 s | 10 | 10 × k(seedance 1080p) |
| D démos | `gemini-omni-flash` · 720p | N × 4 s par jour | 4N | 4N × k(omni 720p) |

Dans Alexya, applique la même méthode : regarde le solde avant et après le premier test 720p · 4 s (le réglage le moins cher, d’après la vidéo source), puis multiplie.

### C.4 Alexya pas à pas (le chemin de la vidéo source)

- **UGC** : fonction **Omni** → importe l’acteur puis le produit → **720p, 9:16, 4 s** → colle le prompt (réplique courte entre guillemets) → Générer. Si le test est bon : 8 s, puis 1080p.
- **Avatar** (B.1) → **Image** : 9:16, qualité haute, avatar importé (et la photo produit pour B.5).
- **Vidéo** (B.6) : importe une photo générée et décris seulement le mouvement.
- **Seedance** (plans cinématiques) : images en **Multimodal Référence** (pas en « Frame »), test en 480p, puis régénération en 1080p une fois le rendu validé.

### C.5 Checklist QA (pour chaque rendu, avant d’aller plus loin)

**Mains**
- [ ] 5 doigts par main, pas de doigt fusionné, en trop ou qui traverse le pot.
- [ ] Prise crédible : le pot repose dans la main, il ne flotte pas, sa taille reste constante.

**Étiquette et produit**
- [ ] « ambrel », « Magnésium bisglycinate », « + VITAMINE B6 » et « 60 gélules végétales » lisibles au moins 1 s, sans lettre inventée.
- [ ] Verre ambré, couvercle strié couleur pierre, étiquette crème avec bandeau ambre profond : identiques à `product/ambrel-pot-face.jpg`.
- [ ] Si le texte bave : relance avec l’étiquette en 3e image, ou cadre pour que l’étiquette soit nette sur un moment. On ne publie jamais une étiquette au texte faux, car ce serait une mention fausse.

**Synchro labiale et voix**
- [ ] Les lèvres suivent toute la phrase, sans décalage ni bouche figée.
- [ ] La réplique est dite mot pour mot : aucun mot ajouté (pas de « franchement, il est incroyable » improvisé), rien de coupé en fin de clip.
- [ ] Prononciation correcte de « bisglycinate », « B6 » (« bé six ») et « magnésium ». Voix cohérente avec la fiche (âge, ton).

**Artefacts**
- [ ] Le visage reste le même du début à la fin. Pas d’yeux, de dents ou de clignements étranges.
- [ ] Pas de cheveux qui fusionnent, d’objet qui apparaît, de gélules qui se multiplient ou de décor qui se déforme.
- [ ] Pas de texte parasite, de logo tiers, de scintillement, ni de mouvement accéléré ou ralenti.

**Conformité et technique**
- [ ] Aucun visuel interdit (§0). Réplique conforme à `brand.js` (`node tools/lint-copy.mjs` : 0 erreur).
- [ ] Ouverture 0 à 2,2 s, badge permanent, carton final de 4 s, « Ambrel est une marque fictive (démonstration). »
- [ ] 9:16, 1080×1920 après montage, 30 fps, -14 LUFS (`tools/qa.sh`). Zones de sécurité respectées.

---

## D. Prospection : la démo personnalisée gratuite

La dernière étape de la vidéo : au lieu d’un message générique, on envoie à chaque marque une vidéo faite pour son produit, gratuite, avec une proposition d’appel. Ambrel reste la vitrine publique ; les démos pour de vraies marques restent privées.

### D.1 Construire le brand system d’une vraie marque (depuis sa page produit publique)

Colle ce prompt dans Claude (avec la navigation web activée) :

```text
Tu es directeur de création d’une agence vidéo IA. Voici la page produit publique d’une marque : {URL}. Lis-la, ainsi que les pages publiques du même site : accueil, à propos, contact, mentions légales. Rien d’autre.
Rends un brand system en français, en Markdown, avec ces sections :
0. En bref : marque, produit phare, contenance et prix affichés, public, signature, CTA du site.
1. Produits : la liste, et le produit phare avec la raison (mis en avant sur l’accueil, mention « best-seller » du site…).
2. Bénéfices tels qu’ils sont écrits sur la page : copie exacte entre guillemets, avec l’URL de la section.
3. Allégations : pour chaque allégation santé ou nutritionnelle de la page, indique si elle figure mot pour mot dans le registre de l’UE (règlement 432/2012). Classe-les en « utilisable telle quelle » ou « à ne pas reprendre ». Je n’utiliserai que les premières.
4. Direction artistique : couleurs (codes hex relevés dans le CSS ou les visuels), typographies, style photo, lumière, décors, ce que la marque ne montre jamais.
5. Ton : tutoiement ou vouvoiement, longueur des phrases, mots récurrents, 3 phrases types du site.
6. Packaging : forme, couleurs, textes visibles en face avant (pour vérifier la lisibilité dans la vidéo).
7. Contacts professionnels publics : adresse générique (contact@, partenariats@, presse@), page LinkedIn de l’entreprise, compte Instagram, raison sociale relevée dans les mentions légales, avec la source de chaque donnée. Pas de numéro ni d’adresse personnels.
8. 3 angles de démo UGC de 4 s, chacun avec sa réplique entre guillemets (3 s parlées au plus), écrite uniquement avec des faits de la page et des allégations « utilisables telles quelles ».
N’invente rien : si une information manque, écris « non trouvé ».
```

Enregistre la réponse dans `prospects/<marque>/brand-system.md` (dossier privé, hors du portfolio).

### D.2 La démo en 1 minute

1. Télécharge la photo produit de la page (fond uni, face avant). Elle sert uniquement à cette démo privée.
2. Choisis un acteur du casting A.1. Jamais le fondateur, un ambassadeur ou un visage réel.
3. Omni : acteur + produit, **720p · 9:16 · 4 s**, prompt sur le modèle de la vidéo : « Cette femme (image 1) tient dans les mains {produit, décrit en une ligne} (image 2), étiquette face caméra. Elle regarde la caméra et dit en français : « {réplique du premier angle de D.1} » Pas de musique, pas de sous-titres, aucun texte incrusté. »
4. Contrôle rapide (C.5 : mains, étiquette, synchro), puis ajoute en surimpression permanente « Maquette non officielle · Démo gratuite · Contenu généré par IA » et le nom de ton studio. Exporte `prospects/<marque>/<marque>-demo-ugc-4s.mp4`.
5. Envoie la démo en privé (fichier joint, ou lien non répertorié qui expire). Ne la publie jamais.
6. Bonus fatigue créative : 3 accroches sur le même corps, comme V1 (brand-system §14). C’est l’argument des contrats mensuels.

### D.3 Trois modèles de messages

**1 · Message privé Instagram (vidéo jointe)**
```text
Bonjour {Prénom}, je suis {Prénom}, je fais des vidéos publicitaires créées avec l’IA pour des marques {secteur}. J’ai préparé une démo de 4 secondes pour {Produit}, à partir de votre page produit : la voici. Elle est gratuite et privée, rien n’est publié. Qu’en pensez-vous ? Si le format vous plaît, je peux décliner 3 accroches sur la même vidéo pour vos publicités. On en parle 15 minutes cette semaine ?
```

**2 · E-mail B2B**
```text
Objet : {Produit} : une démo vidéo de 4 s (offerte, privée)

Bonjour {Prénom},

Je suis {Prénom Nom}, fondateur de {Studio}, studio de vidéos publicitaires créées avec l’IA pour les marques {secteur}.
J’ai réalisé pour {Marque} une courte démo au format UGC, à partir de votre page {Produit} : {lien privé, valable 14 jours}.
- 4 secondes, format 9:16, prête pour Reels et TikTok ;
- acteur virtuel, texte repris de votre page, aucune promesse ajoutée ;
- elle reste privée : rien n’est publié sans votre accord écrit.

Si elle vous parle, je peux décliner 3 accroches sur la même base pour tester vos publicités. Un appel de 15 minutes jeudi ou vendredi ?

Bonne journée,
{Prénom Nom} · {Studio} · SIREN {numéro} · {adresse} · {téléphone pro}

J’ai trouvé votre adresse sur {source : page contact de votre site}. Pour ne plus recevoir de message de ma part, répondez « stop » : je vous retire de ma liste le jour même.
```

**3 · Relance J+4 (e-mail ou LinkedIn)**
```text
Bonjour {Prénom}, je reviens vers vous au sujet de la démo vidéo pour {Produit} envoyée {jour}. J’en ai fait une deuxième version avec une autre accroche, pour montrer comment on renouvelle une publicité quand elle s’essouffle : {lien privé}. Si ce n’est pas le bon moment, dites-le-moi simplement et je ne vous relancerai plus. {Prénom}
```

### D.4 Routine : 20 à 30 messages par jour

| Créneau | Durée | Tâche | Résultat |
|---|---|---|---|
| 1 | 30 min | Trouver 10 marques : petites ou moyennes, e-commerce actif, publicités en cours (bibliothèque publicitaire de Meta), produit phare clair | 10 lignes dans le tableau de suivi |
| 2 | 30 min | Brand system express (D.1) pour les 5 plus prometteuses | 5 fiches |
| 3 | 30 min | 5 démos de 4 s (D.2), budget = 5 × 4 × k(omni 720p) | 5 vidéos privées |
| 4 | 45 min | 20 à 30 messages personnalisés : les 5 démos, puis des messages avec une accroche écrite pour leur produit (message privé, e-mail, LinkedIn). Appel téléphonique possible, au standard de la marque | 20 à 30 envois |
| 5 | 20 min | Relances J+4 et J+10 (2 au maximum), réponses, prises de rendez-vous, demandes de retrait | tableau à jour |

Tableau de suivi : `Marque · URL page produit · Contact (adresse générique pro) · Source · Canal · Démo (lien privé) · Envoi · Relance 1 · Relance 2 · Réponse · RDV · Opposition (oui/non)`. Chaque semaine, compare le taux de réponse avec et sans démo, puis par canal, et garde ce qui marche.

### D.5 Conformité (à relire avant chaque envoi)

- **Allégations** : seulement celles du registre de l’UE (règlement 432/2012) que la marque utilise déjà, mot pour mot. C’est le nutriment qui contribue, pas le produit. Si la vidéo contient une allégation, le carton final reprend la phrase de l’article 10.2 du règlement 1924/2006. Pour Ambrel, tout est déjà dans `brand.js`.
- **Mention IA** : même en privé, la démo porte « Contenu généré par IA ». Si elle est publiée un jour, toutes les mentions de A.3 et B.8 s’appliquent, plus l’étiquette IA de la plateforme.
- **Jamais de publication sans accord écrit** : aucune démo pour une vraie marque ne va sur tes réseaux, ton portfolio ou en publicité sans un accord écrit de la marque (devis ou contrat avec cession des droits). La photo produit, le logo et les textes lui appartiennent. Ton portfolio public, c’est Ambrel.
- **Personnes** : jamais le visage ou la voix du fondateur, d’un ambassadeur ou d’une célébrité. Jamais de faux avis client. <!-- lint-ok -->
- **Promesses commerciales** : ne promets aucun résultat publicitaire chiffré.
- **RGPD et prospection B2B en France (repères CNIL)** : <!-- lint-ok -->
  - Un e-mail de prospection vers une adresse professionnelle est possible sans consentement préalable s’il concerne le métier de la personne. Sinon, il faut son consentement. Préfère les adresses génériques (contact@).
  - Dans chaque message : qui tu es, où tu as trouvé l’adresse, et un moyen simple et gratuit de refuser la suite (art. L34-5 du CPCE, art. 14 et 21 du RGPD). Un « stop » est appliqué le jour même et l’adresse va dans une liste d’opposition.
  - Collecte le minimum : nom, fonction, e-mail pro, entreprise, source, dates. Rien de personnel (mobile privé, comptes perso).
  - Durée : supprime un prospect sans réponse 3 ans après le dernier contact.
  - Données personnelles publiques ne veut pas dire libres. Respecte les conditions des plateformes (LinkedIn interdit l’extraction automatisée) et envoie les messages privés à la main, dans les limites de chaque réseau.
  - Note cette activité de prospection dans ton registre des traitements (un simple tableau suffit) et choisis un outil d’e-mailing qui héberge les données dans l’UE ou offre des garanties équivalentes. <!-- lint-ok -->
  - Téléphone : uniquement les numéros professionnels de l’entreprise.
