# Configuration du fichier .env

## ⚠️ SÉCURITÉ IMPORTANTE

**NE COMMITEZ JAMAIS** votre fichier `.env` dans Git. Il contient des clés API sensibles.

## Création du fichier .env

Créez un fichier `.env` à la racine du dossier `project/` avec le contenu suivant :

```env
# Supabase Configuration
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase

# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=votre_cle_google_maps_ici
```

## Instructions

1. **Créez le fichier `.env`** dans le dossier `project/`
2. **Copiez votre clé Supabase** depuis le dashboard Supabase (Settings → API)
3. **Ajoutez votre clé Google Maps** (voir section ci-dessous)
4. **Redémarrez le serveur** de développement après avoir créé/modifié le `.env`

## Configuration Google Maps API

### 1. Obtenir une clé API

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un projet ou sélectionnez un projet existant
3. Activez l'API "Maps JavaScript API"
4. Allez dans **APIs & Services** → **Credentials**
5. Créez une **API Key**

### 2. ⚠️ RESTREINDRE LA CLÉ API (ESSENTIEL)

**IMPORTANT** : Les clés API côté client peuvent être exposées. Vous DEVEZ les restreindre :

1. Dans Google Cloud Console, cliquez sur votre clé API
2. Dans **Application restrictions**, sélectionnez **HTTP referrers (web sites)**
3. Ajoutez vos domaines autorisés :
   - `http://localhost:*` (pour le développement)
   - `https://votre-domaine.com/*` (pour la production)
   - `https://*.vercel.app/*` (si vous utilisez Vercel)
4. Dans **API restrictions**, sélectionnez **Restrict key**
5. Sélectionnez uniquement **Maps JavaScript API**
6. Cliquez sur **Save**

### 3. Ajouter la clé dans .env

Copiez votre clé API dans le fichier `.env` :
```env
VITE_GOOGLE_MAPS_API_KEY=votre_cle_ici
```

## Sécurité Supabase

La clé `VITE_SUPABASE_ANON_KEY` est conçue pour être publique (côté client). Cependant :
- Configurez correctement les **Row Level Security (RLS)** dans Supabase
- Ne stockez jamais de données sensibles sans RLS
- Utilisez la clé `service_role` uniquement côté serveur (jamais dans le client)

## Vérification

- Le fichier `.env` est déjà dans `.gitignore` ✅
- Les variables doivent commencer par `VITE_` pour être accessibles dans le code
- Redémarrez toujours le serveur après modification du `.env`
