-- Mettre à jour les participants existants qui ont été ajoutés via le lien d'invitation
-- avec la permission 'read' pour leur donner 'edit' par défaut
-- Cette migration met à jour tous les participants avec 'read' vers 'edit'
-- (sauf le créateur du voyage qui n'a pas besoin d'être dans trip_participants)

UPDATE trip_participants
SET permission = 'edit'
WHERE permission = 'read'
  AND user_id != (
    SELECT creator_id FROM trips WHERE trips.id = trip_participants.trip_id
  );

-- Note: Les nouveaux utilisateurs invités via le lien auront automatiquement 'edit'
-- grâce à la fonction join_trip_via_invite mise à jour dans la migration précédente.
