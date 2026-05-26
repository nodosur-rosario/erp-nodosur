-- MIGRACIÓN: Localización de tipos de cuentas contables de inglés a español
-- Proyecto: ERP Nodo Sur

-- 1. Actualizar 'asset' ➔ 'activo'
UPDATE public.accounting_accounts
SET type = 'activo'
WHERE type = 'asset';

-- 2. Actualizar 'liability' ➔ 'pasivo'
UPDATE public.accounting_accounts
SET type = 'pasivo'
WHERE type = 'liability';

-- 3. Actualizar 'equity' ➔ 'patrimonio_neto'
UPDATE public.accounting_accounts
SET type = 'patrimonio_neto'
WHERE type = 'equity';

-- 4. Actualizar 'revenue' ➔ 'ingreso'
UPDATE public.accounting_accounts
SET type = 'ingreso'
WHERE type = 'revenue';

-- 5. Actualizar 'expense' ➔ 'egreso'
UPDATE public.accounting_accounts
SET type = 'egreso'
WHERE type = 'expense';
