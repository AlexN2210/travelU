# Configuration de TravelU

## Configuration Supabase

L'erreur 401 lors de l'inscription est généralement causée par une configuration Supabase incorrecte ou manquante.

### Étapes de configuration

1. **Créer un projet Supabase**
   - Allez sur https://app.supabase.com
   - Créez un nouveau projet ou utilisez un projet existant

2. **Récupérer les variables d'environnement**
   - Dans votre projet Supabase, allez dans **Settings** → **API**
   - Copiez l'**Project URL** et l'**anon public key**

3. **Créer le fichier `.env`**
   - À la racine du dossier `project/`, créez un fichier `.env`
   - Ajoutez les variables suivantes :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon-ici
```

**⚠️ Important :** Remplacez `votre-projet` et `votre-clé-anon-ici` par vos vraies valeurs.

4. **Redémarrer le serveur de développement**
   - Après avoir créé/modifié le fichier `.env`, redémarrez votre serveur de développement :
   ```bash
   npm run dev
   # ou
   yarn dev
   ```

### Configuration de l'authentification dans Supabase

1. **Aller dans Authentication → Settings**
   - Dans votre projet Supabase, allez dans **Authentication** → **URL Configuration**
   - Ajoutez votre URL de développement dans **Site URL** : `http://localhost:5173` (ou le port que vous utilisez)

2. **Désactiver la confirmation par email (optionnel pour le développement)**
   - Dans **Authentication** → **Settings**
   - Décochez **"Enable email confirmations"** si vous voulez tester sans confirmer l'email
   - ⚠️ En production, gardez cette option activée pour la sécurité

3. **Appliquer la migration**
   - Assurez-vous d'avoir appliqué la migration SQL dans Supabase
   - Allez dans **SQL Editor** dans votre projet Supabase
   - Collez le contenu du fichier `supabase/migrations/20260111170245_create_travelu_schema.sql`
   - Exécutez la requête

### Vérifier la configuration

Une fois configuré, vérifiez dans la console du navigateur :
- Aucune erreur concernant les variables d'environnement manquantes
- L'inscription devrait fonctionner sans erreur 401

### Dépannage - Erreur 401 lors de l'inscription

Si vous recevez une erreur 401 lors de l'inscription :

**1. Vérifiez les variables d'environnement**
   - Ouvrez la console du navigateur (F12)
   - Vous devriez voir les logs de débogage avec l'URL Supabase
   - Vérifiez que l'URL commence par `https://` et se termine par `.supabase.co`
   - Vérifiez que la clé anon est bien présente (longue chaîne de caractères)

**2. Vérifiez la configuration Supabase**
   
   **a. URL Configuration dans Supabase :**
   - Allez dans **Authentication** → **URL Configuration**
   - Ajoutez votre URL locale dans **Site URL** : `http://localhost:5173` (ou votre port)
   - Ajoutez aussi dans **Redirect URLs** : 
     - `http://localhost:5173/auth/callback`
     - `http://localhost:5173/**`
   
   **b. Email confirmation (IMPORTANT pour l'erreur 401) :**
   - Allez dans **Authentication** → **Settings** → **Email Auth**
   - **Décochez "Enable email confirmations"** pour le développement
   - ⚠️ Cela permet de créer un compte sans avoir à confirmer l'email
   - En production, réactivez cette option

**3. Vérifiez les valeurs dans votre .env**
   ```bash
   # Votre .env devrait ressembler à ça (avec vos vraies valeurs) :
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   - L'URL ne doit PAS contenir "votre-projet" ou être vide
   - La clé doit commencer par "eyJ" (JWT)

**4. Redémarrez le serveur**
   ```bash
   # Arrêtez le serveur (Ctrl+C)
   # Puis relancez :
   npm run dev
   # ou
   yarn dev
   ```

**5. Vérifiez la console du navigateur**
   - Ouvrez la console (F12) → onglet "Console"
   - Regardez les logs lors de l'inscription
   - Vous verrez :
     - "Tentative d'inscription pour: votre@email.com"
     - "Réponse signUp:" avec les détails
     - Si erreur : "Erreur Supabase:" avec le message complet

**6. Testez avec une autre adresse email**
   - Utilisez un email que vous n'avez jamais utilisé dans Supabase
   - Si l'erreur persiste, le problème vient de la configuration Supabase

**L'utilisateur est créé mais ne peut pas se connecter :**
- Si la confirmation email est activée, vérifiez votre boîte mail
- Vérifiez que la configuration email est correcte dans Supabase

**Erreurs de permissions (RLS) :**
- Assurez-vous que la migration SQL a été correctement appliquée
- Vérifiez que les politiques RLS sont bien créées dans Supabase
