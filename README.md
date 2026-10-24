# Le Petit Atlas

Jeu de géographie au chrono, pensé pour le mobile, sur une carte façon vieil atlas.

## Modes

|  | Je nomme | Je situe |
|---|---|---|
| **Pays** | Un pays est surligné sur la carte, tu écris son nom. | Un nom s'affiche, tu touches le pays pour le sélectionner, puis tu le retouches (ou « Sélectionner ») pour valider. |
| **Capitales** | Un pays est surligné et sa capitale marquée d'une étoile, tu écris le nom de la capitale. | Un nom de capitale s'affiche, tu touches son emplacement, puis tu valides de la même façon (tolérance : 250 km). |

- Régions : Monde, Europe, Afrique, Asie, Amériques, Océanie.
- La carte boucle horizontalement : on peut la faire défiler indéfiniment vers la gauche ou vers la droite (le Pacifique se prolonge sans coupure).
- Séries de 10, 20 ou toutes les questions de la région.
- Chaque question a un temps imparti (20 s en « je nomme », 15 s en « je situe »). Quand il s'écoule, la réponse est révélée ; que la réponse soit bonne ou non, le compte à rebours s'arrête jusqu'à ce que le joueur passe à la suite (bouton « Suivant », touche Entrée ou un tap n'importe où sur la carte).
- Le score est le nombre de bonnes réponses ; le temps total (compte à rebours en pause pendant les révélations) n'est qu'une information en plus. Le meilleur score par configuration (à égalité, le plus rapide) est gardé dans le `localStorage`.
- Saisie tolérante : accents, majuscules, tirets, « St/Saint », fautes de frappe (selon la longueur du nom) et noms alternatifs (« RDC », « Birmanie », « Kyiv »…). Une saisie qui correspond plus nettement à un autre pays est refusée (« Niger » ne valide pas « Nigeria »).

## Lancer en local

```bash
npm install
npm run dev      # http://localhost:4817
npm test         # tests de la tolérance orthographique et de la cohérence des données
npm run build    # sortie dans dist/
```

## Données

Générées par `npm run data` (`scripts/build-data.mjs`) puis versionnées :

- **Pays** : [mledoze/countries](https://github.com/mledoze/countries) (ISO 3166-1, noms français, régions) — 194 États souverains.
- **Capitales** (nom français + coordonnées) : [Wikidata](https://www.wikidata.org) (propriété P36), avec une capitale principale choisie quand un pays en a plusieurs (Bolivie, Afrique du Sud…) ; les autres restent acceptées.
- **Géométries** : [Natural Earth](https://www.naturalearthdata.com) 1:50m via [world-atlas](https://github.com/topojson/world-atlas) (domaine public). Somaliland, Chypre du Nord et Siachen sont rattachés à leur pays.

Les États trop petits pour être touchés au doigt reçoivent une pastille tactile en mode « je situe ». Tuvalu n'a pas de polygone à cette échelle : il est représenté par sa pastille.

## Technique

React 19, TypeScript, Vite, MUI (thème sur mesure), D3 (`d3-geo` et `d3-geo-projection` pour la projection Miller (carte plate) et les tracés, `d3-zoom` pour le pincement et le déplacement), TopoJSON.

### Performances

- La carte est dessinée sur un `<canvas>` : tracés `Path2D` précalculés, niveau de détail réduit en vue d'ensemble, élimination des pays hors écran.
- Pendant un déplacement, le fond de carte est une image mise en cache (avec marge, et répétée horizontalement) : chaque image ne coûte qu'un `drawImage` plus les surcouches (réponses, repères, libellés).
- Rendu à la demande uniquement (rien ne tourne quand la carte est immobile), résolution plafonnée à 2×, chrono à 4 Hz et mis en pause quand l'onglet est masqué.
- Le mini globe du menu se manipule au doigt ou à la souris (inertie), puis reprend sa rotation ou son cadrage de zone ; 30 images/s au repos.

Pour ajouter un type de question plus tard (vents, villes…), il suffit d'ajouter une entrée dans `src/game/targets.ts` : éligibilité, question, liste de noms acceptés.

## Déploiement

Le workflow `.github/workflows/deploy.yml` construit et publie sur GitHub Pages à chaque push sur `main`. Dans les réglages du dépôt GitHub, choisir **Pages → Source : GitHub Actions**. Le build utilise des chemins relatifs (`base: './'`) : il fonctionne quel que soit le nom du dépôt.

### Hugging Face Spaces

Le jeu est statique : il peut être publié tel quel sur un Space `static`.

```bash
HF_TOKEN=hf_xxx npm run deploy:hf -- <utilisateur-ou-org>/<nom-du-space>
```

Le script construit le projet, ajoute l'en-tête de Space (`hf/README.md`) et envoie le tout avec la CLI `hf`. Le token doit avoir un droit d'écriture.

## Données vent & courants (étude)

`scripts/build-flow-data.py` télécharge et convertit deux climatologies libres de droits en grilles compactes (`public/data/flow/wind.json`, `currents.json` : Int8 en base64, 12 mois, valeur = entier × `scale` en m/s, -128 = terre) :

- vent de surface : NCEP/NCAR Reanalysis (NOAA PSL), moyennes mensuelles de long terme, 2,5° ;
- courants de surface : SODA 3.3.1 (niveau ~5 m, moyennes mensuelles 2006-2015), ramenés à 1°, via NOAA CoastWatch ERDDAP.

Ces fichiers ne sont pas encore utilisés par l'application.
