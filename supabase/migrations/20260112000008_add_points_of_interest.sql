-- Ajouter un champ pour stocker les liens d'intérêt (musées, jardins, etc.)
-- Utilisation d'un JSONB pour permettre plusieurs liens avec titre et URL

ALTER TABLE stages 
ADD COLUMN IF NOT EXISTS points_of_interest jsonb DEFAULT '[]'::jsonb;

-- Commentaire pour documenter la structure
COMMENT ON COLUMN stages.points_of_interest IS 'Array JSON d''objets avec "title" et "url" pour les liens d''intérêt (musées, jardins, etc.)';
