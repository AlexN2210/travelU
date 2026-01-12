-- Script COMPLET pour corriger TOUTES les récursions RLS
-- Exécutez ce script dans Supabase SQL Editor
-- Ce script corrige toutes les politiques qui utilisent IN au lieu de EXISTS

-- ============================================
-- 1. CORRIGER LES POLITIQUES DE LA TABLE trips
-- ============================================

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

-- ============================================
-- 2. CORRIGER LES POLITIQUES DE trip_participants
-- ============================================

DROP POLICY IF EXISTS "Participants can view trip participants" ON trip_participants;
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

DROP POLICY IF EXISTS "Trip creators can add participants" ON trip_participants;
CREATE POLICY "Trip creators can add participants"
  ON trip_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_participants.trip_id 
        AND trips.creator_id = auth.uid()
    )
  );

-- ============================================
-- 3. CORRIGER LES POLITIQUES DE stages
-- ============================================

DROP POLICY IF EXISTS "Participants can view stages" ON stages;
CREATE POLICY "Participants can view stages"
  ON stages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
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
      SELECT 1 FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = stages.trip_id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = stages.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = stages.trip_id 
        AND trip_participants.user_id = auth.uid() 
        AND trip_participants.permission = 'edit'
    )
  );
