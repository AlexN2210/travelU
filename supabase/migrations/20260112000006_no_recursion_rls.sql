-- ============================================
-- SOLUTION DÉFINITIVE - ÉVITER TOUTE RÉCURSION
-- Exécutez ce script dans Supabase SQL Editor
-- ============================================

-- Le problème : Même avec EXISTS, PostgreSQL détecte une récursion
-- quand trips vérifie trip_participants et trip_participants vérifie trips.

-- SOLUTION : Utiliser une approche qui évite complètement la récursion
-- en vérifiant directement les colonnes sans sous-requêtes croisées.

-- 1. SUPPRIMER toutes les politiques existantes qui causent des problèmes
DROP POLICY IF EXISTS "Users can view trips they created or participate in" ON trips;
DROP POLICY IF EXISTS "Participants can view trips they participate in" ON trips;
DROP POLICY IF EXISTS "Participants can view trip participants" ON trip_participants;

-- 2. Créer une politique SIMPLE pour trips (créateurs uniquement)
-- Cette politique ne vérifie QUE le creator_id, pas les participants
CREATE POLICY "Creators can view their trips"
  ON trips FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- 3. Créer une fonction pour obtenir les voyages où l'utilisateur est participant
-- Cette fonction bypass RLS et évite la récursion
CREATE OR REPLACE FUNCTION get_user_trips()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  start_date date,
  end_date date,
  type text,
  creator_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.start_date,
    t.end_date,
    t.type,
    t.creator_id,
    t.created_at,
    t.updated_at
  FROM trips t
  WHERE t.creator_id = auth.uid()
     OR EXISTS (
       SELECT 1 
       FROM trip_participants tp
       WHERE tp.trip_id = t.id 
         AND tp.user_id = auth.uid()
     );
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_trips TO authenticated;

-- 4. Politique SIMPLE pour trip_participants (pas de vérification de trips)
CREATE POLICY "Users can view their own participations"
  ON trip_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Politique pour permettre aux créateurs de voir les participants de leurs voyages
CREATE POLICY "Creators can view participants of their trips"
  ON trip_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM trips 
      WHERE trips.id = trip_participants.trip_id 
        AND trips.creator_id = auth.uid()
    )
  );

-- 6. Corriger les politiques pour stages
DROP POLICY IF EXISTS "Participants can view stages" ON stages;
CREATE POLICY "Participants can view stages"
  ON stages FOR SELECT
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
    )
  );

DROP POLICY IF EXISTS "Editors can manage stages" ON stages;
CREATE POLICY "Editors can manage stages"
  ON stages FOR ALL
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
  )
  WITH CHECK (
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

-- 7. S'assurer que la fonction pour créer des voyages existe
CREATE OR REPLACE FUNCTION create_trip_and_return_id(
  p_name text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_type text,
  p_creator_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  IF p_creator_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez créer un voyage que pour vous-même';
  END IF;
  
  INSERT INTO trips (name, description, start_date, end_date, type, creator_id)
  VALUES (p_name, p_description, p_start_date, p_end_date, p_type, p_creator_id)
  RETURNING id INTO v_trip_id;
  
  INSERT INTO trip_participants (trip_id, user_id, permission)
  VALUES (v_trip_id, p_creator_id, 'edit');
  
  RETURN v_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_trip_and_return_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_trips TO authenticated;
