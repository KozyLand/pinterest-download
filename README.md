# Pinterest Download

Télécharge en un ZIP toutes les images d'un de tes tableaux Pinterest, en
meilleure résolution disponible, avec un fichier récapitulant les liens
sources.

## Pourquoi une connexion Pinterest est nécessaire

L'API officielle Pinterest (v5) ne permet **pas** de récupérer les épingles
d'un tableau appartenant à quelqu'un d'autre à partir d'une simple URL — elle
ne donne accès qu'aux tableaux de l'utilisateur authentifié (OAuth). Le
scraping de tableaux publics est par ailleurs explicitement interdit par les
CGU Pinterest et techniquement fragile.

Cet outil utilise donc le vrai flux OAuth Pinterest : tu te connectes avec ton
compte, et tu choisis parmi **tes propres tableaux** (créés ou suivis).

## 1. Créer une app Pinterest

1. Va sur https://developers.pinterest.com/ → crée un compte développeur si
   besoin → "Create app".
2. Dans les paramètres de l'app, ajoute cette redirect URI (pour le
   développement local) :
   ```
   http://localhost:3000/auth/pinterest/callback
   ```
3. Récupère l'**App ID** et l'**App secret**.
4. L'accès **Trial** (par défaut) suffit pour un usage personnel — il permet
   de lire tes propres tableaux/épingles. L'accès **Standard** (review +
   vidéo du flux OAuth demandée par Pinterest) n'est nécessaire que si tu
   veux ouvrir l'outil à d'autres utilisateurs en production.

## 2. Configurer le projet

```bash
cp server/.env.example server/.env
```

Remplis `server/.env` :

```
PINTEREST_APP_ID=xxxxx
PINTEREST_APP_SECRET=xxxxx
PINTEREST_REDIRECT_URI=http://localhost:3000/auth/pinterest/callback
SESSION_SECRET=une-chaine-aleatoire-longue
PORT=3000
WEB_ORIGIN=http://localhost:5173
```

## 3. Installer et lancer

```bash
npm install
npm run install:all
npm run dev
```

- Backend : http://localhost:3000
- Frontend : http://localhost:5173 (ouvre celui-ci dans ton navigateur)

## Utilisation

1. Clique sur "Connecter mon compte Pinterest" et autorise l'app.
2. Choisis un tableau dans la liste.
3. Attends la récupération des épingles (barre de progression) — gère les
   tableaux avec sections/plusieurs pages automatiquement, et déduplique les
   images identiques.
4. Sélectionne les images voulues (ou "Tout sélectionner").
5. Clique sur "Télécharger le ZIP" : le fichier est généré à la volée (aucune
   image n'est stockée côté serveur), en conservant format et proportions
   d'origine, avec un `sources.csv` listant pin d'origine / image / section /
   statut. Les images introuvables au moment du téléchargement sont ignorées
   dans le ZIP et signalées à l'écran — jamais de faux succès.

## Build production

```bash
npm run build
npm start
```

Le serveur Express sert alors le frontend buildé sur le port `PORT` (3000 par
défaut) — plus besoin du serveur Vite séparé.

## Limites connues (v1)

- Un tableau = les épingles que Pinterest expose via l'API (les épingles
  purement vidéo n'ont pas d'image téléchargeable et sont ignorées).
- Pas de compte ni d'abonnement : chaque session navigateur garde sa propre
  connexion Pinterest (cookie de session, tokens stockés côté serveur dans
  `server/sessions.sqlite`).
- Les jobs de synchronisation sont conservés en mémoire process ; un redémarrage
  du serveur invalide les jobs en cours (pas les connexions Pinterest, qui
  survivent grâce à la session SQLite).
