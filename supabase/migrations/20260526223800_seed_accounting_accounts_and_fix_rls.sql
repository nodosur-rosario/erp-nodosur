-- Migration: Seed standard chart of accounts and update RLS policies for global sharing
-- Date: 2026-05-26
-- Author: Antigravity

-- 1. Seed the standard 30 accounts globally (company_cuit IS NULL) so all tenants can share them without violating the unique code PK constraint
INSERT INTO public.accounting_accounts (code, name, parent_code, type, company_cuit) VALUES 
('1', 'Activo', NULL, 'asset', NULL),
('1.1', 'Activo Corriente', '1', 'asset', NULL),
('1.1.1', 'Caja y Bancos', '1.1', 'asset', NULL),
('1.1.1.01', 'Caja General', '1.1.1', 'asset', NULL),
('1.1.1.02', 'Banco Cuenta Corriente', '1.1.1', 'asset', NULL),
('1.1.3', 'Créditos por Ventas', '1.1', 'asset', NULL),
('1.1.3.01', 'Deudores por Ventas (Clientes)', '1.1.3', 'asset', NULL),
('1.1.5', 'Bienes de Cambio', '1.1', 'asset', NULL),
('1.1.5.01', 'Mercadería de Reventa (Inventario)', '1.1.5', 'asset', NULL),
('2', 'Pasivo', NULL, 'liability', NULL),
('2.1', 'Pasivo Corriente', '2', 'liability', NULL),
('2.1.1', 'Proveedores Comerciales', '2.1', 'liability', NULL),
('2.1.1.01', 'Proveedores locales', '2.1.1', 'liability', NULL),
('2.1.3', 'Obligaciones Fiscales', '2.1', 'liability', NULL),
('2.1.3.01', 'IVA Débito Fiscal', '2.1.3', 'liability', NULL),
('2.1.3.02', 'IVA Crédito Fiscal', '2.1.3', 'liability', NULL),
('3', 'Patrimonio Neto', NULL, 'equity', NULL),
('3.1', 'Capital', '3', 'equity', NULL),
('3.1.01', 'Capital Social', '3.1', 'equity', NULL),
('4', 'Ingresos', NULL, 'revenue', NULL),
('4.1', 'Ingresos Operativos', '4', 'revenue', NULL),
('4.1.1.01', 'Ventas de Repuestos', '4.1', 'revenue', NULL),
('4.2', 'Ingresos No Operativos', '4', 'revenue', NULL),
('4.2.1.01', 'Sobrantes de Caja', '4.2', 'revenue', NULL),
('5', 'Costos y Gastos', NULL, 'expense', NULL),
('5.1', 'Costos de Venta', '5', 'expense', NULL),
('5.1.1.01', 'Costo de Mercadería Vendida (CMV)', '5.1', 'expense', NULL),
('5.1.2', 'Otros Costos Operativos', '5', 'expense', NULL),
('5.1.2.01', 'Faltantes de Caja', '5.1.2', 'expense', NULL),
('6', 'Gastos Operativos', NULL, 'expense', NULL)
ON CONFLICT (code) DO NOTHING;

-- 2. Drop existing restrictive RLS policy
DROP POLICY IF EXISTS tenant_accounting_accounts_isolation ON public.accounting_accounts;

-- 3. Create a new select policy allowing custom company accounts AND global standard accounts
DROP POLICY IF EXISTS tenant_accounting_accounts_select ON public.accounting_accounts;
CREATE POLICY tenant_accounting_accounts_select ON public.accounting_accounts
  FOR SELECT TO authenticated
  USING (company_cuit = company_cuit() OR company_cuit IS NULL);

-- 4. Create write policy restricting updates strictly to the tenant's own CUIT
DROP POLICY IF EXISTS tenant_accounting_accounts_write ON public.accounting_accounts;
CREATE POLICY tenant_accounting_accounts_write ON public.accounting_accounts
  FOR ALL TO authenticated
  USING (company_cuit = company_cuit())
  WITH CHECK (company_cuit = company_cuit());
