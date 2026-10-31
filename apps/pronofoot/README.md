# Prono · analyse football

Application web installable (PWA), sans dépendance ni build : tous les matchs de football du monde du jour, un pronostic 1N2 chiffré pour chacun, le direct et des alertes.

## Lancer

```sh
cd apps/pronofoot && python3 -m http.server 8765
# puis http://localhost:8765
```

En ligne : https://pierrernrd04-ai.github.io/Vous-/prono/ (branche `gh-pages`, dossier `prono/`). Sur iPhone : ouvrir dans Safari, Partager, puis « Sur l'écran d'accueil ». Les notifications ne marchent qu'une fois l'app installée sur l'écran d'accueil.

## Ce que fait l'app

- **Matchs** : environ 300 matchs par jour (hier, aujourd'hui, demain), classés par championnat, filtres Direct / À venir / Terminés, « Top ligues » ou « Monde », recherche, matchs suivis ★.
- **Pronostic** pour chaque match : probabilités 1 / N / 2, choix conseillé avec son niveau de fiabilité mesuré, double chance quand c'est serré, scores les plus probables, buts attendus, plus de 2,5 buts, les deux équipes marquent, puissance attaque et défense.
- **Sûrs** : les pronos à 65 % ou plus de la journée.
- **Fiche match** : forme (5 derniers matchs avec scores), classement, face-à-face, meilleurs buteurs et passeurs, compositions quand elles sont publiées, buteurs et cartons rouges en direct.
- **Direct** : actualisation toutes les 30 s pendant les matchs, 2 min avant un coup d'envoi, 10 min sinon.
- **Alertes** : buts (buteur, minute, nouvelles probabilités), but annulé, carton rouge, coup d'envoi, mi-temps, fin de match avec le verdict, 15 min avant les matchs suivis, rappel à :00 et :30. Son et vibration, pastille sur l'icône, et un toucher sur l'alerte ouvre le match. Équipes favorites : tous leurs matchs sont suivis.
- **Bilan** : chaque prono est figé avant le coup d'envoi puis comparé au score final (taux de réussite, comparé au simple favori du marché).

## Le modèle (v2)

1. **Notation des équipes** (`rating.js`) : pour chaque grand championnat, l'app télécharge les 14 derniers mois de matchs. Elle en tire une note d'attaque et de défense par équipe (modèle de Poisson de Maher / Dixon-Coles), les matchs récents comptant plus (demi-vie d'environ 230 jours). La note mélange buts réels (40 %) et tirs cadrés (60 %) : les tirs cadrés sont plus stables, donc plus prédictifs.
2. À défaut de notation : forme sur les 5 derniers matchs et classement.
3. Loi de Poisson avec la correction Dixon-Coles des petits scores, ce qui donne toute la grille des scores. Le volume de buts est calé sur la ligne plus/moins de 2,5 buts du marché.
4. **Mise en commun logarithmique avec les cotes** (85 % marché, 15 % modèle) quand des cotes existent.
5. **Fiabilité mesurée** : chaque prono affiche le taux de réussite réellement observé à son niveau de probabilité.
6. **En direct** : les probabilités sont recalculées selon le score, la minute et les cartons rouges.

### Backtest (1 971 matchs, 5 grands championnats, mi-septembre 2025 à octobre 2026)

Chaque prono n'utilise que les matchs joués avant sa date (football-data.co.uk, cotes de clôture moyennes).

| Méthode | Log-loss | Réussite 1N2 |
|---|---|---|
| Modèle buts seuls | 1,003 | 51,5 % |
| Modèle buts + tirs cadrés | 0,995 | 52,0 % |
| Cotes du marché seules | 0,976 | 53,6 % |
| Synthèse 85 % marché | 0,977 | 53,3 % |

| Niveau | Probabilité | Réussite mesurée | Double chance |
|---|---|---|---|
| Très sûr | ≥ 75 % | 87,5 % (88 matchs) | 97,7 % |
| Sûr | 65 à 75 % | 75,6 % (193) | 91,7 % |
| Solide | 55 à 65 % | 61,1 % (380) | 84,5 % |
| Serré | 45 à 55 % | 50,5 % (576) | 78,5 % |
| Incertain | < 45 % | 41,8 % (734) | 71,7 % |

Ce qu'on en retient honnêtement :
- Les cotes de clôture restent le meilleur prédicteur : aucun modèle statistique public ne les bat sur le long terme.
- Les « value bets » (le modèle au-dessus de la cote) auraient perdu environ 20 % des mises : la fonction a été retirée.
- Jouer systématiquement les favoris à 65 % ou plus revient à peu près à l'équilibre (+0,8 % sur 310 paris).
- Aucun outil n'atteint 100 %.

## Données

API publique ESPN (`site.api.espn.com`, sans clé, CORS ouvert). Les cotes affichées sont des cotes de référence (DraftKings) : ce ne sont pas celles de Betclic. Betclic n'a pas d'API publique, et se connecter à un compte personnel par un robot est contraire à ses conditions d'utilisation.

## Limites

Les alertes partent tant que l'app est ouverte : iOS met en pause les apps web peu après leur fermeture. Pour recevoir des alertes avec l'app complètement fermée, il faut un serveur d'envoi Web Push (Worker Cloudflare ou fonction planifiée Netlify). GitHub Actions ne convient pas : ses conditions d'utilisation interdisent de s'en servir comme serveur permanent.
