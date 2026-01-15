-- Ajout d'une image optionnelle pour les options de vote (affichage type Tinder)

ALTER TABLE IF EXISTS public.vote_options
ADD COLUMN IF NOT EXISTS image_url text;

