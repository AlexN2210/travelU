# Guide de déploiement sur Vercel

## Configuration requise

### 1. Variables d'environnement dans Vercel

Dans votre projet Vercel, allez dans **Settings** → **Environment Variables** et ajoutez :

- `VITE_SUPABASE_URL` : L'URL de votre projet Supabase
- `VITE_SUPABASE_ANON_KEY` : La clé anon de votre projet Supabase

**Important** : Ces variables doivent être ajoutées pour tous les environnements (Production, Preview, Development).

### 2. Configuration du build

Le fichier `vercel.json` est déjà configuré pour :
- Builder avec `yarn build`
- Servir les fichiers depuis `dist`
- Rediriger toutes les routes vers `index.html` (SPA)

### 3. Structure du projet

Si votre repo GitHub a la structure suivante :
```
travelU/
  └── project/
      ├── src/
      ├── package.json
      └── vercel.json
```

Vercel devrait automatiquement détecter que le projet est dans le dossier `project/`.

Si Vercel ne détecte pas automatiquement :
1. Allez dans **Settings** → **General**
2. Dans **Root Directory**, sélectionnez `project`

### 4. Résolution des problèmes de build

**Erreur "Cannot find module"** :
- Vérifiez que toutes les dépendances sont dans `package.json`
- Vérifiez que `yarn.lock` est présent (pas `package-lock.json`)

**Erreur "Variables d'environnement manquantes"** :
- Vérifiez que les variables sont bien configurées dans Vercel
- Vérifiez que les noms commencent bien par `VITE_`

**Build qui échoue silencieusement** :
- Vérifiez les logs de build dans Vercel
- Vérifiez qu'il n'y a pas d'erreurs TypeScript (`yarn typecheck`)

### 5. Commandes de build

Le build utilise :
- `yarn build` : Compile l'application avec Vite
- Output : `dist/` (dossier généré par Vite)

### 6. Après le déploiement

1. Vérifiez que l'application se charge
2. Testez la connexion/inscription
3. Vérifiez que les variables d'environnement sont bien chargées (console du navigateur)
