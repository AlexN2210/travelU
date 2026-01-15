-- Backfill des profils existants depuis auth.users
-- Permet d'avoir first_name/last_name/email remplis pour les comptes créés avant l'ajout de la table profiles

INSERT INTO public.profiles (user_id, email, first_name, last_name)
SELECT
  u.id,
  u.email,
  (u.raw_user_meta_data->>'first_name')::text,
  (u.raw_user_meta_data->>'last_name')::text
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
  last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name);

NOTIFY pgrst, 'reload schema';

