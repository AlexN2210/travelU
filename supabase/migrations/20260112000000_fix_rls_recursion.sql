-- Migration complète pour corriger TOUTES les récursions dans les politiques RLS
-- Exécutez ce script dans Supabase SQL Editor

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

DROP POLICY IF EXISTS "Trip creators and editors can update trips" ON trips;
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

DROP POLICY IF EXISTS "Trip creators can update participants" ON trip_participants;
CREATE POLICY "Trip creators can update participants"
  ON trip_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_participants.trip_id 
        AND trips.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = trip_participants.trip_id 
        AND trips.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trip creators can remove participants" ON trip_participants;
CREATE POLICY "Trip creators can remove participants"
  ON trip_participants FOR DELETE
  TO authenticated
  USING (
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

-- ============================================
-- 4. CORRIGER LES POLITIQUES DE vote_categories
-- ============================================

DROP POLICY IF EXISTS "Participants can view vote categories" ON vote_categories;
CREATE POLICY "Participants can view vote categories"
  ON vote_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = vote_categories.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = vote_categories.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can create vote categories" ON vote_categories;
CREATE POLICY "Participants can create vote categories"
  ON vote_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = vote_categories.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = vote_categories.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. CORRIGER LES POLITIQUES DE vote_options
-- ============================================

DROP POLICY IF EXISTS "Participants can view vote options" ON vote_options;
CREATE POLICY "Participants can view vote options"
  ON vote_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vote_categories 
      WHERE vote_categories.id = vote_options.category_id 
        AND (
          EXISTS (
            SELECT 1 FROM trips 
            WHERE trips.id = vote_categories.trip_id 
              AND trips.creator_id = auth.uid()
          ) OR
          EXISTS (
            SELECT 1 FROM trip_participants 
            WHERE trip_participants.trip_id = vote_categories.trip_id 
              AND trip_participants.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Participants can add vote options" ON vote_options;
CREATE POLICY "Participants can add vote options"
  ON vote_options FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vote_categories 
      WHERE vote_categories.id = vote_options.category_id 
        AND (
          EXISTS (
            SELECT 1 FROM trips 
            WHERE trips.id = vote_categories.trip_id 
              AND trips.creator_id = auth.uid()
          ) OR
          EXISTS (
            SELECT 1 FROM trip_participants 
            WHERE trip_participants.trip_id = vote_categories.trip_id 
              AND trip_participants.user_id = auth.uid()
          )
        )
    )
  );

-- ============================================
-- 6. CORRIGER LES POLITIQUES DE expenses
-- ============================================

DROP POLICY IF EXISTS "Participants can view expenses" ON expenses;
CREATE POLICY "Participants can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = expenses.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = expenses.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. CORRIGER LES POLITIQUES DE checklist_items
-- ============================================

DROP POLICY IF EXISTS "Participants can view checklist items" ON checklist_items;
CREATE POLICY "Participants can view checklist items"
  ON checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = checklist_items.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = checklist_items.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can add checklist items" ON checklist_items;
CREATE POLICY "Participants can add checklist items"
  ON checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = checklist_items.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = checklist_items.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can update checklist items" ON checklist_items;
CREATE POLICY "Participants can update checklist items"
  ON checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = checklist_items.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = checklist_items.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = checklist_items.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = checklist_items.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can delete checklist items" ON checklist_items;
CREATE POLICY "Participants can delete checklist items"
  ON checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = checklist_items.trip_id 
        AND trips.creator_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = checklist_items.trip_id 
        AND trip_participants.user_id = auth.uid()
    )
  );
