# Plan de desarrollo — App de objetivos, hábitos y tareas 🐉

Documento maestro para construir la app paso a paso con Claude Code, de principio a fin.
Pensado para ser **modular**: podés reordenar fases, insertar features nuevas o cambiar el
stack sin rehacer todo. La única regla que NO conviene tocar está marcada como 🔒.

> **Cómo usar este plan con Claude Code**
> - Mantené un `CLAUDE.md` en la raíz del repo con: stack elegido, el esquema SQL, las
>   convenciones y "en qué fase estás". Cada sesión nueva arranca con ese contexto.
> - Trabajá **una fase por sesión**. Al terminar, commiteás y usás `/clear` antes de la próxima.
> - Cada fase tiene un **"Listo cuando"** (definición de terminado) y un **prompt semilla**
>   para arrancar la sesión.

---

## PARTE 1 — Decisiones de stack (editable)

Esta es la capa que podés cambiar. Si cambiás algo acá, las **fases de abajo casi no se tocan**
(solo cambian detalles técnicos, no el orden ni el qué).

### Recomendación

| Capa | Elección recomendada | Por qué |
|---|---|---|
| **Frontend** | Expo (React Native) + TypeScript | Reusás tu React; Android + iOS con un código; Claude Code lo maneja muy bien; deja abierto Health Connect |
| **Backend / DB** | Supabase (Postgres + Auth + RLS) | Batteries included; tu esquema ya está hecho para esto; $0 en el MVP |
| **Servidor propio** | **Ninguno en el MVP** | La app habla directo a Supabase con `supabase-js` + RLS. Consultas pesadas (Hoy, Progreso) como funciones SQL (RPC) |
| **Navegación** | expo-router (file-based) | 3 tabs: Objetivos · Hoy (default) · Progreso |
| **Estado de servidor** | TanStack Query (React Query) | Cache, refetch y estados de carga sin boilerplate |
| **Notificaciones** | expo-notifications (locales) | Recordatorios en el MVP; push más adelante |
| **Health Connect** | react-native-health-connect (V2) | Requiere dev build; solo Android; se suma sin tocar el modelo |
| **Builds / distribución** | EAS Build (o build local) → Play Store / TestFlight | Free tier alcanza para el MVP |

### Costos reales (verificado agosto 2026 — confirmá siempre en la página oficial)

- **Supabase Free — $0:** 500 MB de base, 50.000 usuarios activos, 5 GB de egress, 2 proyectos.
  Sin backups y **el proyecto se pausa tras 7 días sin uso** (se reactiva con un clic).
  Pro = US$25/mes recién cuando lo superes.
- **Expo/EAS Free — $0:** SDK gratis siempre; 15 builds Android + 15 iOS por mes; o compilás
  local sin límite.
- **Publicar:** Google Play ~US$25 pago único; Apple ~US$99/año (solo si querés iOS).
- **Total MVP: ~$0.** Primeros costos posibles: cuenta de desarrollador para publicar.

### Alternativas y cuándo elegirlas

- **Kotlin (Jetpack Compose):** elegilo si querés app nativa Android-only, máximo rendimiento
  y la mejor integración con Health Connect, y estás dispuesta a aprender Kotlin. Igual necesitás
  una base (Supabase/Neon).
- **Next.js / PWA:** lo más rápido de armar con tu stack exacto, gratis en Vercel. Contra:
  **no accede a Health Connect** y las notificaciones son poco confiables (sobre todo en iOS).
  Sirve para un MVP web, no para el producto completo que describiste.
- **Neon** (en vez de Supabase): mejor Postgres serverless, se apaga/prende solo (sin pausas
  manuales), 100 proyectos gratis. Contra: es solo base — el auth lo armás aparte (ya tiene Neon Auth,
  pero es más ensamblaje). Buen "plan B" si la pausa de Supabase te molesta.
- **PocketBase / Appwrite / self-host:** costo mínimo absoluto en un VPS de ~US$5/mes. Prematuro ahora.
- **Firebase:** ❌ NoSQL, pelea con tu modelo relacional (objetivo ↔ registro). No lo recomiendo.

### Por qué SIN backend propio en el MVP

- La app usa `supabase-js` directo y RLS protege los datos por usuario.
- Las consultas con lógica (objetivos "esperados hoy", cálculo de progreso) van como
  **funciones SQL / RPC** dentro de Postgres.
- Recién sumás **Supabase Edge Functions** (gratis) si más adelante necesitás lógica de
  servidor: paywall premium, sync de Health Connect, webhooks de pago, etc.
- Esto = menos que hostear, menos que mantener, y ~$0.

---

## PARTE 2 — Arquitectura y estructura

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│      App (Expo / RN / TS)    │        │           Supabase           │
│  UI  →  capa de datos (lib)  │  ⇄     │  Auth · RLS · Postgres · RPC │
└─────────────────────────────┘        └──────────────────────────────┘
        (más adelante)  →  Edge Functions · Health Connect · Notificaciones
