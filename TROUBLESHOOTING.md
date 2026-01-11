# Guide de dépannage - Erreur 500 lors de la création de voyage

Si vous recevez une erreur 500 lors de la création d'un voyage, voici les étapes à suivre :

## 1. Vérifier que la migration SQL a été appliquée

1. Allez sur https://app.supabase.com
2. Ouvrez votre projet
3. Allez dans **SQL Editor** dans le menu latéral
4. Cliquez sur **New query**
5. Collez tout le contenu du fichier `supabase/migrations/20260111170245_create_travelu_schema.sql`
6. Cliquez sur **Run** (ou Ctrl+Enter)
7. Vérifiez qu'il n'y a pas d'erreurs dans la console

## 2. Vérifier les tables

Dans Supabase SQL Editor, exécutez :

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('trips', 'trip_participants', 'stages', 'vote_categories', 'vote_options', 'user_votes', 'expenses', 'checklist_items');
```

Vous devriez voir toutes ces tables listées.

## 3. Vérifier les politiques RLS

Vérifiez que les politiques RLS sont créées :

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'trips';
```

Vous devriez voir au moins ces politiques pour la table `trips` :
- "Users can view trips they created or participate in"
- "Users can create trips"
- "Trip creators and editors can update trips"
- "Trip creators can delete trips"

## 4. Vérifier la fonction trigger

```sql
SELECT proname 
FROM pg_proc 
WHERE proname = 'update_updated_at_column';
```

## 5. Vérifier les logs dans Supabase

1. Dans Supabase, allez dans **Logs** → **API Logs**
2. Regardez les erreurs récentes lors de la création d'un voyage
3. Les logs vous donneront plus de détails sur l'erreur

## 6. Vérifier la console du navigateur

Ouvrez la console du navigateur (F12) et regardez :
- Les erreurs dans l'onglet Console
- Les requêtes dans l'onglet Network
- Le message d'erreur complet affiché dans l'interface

## Solutions courantes

### Erreur "permission denied"
- Vérifiez que vous êtes bien connecté
- Vérifiez que les politiques RLS sont créées et actives
- Vérifiez que `creator_id = auth.uid()` dans la politique INSERT

### Erreur "relation does not exist"
- La migration n'a pas été appliquée
- Exécutez la migration SQL complète

### Erreur "function does not exist"
- La fonction `update_updated_at_column` n'existe pas
- Exécutez la partie de la migration qui crée cette fonction

### Erreur 500 sans détails
- Vérifiez les logs Supabase (Logs → API Logs)
- Vérifiez la console du navigateur pour plus de détails
- Assurez-vous que tous les champs requis sont remplis
