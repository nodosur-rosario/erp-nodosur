# Desarrollo Guiado por Especificaciones (SDD) - Reporte de Inicialización del Proyecto

Este reporte confirma la calibración exitosa y el chequeo de salud del entorno monorepo **nodosur-erp**.

## 1. Stack y Capacidades de Prueba Verificadas

Hemos realizado una verificación completa de los pipelines de prueba del monorepo. Todas las suites están en verde:

| Componente | Stack | Ejecutor de Pruebas | Estado |
|---|---|---|---|
| **Frontend** | Next.js 16 (React 19, TypeScript, Bun, TailwindCSS) | `bun run test:frontend` (Vitest) | **APROBADO** (2 pruebas) |
| **Backend** | Go (enrutador nativo `net/http`, biblioteca estándar) | `bun run test:backend` (`go test -v`) | **APROBADO** (1 prueba) |

## 2. Salvaguardas y Restricciones Activadas

Las siguientes reglas están ahora estrictamente activas a lo largo de todo el ciclo de vida del proyecto:

- **Modo TDD Estricto**: `true`. Cada edición o extensión de características debe ser precedida por, o escrita junto con, pruebas automatizadas de alta fidelidad. No se verificará ningún código sin cobertura.
- **Estrategia de Entrega**: `ask-on-risk`. Si un plan de implementación prevé cambios que superen el **presupuesto de 400 líneas** o sugiere cambios apilados, el modelo se detendrá y solicitará confirmación.
- **Modo de Almacenamiento de Artefactos**: `openspec`. Las especificaciones, detalles de diseño y listas de verificación de tareas se guardarán en el directorio `openspec/` dentro de este código base para un seguimiento completo de git y transparencia.

## 3. Resumen de Configuración Activa

```json
{
  "project": "nodosur-erp",
  "stack": {
    "frontend": "Next.js + TypeScript + React + Bun + TailwindCSS + Vitest",
    "backend": "Go (net/http nativo, go test)"
  },
  "testing_capabilities": {
    "frontend_runner": "bun run test",
    "backend_runner": "go test -v"
  },
  "strict_tdd": true,
  "delivery_strategy": "ask-on-risk"
}
```