```

Estructura de carpetas sugerida (Expo + expo-router):

```
/app                 # rutas (expo-router)
  /(auth)            # login, registro
  /(tabs)            # objetivos.tsx, index.tsx (=Hoy), progreso.tsx
  /objetivo/[id].tsx # detalle / editar
  /tarea/[id].tsx
/lib
  supabase.ts        # cliente
  types.ts           # tipos generados desde Supabase
  /data              # funciones tipadas: objetivos.ts, tareas.ts, registros.ts, progreso.ts
/components          # tarjetas, barra de progreso, dragón, inputs
/logic               # reglas puras: mensaje del dragón, cálculo de %, "esperados hoy"
CLAUDE.md
```

**Convención clave:** la UI **nunca** habla directo con Supabase; siempre pasa por `/lib/data`.
Así, cambiar de Supabase a Neon (o a lo que sea) = reescribir solo esa carpeta.

---

## PARTE 3 — Roadmap por fases

Cada fase = una o pocas sesiones de Claude Code.

### Fase 0 — Setup del proyecto
- **Qué construir:** repo git; `create-expo-app` con TypeScript; instalar `supabase-js`,
  expo-router, TanStack Query, `expo-secure-store`; crear proyecto en Supabase; `.env` con URL +
  anon key; `lib/supabase.ts`; navegación con 3 tabs (Objetivos, **Hoy como índice**, Progreso);
  `CLAUDE.md` con stack y convenciones.
- **Listo cuando:** corre en tu teléfono (Expo Go o dev build) y ves las 3 tabs vacías con Hoy por defecto.
- **Prompt:** *"Inicializá un proyecto Expo con TypeScript y expo-router, con tab navigation de 3
  pestañas (Objetivos, Hoy como índice, Progreso), y configurá el cliente de Supabase leyendo las
  claves desde `.env`."*

### Fase 1 — Base de datos y capa de datos
- **Qué construir:** correr `esquema.sql` en el SQL editor de Supabase; verificar tablas, enums,
  RLS y trigger; generar tipos (`supabase gen types typescript`); crear `/lib/data` con funciones
  tipadas de CRUD.
- **Listo cuando:** tablas con RLS activa, tipos TS generados, y un select de prueba autenticado funciona.
- **Prompt:** *"Con `esquema.sql` ya aplicado en Supabase, generá los tipos TypeScript y una capa de
  datos tipada (funciones CRUD) para categoria, objetivo, objetivo_dia, registro_objetivo y tarea."*

### Fase 2 — Autenticación
- **Qué construir:** registro/login/logout con email+password (Supabase Auth); persistencia de
  sesión con secure-store; pantallas de login/registro; guard de rutas (sin sesión → login).
  El trigger ya crea perfil + las 4 categorías por defecto.
- **Listo cuando:** te registrás, aparecen tus 4 categorías, y la sesión persiste al reabrir la app.
- **Prompt:** *"Implementá auth con Supabase (registro, login, logout), persistencia de sesión con
  expo-secure-store y protección de rutas: sin sesión redirige a login."*

### Fase 3 — Categorías (CRUD)
- **Qué construir:** listar, crear, editar, eliminar categorías (nombre, icono, color).
- **Listo cuando:** gestionás categorías y aparecen en los selectores de objetivos/tareas.

### Fase 4 — Objetivos (crear / editar / eliminar)
- **Qué construir:** pantalla Objetivos (lista: icono, nombre, frecuencia resumida, botón Editar);
  formulario Nuevo/Editar con todos los campos: tipo (BOOLEAN/NUMERIC), frecuencia
  (DAILY / SPECIFIC_DAYS / WEEKLY_COUNT), días → filas en `objetivo_dia`, meta + unidad,
  recordatorio, categoría, fechas; pantalla de detalle.
- **Ojo:** SPECIFIC_DAYS → guardar filas en `objetivo_dia`; WEEKLY_COUNT → `frecuencia_cantidad`.
- **Listo cuando:** creás los 3 tipos de frecuencia y ambos tipos, y se guardan correctamente.

### Fase 5 — Tareas (CRUD + completar)
- **Qué construir:** sección Tareas en Objetivos; formulario nueva/editar; marcar completada
  (setea `fecha_completada`); eliminar.
- **Listo cuando:** creás, editás, completás y eliminás tareas.

### Fase 6 — Pantalla Hoy (el corazón) 🔒
- **Qué construir:**
  - Función SQL **`esperados_hoy`** (RPC) con `isodow` + zona horaria del usuario.
  - Sección **Hoy** (booleanos del día).
  - Sección **Recordá** (diarios; numéricos con barra de progreso).
  - WEEKLY_COUNT como **tarjeta opcional** (progreso semanal), que NO penaliza el % del día.
  - Tareas próximas (vencen hoy/mañana) + "Ver todas".
  - Encabezado dinámico: % del día + mensaje del dragón generado por **reglas** (según hora + %),
    no guardado en base.
  - Marcar booleano → **upsert** en `registro_objetivo` (completado=true) → recalcula el %.
- **Reglas de cálculo (cerradas):** denominador = objetivos obligatorios de hoy (DAILY +
  SPECIFIC_DAYS que caen hoy), sin los omitidos; numéricos dan **crédito proporcional**;
  `omitido` queda fuera del numerador y del denominador; semana empieza lunes; "hoy" en tu huso, no UTC.
- **Listo cuando:** al marcar un objetivo se crea el registro, el % sube y el mensaje del dragón cambia.
- **Prompt:** *"Creá la pantalla Hoy: una función RPC `esperados_hoy` (isodow + zona horaria),
  las secciones Hoy / Recordá / Tareas próximas, el encabezado con % del día y mensaje por reglas,
  y el marcado que hace upsert en registro_objetivo y recalcula el porcentaje."*

### Fase 7 — Registros e interacción numérica
- **Qué construir:** acción de objetivo numérico (+250 / +500 / ingresar cantidad) →
  upsert de `registro_objetivo.valor` por `(id_objetivo, fecha)`; al llegar a `meta_valor` →
  `completado = true`; (opcional) "Omitir hoy" → `omitido = true`.
- **Listo cuando:** sumás agua y, al llegar a la meta, se marca completado solo.

### Fase 8 — Progreso 🔒
- **Qué construir:** **todo se calcula desde `registro_objetivo`**, nunca del estado del objetivo.
  Funciones/vistas SQL: cumplimiento diario, semanal (con % vs semana anterior para el "+11%"),
  por categoría, y calendario mensual (intensidad por día). Pantalla Progreso: resumen semanal +
  barra + delta; por categoría (tocar → desglose por objetivo); progreso por día (L→D);
  vista mensual (calendario); tocar un día → detalle.
- **Consistencia** (X/Y planificado) como métrica principal; la racha, secundaria.
- **Listo cuando:** los números de Progreso salen del historial y cuadran con lo que marcaste.

### Fase 9 — Dragón + identidad visual
- **Qué construir:** mascota base + set de expresiones por estado (mañana / 30% / 70% / 100% /
  felicitación); ubicaciones (encabezado Hoy, tarjetas de mensaje, Progreso); estética violeta +
  pastel, tarjetas redondeadas, tabla de tokens de color.
- **Listo cuando:** el dragón aparece con la expresión correcta según el estado del día.

### Fase 10 — Recordatorios
- **Qué construir:** expo-notifications locales según `hora_recordatorio` de objetivos y el
  recordatorio de tareas; manejo de permisos.
- **Listo cuando:** te llega una notificación local a la hora configurada.

### Fase 11 — Pulido MVP + primer build
- **Qué construir:** estados vacíos / loading / error; onboarding con el dragón (5 pasos:
  creá objetivos → agregá tareas → mirá Hoy → marcá → revisá Progreso); EAS Build (o local) →
  APK/AAB; probar en tu teléfono; opcional: Play Store internal testing / TestFlight.
- **Listo cuando:** instalás el APK y usás el flujo completo de punta a punta.

### Post-MVP (V2 → V4) — resumen
- **V2:** Health Connect (react-native-health-connect + dev build; `fuente_datos`);
  notificaciones push; estadísticas mensuales; XP (`movimiento_xp`) y logros.
- **V3:** personalización del dragón, niveles, cosméticos; **Premium** (RevenueCat + tabla de
  suscripción + feature flags); sync/cloud multi-dispositivo.
- **V4:** tendencias e IA ("cumplís más los días que dormís 7 h"), siempre con datos suficientes
  y sin presentar correlación como causalidad.

---

## PARTE 4 — Cómo cambiar o agregar cosas sin romper el plan

- 🔒 **Regla de oro:** el Progreso se calcula **siempre** desde `registro_objetivo`, nunca del
  estado actual de `objetivo`. Si respetás esto, podés sumar gráficos, XP, Health Connect y
  estadísticas mensuales sin rehacer nada.
- **Schema-first:** para una feature nueva, primero pensá la tabla/columna, después la UI.
- **Capas separadas:** UI ↔ `/lib/data` ↔ Supabase. Migrar de base = reescribir solo `/lib/data`.
- **Feature flags para premium desde temprano** (aunque estén todas en `true` por ahora).
- **Filtro de producto:** antes de agregar algo, preguntate *¿esto ayuda a planificar, cumplir o
  entender mejor los objetivos?* Si no, afuera.
- **Con Claude Code:** `CLAUDE.md` siempre actualizado (stack, esquema, convenciones, fase actual);
  una fase por sesión; `/clear` entre fases; commit al terminar cada una.

---

## PARTE 5 — Checklist rápida

- [ ] Fase 0 — Setup
- [ ] Fase 1 — Base de datos + capa de datos
- [ ] Fase 2 — Autenticación
- [ ] Fase 3 — Categorías
- [ ] Fase 4 — Objetivos
- [ ] Fase 5 — Tareas
- [ ] Fase 6 — Pantalla Hoy 🔒
- [ ] Fase 7 — Registros / numéricos
- [ ] Fase 8 — Progreso 🔒
- [ ] Fase 9 — Dragón + estética
- [ ] Fase 10 — Recordatorios
- [ ] Fase 11 — Pulido + build
- [ ] Post-MVP: Health Connect · XP/logros · Premium · IA
