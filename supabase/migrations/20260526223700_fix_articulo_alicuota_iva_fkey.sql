-- Migration: Fix mismatched alicuota_iva foreign key constraint and drop NOT NULL constraint on articulo table
-- Date: 2026-05-26
-- Author: Antigravity

-- 1. Drop incorrect foreign key constraint that was pointing to codigo_afip
ALTER TABLE public.articulo
DROP CONSTRAINT IF EXISTS articulo_alicuota_iva_fkey;

-- 2. Make the column nullable so it is optional and customizable
ALTER TABLE public.articulo
ALTER COLUMN alicuota_iva DROP NOT NULL;

-- 3. Set a default value of 21.0 in case it is omitted
ALTER TABLE public.articulo
ALTER COLUMN alicuota_iva SET DEFAULT 21.0;

-- 4. Recreate the foreign key constraint pointing to the unique porcentaje column
ALTER TABLE public.articulo
ADD CONSTRAINT articulo_alicuota_iva_fkey
FOREIGN KEY (alicuota_iva) REFERENCES public.alicuota_iva(porcentaje);

COMMENT ON COLUMN public.articulo.alicuota_iva IS 'Alicuota de IVA porcentual (e.g. 21.0, 10.5, 0.0) vinculada a alicuota_iva.porcentaje. Es opcional y por defecto es 21.0.';
