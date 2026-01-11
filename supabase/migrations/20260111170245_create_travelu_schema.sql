/*
  # TravelU Application Schema

  1. New Tables
    - `trips`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text, nullable)
      - `start_date` (date)
      - `end_date` (date)
      - `type` (text: 'single' or 'roadtrip')
      - `creator_id` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `trip_participants`
      - `id` (uuid, primary key)
      - `trip_id` (uuid, foreign key to trips)
      - `user_id` (uuid, foreign key to auth.users)
      - `permission` (text: 'read' or 'edit')
      - `joined_at` (timestamptz)
    
    - `stages`
      - `id` (uuid, primary key)
      - `trip_id` (uuid, foreign key to trips)
      - `name` (text)
      - `order_index` (integer)
      - `latitude` (numeric)
      - `longitude` (numeric)
      - `accommodation_link` (text, nullable)
      - `transport_to_next` (text, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
    
    - `vote_categories`
      - `id` (uuid, primary key)
      - `trip_id` (uuid, foreign key to trips)
      - `name` (text: 'accommodation', 'activity', 'restaurant', 'other')
      - `title` (text)
      - `created_at` (timestamptz)
    
    - `vote_options`
      - `id` (uuid, primary key)
      - `category_id` (uuid, foreign key to vote_categories)
      - `title` (text)
      - `description` (text, nullable)
      - `link` (text, nullable)
      - `added_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
    
    - `user_votes`
      - `id` (uuid, primary key)
      - `option_id` (uuid, foreign key to vote_options)
      - `user_id` (uuid, foreign key to auth.users)
      - `vote` (boolean: true for like, false for dislike)
      - `created_at` (timestamptz)
    
    - `expenses`
      - `id` (uuid, primary key)
      - `trip_id` (uuid, foreign key to trips)
      - `amount` (numeric)
      - `category` (text)
      - `description` (text)
      - `paid_by` (uuid, foreign key to auth.users)
      - `split_between` (jsonb: array of user_ids)
      - `created_at` (timestamptz)
    
    - `checklist_items`
      - `id` (uuid, primary key)
      - `trip_id` (uuid, foreign key to trips)
      - `category` (text: 'clothes', 'health', 'documents', 'accessories', 'activities')
      - `item` (text)
      - `is_completed` (boolean)
      - `completed_by` (uuid, foreign key to auth.users, nullable)
      - `is_auto_generated` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their trips
    - Add policies for participants to access trip data based on permissions
*/

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  type text NOT NULL CHECK (type IN ('single', 'roadtrip')),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('read', 'edit')) DEFAULT 'read',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accommodation_link text,
  transport_to_next text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vote_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('accommodation', 'activity', 'restaurant', 'other')),
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vote_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES vote_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  link text,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES vote_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(option_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  category text NOT NULL,
  description text NOT NULL,
  paid_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  split_between jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('clothes', 'health', 'documents', 'accessories', 'activities')),
  item text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_auto_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trips they created or participate in"
  ON trips FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid() OR
    id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trips"
  ON trips FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Trip creators and editors can update trips"
  ON trips FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid() OR
    id IN (
      SELECT trip_id FROM trip_participants 
      WHERE user_id = auth.uid() AND permission = 'edit'
    )
  )
  WITH CHECK (
    creator_id = auth.uid() OR
    id IN (
      SELECT trip_id FROM trip_participants 
      WHERE user_id = auth.uid() AND permission = 'edit'
    )
  );

CREATE POLICY "Trip creators can delete trips"
  ON trips FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Participants can view trip participants"
  ON trip_participants FOR SELECT
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip creators can add participants"
  ON trip_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "Trip creators can update participants"
  ON trip_participants FOR UPDATE
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    )
  )
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "Trip creators can remove participants"
  ON trip_participants FOR DELETE
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "Participants can view stages"
  ON stages FOR SELECT
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Editors can manage stages"
  ON stages FOR ALL
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants 
      WHERE user_id = auth.uid() AND permission = 'edit'
    )
  )
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants 
      WHERE user_id = auth.uid() AND permission = 'edit'
    )
  );

CREATE POLICY "Participants can view vote categories"
  ON vote_categories FOR SELECT
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can create vote categories"
  ON vote_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can view vote options"
  ON vote_options FOR SELECT
  TO authenticated
  USING (
    category_id IN (
      SELECT id FROM vote_categories WHERE trip_id IN (
        SELECT id FROM trips WHERE creator_id = auth.uid()
      ) OR trip_id IN (
        SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Participants can add vote options"
  ON vote_options FOR INSERT
  TO authenticated
  WITH CHECK (
    category_id IN (
      SELECT id FROM vote_categories WHERE trip_id IN (
        SELECT id FROM trips WHERE creator_id = auth.uid()
      ) OR trip_id IN (
        SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Participants can view votes"
  ON user_votes FOR SELECT
  TO authenticated
  USING (
    option_id IN (
      SELECT id FROM vote_options WHERE category_id IN (
        SELECT id FROM vote_categories WHERE trip_id IN (
          SELECT id FROM trips WHERE creator_id = auth.uid()
        ) OR trip_id IN (
          SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Participants can vote"
  ON user_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their votes"
  ON user_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their votes"
  ON user_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Participants can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can add expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    paid_by = auth.uid() AND (
      trip_id IN (
        SELECT id FROM trips WHERE creator_id = auth.uid()
      ) OR
      trip_id IN (
        SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Expense payer can update their expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (paid_by = auth.uid())
  WITH CHECK (paid_by = auth.uid());

CREATE POLICY "Expense payer can delete their expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (paid_by = auth.uid());

CREATE POLICY "Participants can view checklist items"
  ON checklist_items FOR SELECT
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can add checklist items"
  ON checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can update checklist items"
  ON checklist_items FOR UPDATE
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can delete checklist items"
  ON checklist_items FOR DELETE
  TO authenticated
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE creator_id = auth.uid()
    ) OR
    trip_id IN (
      SELECT trip_id FROM trip_participants WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_trip_participants_user ON trip_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_participants_trip ON trip_participants(trip_id);
CREATE INDEX IF NOT EXISTS idx_stages_trip ON stages(trip_id);
CREATE INDEX IF NOT EXISTS idx_vote_categories_trip ON vote_categories(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_trip ON checklist_items(trip_id);