-- MIGRACIÓN: Agregar columna updated_at a la tabla customer_credit_accounts
-- Proyecto: ERP Nodo Sur

-- 1. Agregar la columna updated_at si no existe
ALTER TABLE public.customer_credit_accounts
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Crear trigger para actualizar automáticamente updated_at (opcional pero recomendado para auditoría)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_credit_accounts_updated_at ON public.customer_credit_accounts;
CREATE TRIGGER update_customer_credit_accounts_updated_at
    BEFORE UPDATE ON public.customer_credit_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
