# Guide de Sécurité - TravelU

## ⚠️ Clés API et Variables d'Environnement

### Problème : Exposition des Clés API

Les applications React/Vite exposent les variables d'environnement `VITE_*` dans le code JavaScript côté client. Cela signifie que **n'importe qui peut voir vos clés API** en inspectant le code source du navigateur.

### Solutions de Sécurité

#### 1. Google Maps API Key

**Problème** : La clé Google Maps doit être côté client pour fonctionner, mais elle peut être exposée.

**Solution** : **Restreindre la clé dans Google Cloud Console**

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** → **Credentials**
4. Cliquez sur votre clé API
5. **Application restrictions** :
   - Sélectionnez **HTTP referrers (web sites)**
   - Ajoutez uniquement vos domaines autorisés :
     ```
     http://localhost:*
     https://votre-domaine.com/*
     https://*.vercel.app/*
     ```
6. **API restrictions** :
   - Sélectionnez **Restrict key**
   - Cochez uniquement **Maps JavaScript API**
7. Cliquez sur **Save**

**Résultat** : Même si quelqu'un vole votre clé, elle ne fonctionnera que sur vos domaines autorisés.

#### 2. Supabase Anon Key

**Problème** : La clé `anon` est conçue pour être publique, mais elle doit être protégée par RLS.

**Solution** : **Configurer Row Level Security (RLS)**

1. Activez RLS sur toutes vos tables dans Supabase
2. Créez des politiques RLS strictes qui limitent l'accès aux données
3. Ne stockez jamais de données sensibles sans RLS
4. Utilisez la clé `service_role` uniquement côté serveur (jamais dans le client)

**Exemple de politique RLS** :
```sql
-- Les utilisateurs ne peuvent voir que leurs propres voyages
CREATE POLICY "Users can view their own trips"
ON trips FOR SELECT
USING (auth.uid() = creator_id);
```

#### 3. Bonnes Pratiques

✅ **À FAIRE** :
- Utiliser `.env` pour les clés (jamais dans le code)
- Ajouter `.env` dans `.gitignore`
- Restreindre les clés API dans les consoles respectives
- Utiliser RLS pour toutes les données Supabase
- Vérifier régulièrement les logs d'utilisation des APIs

❌ **À NE PAS FAIRE** :
- Commiter le fichier `.env` dans Git
- Partager les clés API publiquement
- Utiliser la clé `service_role` côté client
- Stocker des données sensibles sans RLS
- Laisser les clés API sans restrictions

### Vérification de Sécurité

1. **Vérifiez que `.env` n'est pas dans Git** :
   ```bash
   git ls-files | grep .env
   # Ne doit rien retourner
   ```

2. **Vérifiez les restrictions Google Maps** :
   - Allez dans Google Cloud Console
   - Vérifiez que votre clé a des restrictions HTTP referrers
   - Vérifiez que seules les APIs nécessaires sont activées

3. **Vérifiez les politiques RLS** :
   - Dans Supabase, allez dans **Authentication** → **Policies**
   - Vérifiez que toutes les tables ont des politiques RLS actives

### En Cas de Fuite de Clé

Si vous découvrez qu'une clé API a été exposée :

1. **Google Maps** :
   - Allez dans Google Cloud Console
   - Supprimez ou régénérez la clé exposée
   - Créez une nouvelle clé avec des restrictions strictes
   - Mettez à jour votre `.env` et redéployez

2. **Supabase** :
   - Si la clé `anon` est exposée : Vérifiez que RLS est correctement configuré
   - Si la clé `service_role` est exposée : **Régénérez-la immédiatement** dans Supabase Settings → API
   - Mettez à jour toutes les applications qui l'utilisent

### Ressources

- [Google Maps API Security Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
