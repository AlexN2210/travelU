-- Politique pour permettre aux participants de voir les autres participants du même voyage
-- Cette politique permet à un participant de voir tous les participants du voyage auquel il participe
DROP POLICY IF EXISTS "Participants can view other participants" ON trip_participants;
CREATE POLICY "Participants can view other participants"
  ON trip_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM trip_participants tp
      WHERE tp.trip_id = trip_participants.trip_id 
        AND tp.user_id = auth.uid()
    )
  );
