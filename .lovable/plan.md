## 🎯 Objetivo

Agregar al panel `/analytics` una métrica clara de **visitantes únicos** (personas distintas, no visitas totales) para responder bien a *"¿cuántas personas nuevas vieron la herramienta?"*.

---

## 🧩 Cómo funcionará

### 1. Generar un ID anónimo persistente por navegador
- En `usePageTracking.ts`, al cargar por primera vez, generamos un **UUID** y lo guardamos en `localStorage` bajo la clave `cce_visitor_id`.
- En visitas siguientes, reutilizamos ese mismo ID → así sabemos que es la **misma persona**.
- Es **100% anónimo**: no guarda nombre, email, ni nada identificable. Solo un UUID aleatorio.

### 2. Guardar el `visitor_id` en cada visita
- Migración a la tabla `page_visits`: agregar columna `visitor_id text` (nullable, para no romper visitas históricas).
- `usePageTracking` envía el `visitor_id` junto con cada `insert`.

### 3. Nuevas métricas en el panel `/analytics`

Agregamos **3 tarjetas nuevas** arriba (reemplazando o complementando las actuales):

| Métrica | Qué muestra |
|---|---|
| 👤 **Visitantes únicos** | Cantidad de `visitor_id` distintos (total histórico) |
| ✨ **Nuevos hoy** | Visitantes cuya **primera visita** fue hoy |
| 🔁 **Recurrentes** | Visitantes con más de 1 visita registrada |

Las métricas existentes (Visitas totales, Últimas 24h, Países, Rutas) se mantienen.

### 4. Bonus: indicador visual en la tabla
En la tabla "Visitas recientes", agregamos un pequeño badge **"Nuevo"** (verde) o **"Recurrente"** (gris) al lado de cada fila, según si es la primera vez de ese `visitor_id` o no.

---

## 📂 Cambios técnicos

| Archivo | Cambio |
|---|---|
| **Migración SQL** (nueva) | `ALTER TABLE page_visits ADD COLUMN visitor_id text;` + índice para queries rápidas |
| `src/hooks/usePageTracking.ts` | Generar/leer UUID de `localStorage`, enviarlo en el insert |
| `src/pages/Analytics.tsx` | Calcular las 3 métricas nuevas, agregar tarjetas, agregar badges en tabla |

---

## ⚠️ Notas honestas

- **Visitas históricas** (las 18 actuales) tendrán `visitor_id = null` → aparecerán agrupadas como "desconocido" en métricas únicas. A partir de ahora todo se trackea bien.
- Si alguien **borra cookies/localStorage** o usa **modo incógnito**, contará como visitante nuevo. Es la limitación estándar de cualquier analytics sin login.
- Si alguien entra desde **2 dispositivos distintos** (móvil + laptop), contará como 2 visitantes. También estándar.

Para tu caso de uso (saber cuánta gente real vio la herramienta tras compartirla con Olavarrieta, Sigalotti, etc.), esta precisión es más que suficiente. ✅

---

¿Le damos? Una vez aprobado el plan, lo implemento de una.