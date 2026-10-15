# SAV — Automatise ta petite entreprise avec des agents IA

Réponses communes (accès, paiement, remboursement) : voir `_commun/sav.md`.

## FAQ spécifique

**1. Quel outil d'automatisation me conseilles-tu ?**
Le cours ne recommande pas un outil en particulier : il donne des critères (connecteurs disponibles, hébergement, localisation des données, modèle de prix, lisibilité des erreurs). Teste un seul scénario sur l'offre d'essai de deux outils et garde celui qui te paraît le plus clair.

**2. Les menus de mon outil ne correspondent pas à ce que je lis.**
C'est normal : le cours décrit la logique (déclencheur → étapes → sortie) et les prompts, pas des boutons, parce que les interfaces changent souvent. Cherche dans la documentation de ton outil le nom local de chaque étape (« déclencheur », « condition », « requête HTTP », « boucle »).

**3. Combien vont me coûter les outils ?**
Ça dépend de la plateforme, du modèle et de ton volume. La leçon 6.3 explique comment estimer la consommation et fixer une limite de dépense. Les abonnements aux outils ne sont pas inclus dans le prix de la masterclass.

**4. Le modèle me renvoie du texte au lieu du JSON demandé.**
Vérifie que la consigne « Réponds uniquement avec un objet JSON valide, sans texte avant ni après » est bien présente, baisse la température, et utilise l'option de sortie structurée si ton outil ou ton fournisseur la propose. Ajoute une étape de validation qui envoie les réponses invalides en traitement manuel.

**5. Puis-je envoyer les réponses automatiquement, sans brouillon ?**
Le cours le déconseille pour tout ce qui engage un prix, un délai ou une relation client. Pour des cas à faible risque, seulement après des semaines de relecture sans erreur importante (leçon 6.1).

**6. Est-ce conforme au RGPD ?**
Le module 6 donne les principes (minimisation, sous-traitants, conservation, information, registre). La conformité dépend de ta situation et de tes outils : vérifie les conditions de tes fournisseurs et consulte les guides de la CNIL, ou fais-toi accompagner.

**7. J'ai déjà un abonnement à un assistant IA, ça suffit ?**
Un abonnement « chat » sert à converser ; pour les automatisations, il faut généralement un accès API, facturé séparément. Vérifie l'offre de ton fournisseur.

**8. Mon scénario s'arrête sans prévenir.**
Le plus souvent : connexion expirée ou champ renommé dans un outil. Active les alertes d'échec et consulte la leçon 7.4.

**9. Tu peux construire l'automatisation pour moi ?**
Le SAV répond aux questions sur le contenu du cours, mais n'inclut pas de mise en place sur tes comptes.

## Réponses prêtes à envoyer

**A1 — « Mon automatisation classe mal certains e-mails. »**
> Bonjour [prénom],
>
> Merci pour ton message, c'est l'étape normale de réglage. Trois pistes, dans l'ordre :
>
> 1. Note 5 à 10 e-mails mal classés et regarde s'ils ont un point commun (même catégorie, même type d'expéditeur).
> 2. Réécris la définition de la catégorie concernée dans le prompt de façon plus explicite, avec un exemple de ce qui en fait partie et de ce qui n'en fait pas partie.
> 3. Repasse tout ton jeu de test (les 20 cas du module 4 + les cas ratés) avant de publier la nouvelle version, comme expliqué leçon 7.2.
>
> Si tu veux, envoie-moi ton prompt (sans données personnelles) et un exemple anonymisé, je te dis ce que je changerais.
>
> Pierre

**A2 — « Ma facture d'API est plus élevée que prévu. »**
> Bonjour [prénom],
>
> Bon réflexe de surveiller. Vérifie dans cet ordre :
>
> 1. Une boucle : un scénario qui se redéclenche lui-même (réponse à une réponse automatique, par exemple). Regarde le nombre d'exécutions par jour.
> 2. Le filtre avant l'IA : les newsletters et notifications sont-elles bien exclues ?
> 3. La longueur des textes envoyés : tronque les corps d'e-mails et les articles à la partie utile.
> 4. Le modèle : pour classer ou extraire, un modèle plus léger suffit souvent.
>
> Pense aussi à fixer une limite de dépense et une alerte dans la console de ton fournisseur (leçon 6.3).
>
> Pierre

**A3 — « Est-ce que je peux mettre les e-mails de mes clients dans l'IA ? »**
> Bonjour [prénom],
>
> Oui, c'est possible, mais avec des précautions, détaillées dans la leçon 6.2 : n'envoyer au modèle que le nécessaire (pas de pièces jointes, signatures tronquées), vérifier les conditions de tes fournisseurs (accord de traitement des données, localisation, non-utilisation pour l'entraînement), limiter la conservation de l'historique, mettre à jour ta politique de confidentialité et ton registre des traitements. Pas de données sensibles (santé, données bancaires, etc.).
>
> Je ne peux pas te donner de conseil juridique personnalisé : pour ton cas précis, les guides de la CNIL (cnil.fr) sont un bon point de départ, et un professionnel peut t'accompagner.
>
> Pierre
