

## Plan: integrar el `fmcubic_clean_1.zip` corregido por Claude

No puedo abrir el zip en modo plan (read-only no permite `unzip`). Necesito modo default para extraer e inspeccionar. Una vez aprobado, ejecuto los pasos en este orden.

### Paso 1 — Extracción e inventario (sin tocar el repo)

1. Copiar `user-uploads://fmcubic_clean_1.zip` a `/tmp/fmcubic_clean_1.zip`.
2. Descomprimir en `/tmp/fmcubic_clean/` y listar estructura completa.
3. Mostrarte:
   - Árbol de archivos
   - Contenido de `pyproject.toml` / `setup.py` / `README.md` si existen
   - Lista de módulos Python y de tests
   - Diff conceptual vs. la versión anterior que habíamos discutido (qué corrigió Claude)

**No modifico nada del proyecto en este paso.** Solo reporto.

### Paso 2 — Validación funcional de la librería

4. Crear venv en `/tmp/fmcubic_venv`, instalar la librería desde el zip extraído.
5. Correr la suite de tests incluida (`pytest`).
6. Reportar:
   - Cuántos tests pasan / fallan
   - Cobertura de las ramas B1–B7 (paper-faithful vs fallback)
   - Qué casos del paper Patel–Teja (Z, ρ, V) reproduce
   - Errores numéricos vs los del solver TS actual en `src/lib/cubicSolvers.ts`

### Paso 3 — Decisión de ubicación en el repo

Te pregunto antes de copiar. Opciones:

- **A)** `python/fmcubic/` dentro de este repo (monorepo: web app + librería Python conviven)
- **B)** Carpeta `fmcubic/` en la raíz
- **C)** No copiar al repo, dejar el zip como artefacto descargable desde la UI

Default propuesto: **A** (versionado junto al resto, mantenible).

### Paso 4 — Integración mínima (solo si aprobás A o B)

7. Copiar el contenido extraído a la ruta elegida.
8. Agregar `python/README.md` con: instalación, ejemplo de uso, mapeo ramas B1–B7, limitaciones honestas, comando de tests.
9. **No tocar** el código TS de la web app, ni los solvers, ni los tests Vitest. La web app sigue intacta.
10. Verificar que `npm run build` y `npx vitest run` siguen verdes (la carpeta Python no debe romper el build de Vite).

### Paso 5 — Reporte final

Resumen entregable:
- Estructura final de `python/fmcubic/`
- Resultado de `pytest` (X/Y pasan)
- Diferencias confirmadas vs versión anterior (qué corrigió Claude exactamente)
- Cómo correr la librería localmente
- Limitaciones que siguen vigentes

### Lo que NO voy a hacer (salvo que lo pidas explícito)

- No reemplazo el solver TS por un puente a Python.
- No agrego CI/CD, publishing a PyPI, ni Docker.
- No reescribo código del zip; solo lo integro tal cual lo entregó Claude.
- No modifico el preset Ill-conditioned ni la UI actual.

