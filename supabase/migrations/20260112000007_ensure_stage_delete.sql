-- Script pour s'assurer que la suppression d'étapes fonctionne
-- Exécutez ce script dans Supabase SQL Editor si la suppression ne fonctionne pas

-- Vérifier et recréer la politique pour la suppression d'étapes
-- La politique "Editors can manage stages" avec FOR ALL devrait déjà couvrir DELETE,
-- mais on peut créer une politique spécifique pour DELETE si nécessaire

-- Option 1: Vérifier que la politique FOR ALL existe et fonctionne
-- (Elle devrait déjà exister d'après le script précédent)

-- Option 2: Créer une politique spécifique pour DELETE si nécessaire
DROP POLICY IF EXISTS "Editors can delete stages" ON stages;
CREATE POLICY "Editors can delete stages"
  ON stages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 
      FROM trip_participants 
      WHERE trip_participants.trip_id = stages.trip_id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  );

-- Vérifier les politiques existantes
-- Vous pouvez exécuter cette requête pour voir toutes les politiques sur stages:
-- SELECT * FROM pg_policies WHERE tablename = 'stages';
