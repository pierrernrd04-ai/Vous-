# Prono · analyse football

Application web installable (PWA), sans dépendance ni build : tous les matchs de football du monde du jour, un pronostic 1N2 chiffré pour chacun, le direct et des alertes.

## Lancer

```sh
cd apps/pronofoot && python3 -m http.server 8765
# puis http://localhost:8765
```

Pour l'avoir sur téléphone : héberger le dossier tel quel (Netlify, Cloudflare Pages, GitHub Pages), l'ouvrir puis « Ajouter à l'écran d'accueil ». Sur iPhone, les notifications ne marchent qu'une fois l'app installée sur l'écran d'accueil.

## Ce que fait l'app

- **Matchs** : environ 300 matchs par jour (hier, aujourd'hui, demain), classés par championnat, filtres Direct / À venir / Terminés, « Top ligues » ou « Monde », recherche, matchs suivis ★.
- **Pronostic** pour chaque match : probabilités 1 / N / 2, choix conseillé, double chance quand c'est serré, score le plus probable, buts attendus, plus de 2,5 buts, les deux équipes marquent, indice de confiance, et des « value bets » quand le modèle est nettement au-dessus de la cote.
- **Fiche match** : forme (5 derniers matchs avec scores), classement, face-à-face, meilleurs buteurs et passeurs, compositions quand elles sont publiées, buteurs et cartons rouges en direct.
- **Direct** : actualisation toutes les 30 s pendant les matchs, 2 min avant un coup d'envoi, 10 min sinon.
- **Alertes** : chaque but (buteur et minute), coup d'envoi avec le prono, fin de match avec le verdict, rappel à :00 et :30 des matchs des 3 prochaines heures.
- **Bilan** : chaque prono est figé avant le coup d'envoi puis comparé au score final (taux de réussite, comparé au simple favori du marché).

## Le modèle (`model.js`)

1. Buts attendus de base selon domicile / extérieur.
2. Attaque et défense sur les 5 derniers matchs, les plus récents comptant plus, ramenées vers la moyenne quand il y a peu de matchs.
3. Niveau de la saison : différence de buts et points par match au classement.
4. Face-à-face (effet léger).
5. Volume de buts calé sur la ligne plus/moins de 2,5 du marché.
6. Loi de Poisson avec la correction Dixon-Coles pour les petits scores, ce qui donne toute la grille des scores.
7. Mélange 60 % marché sans marge et 40 % modèle quand des cotes existent.

Aucun modèle ne peut être fiable à 100 % : sur le 1N2, les meilleurs modèles professionnels tournent autour de 50 à 55 % de réussite. L'onglet Bilan mesure la réussite réelle, sans arrangement.

## Données

API publique ESPN (`site.api.espn.com`, sans clé, CORS ouvert). Les cotes affichées sont des cotes de référence (DraftKings) : ce ne sont pas celles de Betclic. Betclic n'a pas d'API publique, et se connecter à un compte personnel par un robot est contraire à ses conditions d'utilisation.

## Limites

Les alertes partent tant que l'app est ouverte, au premier plan ou en arrière-plan. Pour recevoir des alertes avec l'app complètement fermée, il faudrait un petit serveur de notifications push (Web Push), par exemple un Worker Cloudflare avec une tâche planifiée.
