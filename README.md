# ArtScan

App de reconnaissance et collection d'œuvres d'art — street art et musées. Inspirée de Flash Invaders.

Deux mondes, accessibles par swipe :

- **Street art** (gauche) : thème sombre néon. Scanne les œuvres dans la rue, classe-les par artiste et par lieu, crée des chasses au street art ("courses") avec carte, validation des trouvailles et leaderboard.
- **Musée** (droite) : thème clair or/crème. Photographie les œuvres, détection auto artiste + titre (IA vision), collections par musée, artiste ou thème.

## Stack

- Next.js 15 (App Router) + Tailwind 4, déployé sur Vercel
- Supabase : Postgres + Auth + Storage
- Leaflet + OpenStreetMap pour les cartes
- API Claude (vision) pour la détection d'œuvres (phase 4)

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis remplir les clés Supabase
npm run dev
```

## Base de données

Le schéma complet (8 tables + RLS + bucket photos + trigger profil) est dans
`supabase/migrations/001_init.sql`. À exécuter dans le SQL Editor de Supabase.

## Roadmap

1. ~~Schéma + scaffold~~
2. Setup GitHub / Supabase / Vercel
3. MVP : auth, upload photo, métadonnées, folders, design deux modes
4. Détection IA (musée puis street art)
5. Courses : création, partage, carte, validation, leaderboard
6. Polish : musique, animations, capture caméra
