# Configuration du fichier .env

Créez un fichier `.env` à la racine du dossier `project/` avec le contenu suivant :

```env
# Supabase Configuration
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase

# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=AIzaSyCa3HwCzuRqgeXnD7EieVk7QeBHBeWARlA
```

## Instructions

1. Créez le fichier `.env` dans le dossier `project/`
2. Copiez votre clé Supabase depuis le dashboard Supabase
3. La clé Google Maps est déjà fournie ci-dessus
4. Redémarrez le serveur de développement après avoir créé/modifié le `.env`

## Important

- Ne commitez JAMAIS le fichier `.env` dans Git
- Le fichier `.env` est déjà dans `.gitignore`
- Les variables doivent commencer par `VITE_` pour être accessibles dans le code
