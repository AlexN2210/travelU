-- Migration pour corriger la récursion infinie dans les politiques RLS
-- Cette migration doit être exécutée après la migration initiale

-- Supprimer les anciennes politiques qui causent la récursion
DROP POLICY IF EXISTS "Users can view trips they created or participate in" ON trips;
DROP POLICY IF EXISTS "Trip creators and editors can update trips" ON trips;
DROP POLICY IF EXISTS "Participants can view trip participants" ON trip_participants;

-- Recréer la politique SELECT pour trips avec EXISTS au lieu de IN pour éviter la récursion
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

-- Recréer la politique UPDATE pour trips avec EXISTS
CREATE POLICY "Trip creators and editors can update trips"
  ON trips FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = trips.id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  )
  WITH CHECK (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = trips.id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  );

-- Recréer la politique SELECT pour trip_participants avec EXISTS
CREATE POLICY "Participants can view trip participants"
  ON trip_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_participants.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants tp2
      WHERE tp2.trip_id = trip_participants.trip_id 
        AND tp2.user_id = auth.uid()
    )
  );
