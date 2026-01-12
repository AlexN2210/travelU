-- Script SIMPLE pour corriger la récursion RLS
-- Exécutez ce script dans Supabase SQL Editor
-- Ce script crée une fonction qui bypass RLS pour créer des voyages

-- 1. Créer la fonction pour créer un voyage
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
  -- Vérifier que l'utilisateur est bien le créateur
  IF p_creator_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez créer un voyage que pour vous-même';
  END IF;
  
  -- Insérer le voyage
  INSERT INTO trips (name, description, start_date, end_date, type, creator_id)
  VALUES (p_name, p_description, p_start_date, p_end_date, p_type, p_creator_id)
  RETURNING id INTO v_trip_id;
  
  -- Ajouter le créateur comme participant
  INSERT INTO trip_participants (trip_id, user_id, permission)
  VALUES (v_trip_id, p_creator_id, 'edit');
  
  RETURN v_trip_id;
END;
$$;

-- 2. Donner les permissions
GRANT EXECUTE ON FUNCTION create_trip_and_return_id TO authenticated;

-- 3. Vérifier que les politiques RLS sont correctes (recréer si nécessaire)
DROP POLICY IF EXISTS "Users can view trips they created or participate in" ON trips;
CREATE POLICY "Users can view trips they created or participate in"
  ON trips FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = trips.id 
        AND trip_participants.user_id = auth.uid()
    )
  );
