<h1 align="center">ERP Nodo Sur</h1>

<p align="center">
  Sistema de gestión (ERP) para distribuidoras de autopartes, construido con Next.js 15, Bun, TailwindCSS y Supabase.
</p>

## Características Principales

- Arquitectura **Feature-Driven (Domain-Driven)**.
- Stack moderno: **Next.js App Router**, **React 19**, **TypeScript** y **Bun**.
- Backend 100% nativo y Serverless con **Supabase** (Postgres, Auth, Edge Functions).
- Estricta integridad de datos en Postgres (SAGA patterns, validaciones contables, roles).
- Módulo de facturación electrónica ARCA/AFIP integrado.
- UI robusta con estado colocalizado (Zustand).

## Requisitos Previos

Para correr este proyecto necesitás tener instalado:
- [Bun](https://bun.sh/) (Package manager y runtime)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (Para manejar la base de datos local y remota)
- [Docker](https://www.docker.com/) (Opcional, pero **requerido** si querés correr Supabase de forma 100% local en tu máquina)

---

## Clonación y Configuración Inicial

### 1. Clonar el repositorio e instalar dependencias

```bash
git clone <URL_DEL_REPOSITORIO>
cd ERP-Nodo-Sur
bun install
```

### 2. Variables de Entorno

Creá el archivo de variables de entorno locales copiando el ejemplo:

```bash
cp .env.example .env.local
```

Vas a necesitar configurar tu `.env.local` con las credenciales de tu proyecto de Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<TU_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<TU_ANON_KEY>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Configuración de la Base de Datos (Supabase)

> **¿Cómo se "clona" la base de datos?**  
> Todo el esquema de la base de datos (tablas, funciones de Postgres, políticas RLS, triggers SAGA, roles) vive como código adentro de la carpeta `supabase/migrations/` de este repositorio.  
> Al correr los comandos de Supabase, el CLI lee esos archivos y recrea la base de datos exacta para vos de forma automática.

Tenés dos opciones para trabajar con la base de datos: **Local** o **Remota**.

### Opción A: Desarrollo 100% Local (Recomendado)
Esto levanta un contenedor Docker con Postgres, Auth y el Studio de Supabase en tu máquina. Al iniciarse, **aplica automáticamente todas las migraciones** del proyecto.

```bash
# Iniciar la base de datos local (requiere Docker abierto)
npx supabase start

# (Opcional) Si en el futuro descargás nuevas migraciones del repo:
npx supabase db reset
```

### Opción B: Conectarse a un Proyecto Remoto en Supabase
Si creaste un proyecto vacío en [supabase.com](https://supabase.com/dashboard) y querés impactar la base de datos ahí:

```bash
# 1. Iniciar sesión en el CLI
npx supabase login

# 2. Vincular el repositorio a tu proyecto en la nube
npx supabase link --project-ref <TU_PROJECT_REF>

# 3. Empujar todo el esquema de BD (crea las tablas, funciones y roles)
npx supabase db push
```

### Exportar un volcado exacto del esquema (DB Dump)
Si en algún momento hacés cambios directamente desde el Dashboard de Supabase (Postgres) y necesitás "bajarlos" a código, o simplemente querés generar un archivo `schema.sql` maestro que sea una foto exacta de la base de datos actual:

```bash
# Exportar el esquema remoto a un archivo local (asegurate de haber ejecutado 'supabase link' antes)
npx supabase db dump --linked -f supabase/schema.sql
```
Este archivo te sirve como backup o como referencia completa de todas tus tablas, funciones y RLS.

---

## Levantar el Servidor de Desarrollo

Una vez que las dependencias están instaladas y la base de datos está corriendo (y tus variables de entorno configuradas), levantá el frontend:

```bash
bun run dev
```

El ERP ya debería estar corriendo en [http://localhost:3000](http://localhost:3000).

## Testing

El proyecto corre bajo la disciplina de *Strict TDD*. Para correr la suite de pruebas unitarias y de integración de Vitest:

```bash
bun run test
```
