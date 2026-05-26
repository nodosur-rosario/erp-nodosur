-- MIGRACIÓN: Extracción de roles de JSONB a columna plana dedicada
-- Proyecto: ERP Nodo Sur

-- 1. Crear el tipo ENUM si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('pending', 'vendedor', 'admin');
    END IF;
END $$;

-- 2. Agregar la columna 'role' a public.users si no existe
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'pending'::public.user_role;

-- 3. Migrar los datos existentes del JSON profile a la columna plana
UPDATE public.users
SET role = COALESCE(
    (profile->>'role')::public.user_role, 
    'pending'::public.user_role
);

-- 4. Remover la clave 'role' del JSON profile para mantener una sola fuente de verdad
UPDATE public.users
SET profile = COALESCE(profile, '{}'::jsonb) - 'role';

-- 5. Redefinir la función handle_new_user() para soportar el nuevo esquema plano
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, role, profile, created_at, updated_at)
  VALUES (
    new.id::text,
    new.email,
    'pending'::public.user_role,
    jsonb_build_object(
      'name', COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
    ),
    COALESCE(new.created_at, now()),
    COALESCE(new.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    profile = jsonb_set(
      COALESCE(public.users.profile, '{}'::jsonb),
      '{name}',
      COALESCE(EXCLUDED.profile->'name', public.users.profile->'name', '""'::jsonb)
    ),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
