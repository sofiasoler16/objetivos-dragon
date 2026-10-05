# Mejoras pendientes — Drakostone

> Registro de mejoras/arreglos pedidos por la usuaria (2026-09-08). Se van marcando a medida
> que se implementan. Cada ítem: **Estado · Prioridad · Qué pide · Análisis/plan · Preguntas abiertas**.
> Estados: 🔴 pendiente · 🟡 en curso · 🟢 hecho (falta build) · ✅ probado en build.

Convenciones del proyecto que aplican (ver CLAUDE.md): la UI no toca Supabase directo (pasa por
`/lib/data`); lógica pura en `/logic`; nativos con lazy require; la IA propone y el código ejecuta;
otorgamiento de premium/monedas SIEMPRE server-side.

---

## 1. Sincronización con el calendario (BUGS) — 🟢 HECHO (falta build)

### 1.a/1.b — Doble vía calendario → app — 🟢 HECHO (rediseño manual, 2026-09-08/09)
> La versión automática rompía datos y crasheaba → se DESACTIVÓ. **Reemplazada por el flujo manual
> aprobado:** botón **"Actualizar cambios del calendario"** en Mi semana → `detectarCambiosCalendario`/
> `detectarCambiosOcurrencia` detectan cambios (hora/días/baja/hora-de-un-día) → `RevisarCalendarioModal`
> (vista previa + casillas) → la usuaria elige cuáles aplicar → `aplicarCambiosCalendario` (bajas =
> "dejar de hacer de hoy en adelante", 🔒 nunca borra historial). Cambios uniformes de toda la serie se
> colapsan en UNA sola propuesta (no inunda con una por día). Probado en dev (Google + teléfono).

### 1.a — (histórico) Doble vía: editar en el calendario ↔ actualizar el objetivo
> `sincronizarDesdeCalendario()` corre al abrir "Mi semana": lee cada evento espejo por id y, si
> cambió la **hora** (actualiza toda la serie) o los **días** (SPECIFIC_DAYS → ajusta `objetivo_dia`),
> lo trae al objetivo. 🔒 Si no puede leer con certeza un evento, NO toca nada (evita falsos).
> **Límites conocidos:** las bajas del **calendario del teléfono** no se reflejan (expo-calendar no
> distingue "borrado" de "error" → conservador); borrar "esta y las siguientes" de un solo día no se
> detecta (el evento maestro sigue existiendo). El resto (Google) sí.
- **Qué pide:** si edito un evento en Google Calendar o en el calendario del teléfono, debe
  actualizarse el objetivo en la app; y al revés (esto último ya funciona: editar el objetivo
  re-espeja el evento).
- **Hoy:** el flujo es **de un solo sentido** (app → calendario). La app ESCRIBE los objetivos con
  horario como eventos 🐉 (prefijo dragón) y al leer "Mi semana" los EXCLUYE (porque ya salen de la
  base). No hay lectura de los cambios hechos en el evento 🐉 para traerlos de vuelta al objetivo.
- **Plan:** al abrir "Mi semana" (y quizás Hoy), leer los eventos 🐉 del calendario (Google y/o
  teléfono), compararlos con el horario guardado del objetivo (`id_evento_calendario`), y si cambió
  la hora, actualizar el objetivo. Best-effort, sin romper si falla.
- **Decidido (2026-09-08):**
  - Cambiar la **hora** en el calendario → actualiza **toda la serie** del objetivo.
  - Cambiar los **días** de la recurrencia en el calendario (p. ej. de L-M-M a L-M) → actualiza los
    `objetivo_dia` del objetivo (y al revés: editar los días en la app re-espeja el calendario).
  - Disparador de sync: al abrir "Mi semana" + al volver del segundo plano (pull; Google no empuja).
- **Abierto:** ¿sincronizar también el **título**? (por ahora asumo que NO, solo hora/días).

### 1.b — Eliminar evento en el calendario → sacarlo de "Mi semana" — 🟢 HECHO (falta build)
> Si Google confirma que el/los eventos ya no están (404/410): DAILY o todos los días borrados →
> "dejar de hacer" (corta a futuro, conserva historial 🔒); SPECIFIC_DAYS con algún día borrado → se
> cae ese día. Se refleja al abrir "Mi semana". (Ver límites en 1.a.)
- **Qué pide:** si elimino un evento en Google Calendar, debe desaparecer de "Mi semana". Hoy no se
  refleja o tarda.
- **Por qué pasa hoy:** "Mi semana" dibuja los objetivos **desde la base**, no desde el calendario
  (los 🐉 se excluyen al leer). Si borrás el evento 🐉 en Google, el objetivo sigue en la base → sigue
  apareciendo. No hay detección de "este evento fue borrado en el calendario".
- **Plan:** al sincronizar, detectar que el/los `id_evento_calendario` de un objetivo **ya no existen**
  en el calendario → reflejar la baja. **DECISIÓN NECESARIA** (ver preguntas): ¿quitar solo ese día u
  ¿borrar el objetivo?
- **Cada cuánto sincroniza:** hoy NO sincroniza bajas. Hay que definir el disparador (al abrir Mi
  semana / foreground). Google no "empuja" cambios sin webhooks; se hace por lectura (pull).
- **Decidido (2026-09-08):** 🔒 NUNCA se borra el historial de días ya cumplidos.
  - Borrar **una sola ocurrencia** en el calendario → **omitir ese día** (no toca el pasado).
  - Borrar la serie **"de este día en adelante"** en el calendario → el objetivo **deja de generarse
    desde ese día** (`fecha_fin` = el día anterior), **conservando** todos los cumplimientos pasados.
  - Mismo criterio que el borrado in-app (ver 3.b): "dejar de hacerlo" ≠ "borrar el historial".

### 1.c — Objetivos ya creados que no se sincronizan con el calendario — 🟢 HECHO (falta build)
> `sincronizarObjetivosSinEspejo()` espeja los objetivos con horario que quedaron sin
> `id_evento_calendario`. Se dispara al **conectar** un calendario en Mi semana y en Perfil.
- **Qué pide:** hay objetivos con horario que no tienen su evento en el calendario. Revisar y arreglar.
- **Causas probables:** se crearon **antes** de la función de calendario, o se crearon **sin permiso**
  de calendario/Google, o el espejo falló silencioso (best-effort). Quedaron con `id_evento_calendario`
  vacío.
- **Plan:** una **re-sincronización**: recorrer los objetivos con horario que NO tengan
  `id_evento_calendario` y espejarlos. Disparar al conectar un calendario y/o con un botón "Sincronizar".
- **A verificar en implementación:** confirmar en el código por qué quedaron sin espejar.

### 1.d — Aviso de superposición de la IA: específico con día y horario — 🟢 HECHO (falta build)
> El modal de la IA (`OrganizarSemanaModal`) ahora usa `detalleConflicto` y muestra
> *"Se superpone con "X" el viernes de 16:00 a 18:00. Movés la hora arriba para resolverlo."*
- **Qué pide:** que diga p. ej. *"se superpone con Seguridad Informática el viernes de 16 a 18"*, no
  algo genérico.
- **Hoy:** existe `detalleConflicto` en `logic/ia.ts` que YA devuelve el bloque con fecha + rango; se
  usa en el **formulario manual**. Falta confirmar/ajustar que el **modal de la IA**
  (`OrganizarSemanaModal`) muestre ese detalle y no un texto genérico.
- **Plan:** revisar `OrganizarSemanaModal` y usar el detalle (título + día + rango) en el aviso.
- **Esfuerzo:** chico.

---

## 2. Vistas de "Mi semana" — 🟢 HECHO (falta build)

**Decidido (2026-09-08):** selector arriba de "Mi semana" con **Lista · Día · Mes** (se recuerda la
elegida). La **Lista** queda como estaba.

### 2.a — Vista tipo calendario — 🟢 HECHO
> **Día** (`components/VistaDiaAgenda.tsx`): grilla de horas estilo Google Calendar, cada
> evento/objetivo como **bloque de color** ubicado por su horario + franja "Todo el día" arriba; se
> navega por día (‹ ›, "Volver a hoy"); tocar un bloque abre su info/menú.
> **Mes** (`components/VistaMesAgenda.tsx`): grilla de 6 semanas, cada día con **puntitos de color**
> según sus ítems; tocar un día abre su vista de Día.
> Datos: `agendaEnRango(desdeISO, cantidadDias)` en `lib/data/agenda.ts` (refactor con `nucleoAgenda`).
> **Límite conocido:** si dos bloques del mismo día se superponen en horario, se dibujan encimados
> (la app igual avisa/evita solapamientos al crear).

### 2.b — Vista mensual: no navegar más allá del mes actual — 🟢 HECHO
> El chevron de "mes siguiente" se deshabilita cuando estás en el mes en curso (`puedeAvanzarMes`).

### 2.c — Ajustes durante el testing por cable (2026-09-08) — 🟢 HECHO
> - Botón "Lista" → **"Semana"**.
> - Vista Mes: grilla de **6 filas × 7 columnas** (antes el flexWrap tiraba el domingo a otra fila).
> - Vista Día: eventos que se **solapan** ahora van **lado a lado en columnas** (`repartirEnColumnas`).
> - Mes: puntitos **por ítem** (2 objetivos = 2 puntitos), no deduplicados por color.
> - **Menú de acciones propio** (`components/HojaAcciones.tsx`, hoja desde abajo) en lugar del Alert:
>   Android solo muestra 3 botones en un Alert → se perdían opciones y el "Cancelar".

### 2.d bis — Sincronización por OCURRENCIA (un día suelto) con el calendario — 🟢 HECHO (falta build)
> **Parte A (app → calendario):** al cambiar el horario de un día en la app (`cambiarHorarioDiaYReflejar`),
> mueve esa sola ocurrencia en el calendario (`actualizarOcurrenciaDragon`/`actualizarOcurrenciaGoogle`,
> identificando la instancia por su inicio ORIGINAL). "Volver al horario normal" la devuelve.
> **Parte B (calendario → app):** el botón "Actualizar cambios" ahora detecta también cambios de UN
> día suelto: lista las instancias (`instanciasDragonPorTitulo`/`instanciasGooglePorTitulo`), compara
> cada una contra lo que muestra la app (override o normal) y propone `hora-dia` → al confirmar,
> `setHorarioDia` (solo app; el calendario ya lo tiene). 🔒 Con vista previa + confirmar; si no puede
> leer con certeza, no propone nada. Bajas y cambios de serie siguen necesitando Google para señales
> confiables (device no distingue "borrado" de "error").

### 2.d — Editar horario "solo por este día" (per-ocurrencia) — 🟢 HECHO (falta migración + build)
> Migración **`agregar-horario-por-dia-registro.sql`** (hora_inicio/hora_fin en `registro_objetivo`,
> la usuaria la corre). `setHorarioDia` en `lib/data/registros.ts` (upsert por (objetivo,fecha), no
> toca completado/omitido → 🔒 no afecta el %). `itemsAppEnRango` aplica el override si existe (consulta
> aparte, resiliente sin la migración). UI: menú "Cambiar horario solo este día" (vista Día/Semana) →
> `components/HorarioDiaModal.tsx` (Desde/Hasta + "Volver al horario normal"). App-only (no toca el
> calendario). **Además:** Progreso → Mes ya no navega más allá del mes actual (mismo criterio que 2.b).

### 2.d — (histórico) Editar horario "solo por este día"
- **Qué pide:** poder cambiar la hora de una actividad **solo para un día** (ej. Coriza normalmente
  15–16, pero hoy la hice 15:30–18), sin cambiar la rutina — como Google Calendar.
- **Aprobado (2026-09-08):** versión **app-only** (se ve en Día/Semana/Mes; NO se refleja en el
  calendario del teléfono/Google todavía → eso sería paso 2).
- **Plan:** migración chica en `registro_objetivo` (agregar `hora_inicio`/`hora_fin` nullable = override
  del día; NULL = rutina normal). No afecta el % ni las stats. Editar desde el menú de la vista Día
  ("Cambiar horario solo este día"). `itemsAppEnRango` usa el override si existe.
- **Estado:** falta implementar (la usuaria corre la migración).

---

## 3. Objetivos — 🟢 HECHO (falta build)

### 3.a — Editar las sugerencias de la IA antes de aceptarlas — 🟢 HECHO (2026-09-09)
> `OrganizarSemanaModal`: cada tarjeta de la propuesta tiene un botón **✏️ Editar / Listo** que abre un
> panel. Editable (además de la hora, que ya estaba): **Objetivos** → nombre, meta+unidad (si NUMERIC),
> categoría (chips de las categorías reales + "Sin categoría"). **Tareas** → título, fecha límite
> (DateTimeField), prioridad (chips), categoría. Los cambios se guardan en el estado y se agendan así
> (`crearDesdePropuesta` los toma). Red de seguridad: un NUMERIC sin meta cae a 1 al agendar.
- **Elegido por la usuaria (2026-09-09):** nombre/título, categoría, meta/unidad, fecha/prioridad
  (frecuencia/tipo/días NO se editan acá; para eso está el formulario del objetivo).

### 3.b — Eliminar objetivo recurrente sin borrar el historial — 🟢 HECHO (falta build)
> `dejarDeHacerObjetivo` en `lib/data/agenda.ts` (fecha_fin=ayer + corta el evento del calendario).
> Menú de dos opciones cableado en: **Mi semana** (menú del objetivo), **Info del objetivo** y
> **formulario de editar**. La pestaña **Objetivos** oculta los "terminados" (fecha_fin < hoy). El
> historial pasado se conserva (Hoy/Progreso filtran `fecha_fin >= fecha`, el objetivo sigue `activo`).
- **Qué pide:** al eliminar un objetivo recurrente, NO borrar los cumplimientos de días anteriores.
  Ofrecer: **"Eliminar de hoy en adelante"** (deja de generarse desde hoy, conserva el historial) y
  **"Eliminar todos"**.
- **Hoy:** `eliminarObjetivo` borra el objetivo y **por cascada** borra sus registros (pierde historial
  y afecta el % de días pasados). 🔒 (el Progreso se calcula desde `registro_objetivo`).
- **Plan:**
  - **"Eliminar de hoy en adelante"** = poner `fecha_fin = ayer` (deja de aparecer/generar desde hoy)
    y conservar objetivo + registros; borrar los eventos futuros del calendario.
  - **"Eliminar todos"** = borrado real (comportamiento actual).
- **Esfuerzo:** medio. Toca `lib/data/objetivos.ts` + los menús de borrado (Objetivos, Mi semana, Info).
- **Decidido (2026-09-08):** al eliminar (en la app o desde el calendario) SIEMPRE ofrecer dos
  opciones, y NUNCA borrar el historial por defecto:
  - **"Dejar de hacerlo (de hoy en adelante)"** → `fecha_fin = ayer`, conserva historial y stats;
    saca los eventos futuros del calendario. (Antes de esa fecha sigue contando como cumplido/no.)
  - **"Eliminar todo (incluido el historial)"** → borrado real con cascada (comportamiento actual).

---

## 4. IA — nuevo límite (150/mes, server-side) — 🟢 HECHO (falta correr SQL + deploy function + build)
> Migración **`funciones-uso-ia.sql`** (tabla `uso_ia` + RPCs `consumir_ia`/`uso_ia_actual`, RLS leer
> lo propio, límite 150, mes calendario zona BsAs). Edge Function `organizar-semana`: llama a
> `consumir_ia` ANTES del modelo; si llegó al tope devuelve `{error:'limite'}` (200) y NO llama a
> Claude. Falla ABIERTO si la RPC no existe (no rompe la IA sin migrar). Cliente: `usoIaActual()` +
> `LimiteIAError` en `lib/data/ia.ts`; contador "N/150 consultas de IA este mes" en OrganizarSemanaModal
> (sube al generar; al tope muestra aviso). ⚠️ Correr el SQL + `supabase functions deploy organizar-semana`.

## 4. (histórico) IA — nuevo límite (150/mes, server-side) 🔴

- **Qué pide:**
  - La IA es **exclusiva de Premium** (los free no la usan). *(Ya está gateada — confirmar.)*
  - Premium: **150 mensajes/mes**, con **reinicio mensual**.
  - Contador chiquito con lo usado (ej. *"37/150 este mes"*).
  - El conteo y el bloqueo al llegar a 150 **server-side**, en la **Edge Function** que llama al modelo,
    guardando el uso por usuario y mes en Supabase. **No confiar en el cliente.**
- **Plan:**
  - Migración: tabla `uso_ia (id_usuario, mes 'YYYY-MM', cantidad)` con RLS (leer la propia).
  - En la Edge Function `organizar-semana`: antes de llamar al modelo, validar sesión + leer el uso del
    mes; si ≥ 150 → devolver error "límite alcanzado" sin llamar al modelo; si no, incrementar (RPC
    `SECURITY DEFINER` idempotente por request) y seguir.
  - Cliente: query del uso para el contador *"N/150"* en el modal de la IA; al recibir "límite
    alcanzado", mostrar el aviso.
- **Preguntas abiertas:**
  - ¿Cada **request** a la IA cuenta como 1 (cada "Generar propuesta")? (asumo que sí)
  - Reinicio: **mes calendario** (día 1)? (asumo que sí)
  - Al llegar a 150: bloquear hasta el mes que viene con un mensaje. ¿Algún texto puntual?

---

## 5. Dragones / Premium ✅ HECHO (2026-09-09)

### 5.a — Dragón arcoíris:  multicolor ✅
- **Qué pedía:** con el dragón arcoíris equipado, que los cuadros de los objetivos/tareas se muestren
  **multicolor**.
- **Hecho:** 3 dragones nuevos **premium (150 🪙 c/u)** con arte normalizado y registrados
  (`constants/dragons.ts` + `NORMALIZADOS` en `DragonHero`):
  - 🌈 **Arcoíris** — tema claro festivo + **efecto multicolor**: bandera `arcoiris` en `Tema`
    (activada por `db.nombre === 'Arcoíris'` en `logic/tema.ts`) → `components/ui/Card.tsx` pinta el
    **borde de cada tarjeta con un color del arcoíris rotando** (contador de módulo + ref por instancia);
    y `GridDePuntos` (Progreso) pinta **cada mes de un color del arcoíris** (intensidad por alpha).
  - 👨‍💻 **Programador** — tema **oscuro** de editor (`#0d1117`) + **naranja neón** `#ff7a18`; bandera
    `cardBorde` (por `db.nombre === 'Programador'`) → borde naranja neón en las tarjetas.
  - ⚔️ **Samurái** — tema **oscuro** carmesí `#c1121f` + negro + acentos **dorados** `#d4af37`.
  - Seeds: `seed-dragon-arcoiris.sql`, `seed-dragon-programador.sql`, `seed-dragon-samurai.sql`
    (tema + dragón `credit_cost 150` + `premium_required true` + regla FREE). ⚠️ **La usuaria los corre.**

### 5.b — Botón de dragones Premium: mostrar precio en monedas ✅
- **Hecho:** `app/mi-dragon.tsx` (caso `premium`) muestra la **vía real** (`viaDeConseguir` en
  `logic/dragones.ts`: monedas / nivel / logro / "Gratis con Premium") + 👑 + 🔒 si no tenés Premium
  (reemplaza el confuso "Conseguir con Premium").
- **Qué pedía:** que el botón muestre el **precio en monedas** (no "conseguir con Premium", que da a
  entender que es gratis). Mantener el **candado** y la **corona 👑**. Modelo: **Premium habilita
  comprarlos, pero se pagan con monedas.**
- **Hoy:** hay dos tipos de dragón premium: **tipo A** (gratis con Premium → "Reclamar") y **tipo B**
  (premium + monedas). El problema: el texto "conseguir con Premium" hace pensar que es gratis.
- **Decidido (2026-09-08):** NO es "todos con monedas". Cada dragón debe **decir cómo se consigue** y
  respetar su vía. Regla visual: **siempre** se ve la vía; los **premium-only** llevan 👑, y 🔒
  mientras no tengas Premium.
  - **Gratis con Premium** (hay uno) → "Gratis con Premium" (👑; 🔒 si no tenés Premium).
  - **Monedas (requiere Premium)** → mostrar el **precio en monedas** (👑; 🔒 si no tenés Premium).
    ← esto arregla el "conseguir con Premium" confuso.
  - **Nivel** → "Al llegar al nivel X" (👑 si además es premium-only).
  - **Logro** → "Al lograr X" (👑 si además es premium-only).
- **Esfuerzo:** medio (texto/lógica en Mi Dragón; los datos de vía ya están en las reglas de desbloqueo).

### 5.c — Actualizar la lista de beneficios del Premium ✅
- **Hecho:** `app/premium.tsx` → `BENEFICIOS` con 6 ítems (Mi semana + IA 150/mes · Grillas anuales ·
  Estadísticas/insights · Cronómetro · Historial de todo el año · Dragones/temas exclusivos).
- **Qué pedía:** hoy dice poco ("Mi semana + IA y dragones nuevos"). Incluir **todo** lo que Premium da.
- **Beneficios reales de Premium (a confirmar la redacción):** Mi semana + IA para organizar la semana ·
  Grillas anuales de progreso · Cronómetro de objetivos · Carrusel de estadísticas/insights · Historial
  de **todo el año** (gratis = 3 meses) · Dragones y temas Premium 👑.
- **Esfuerzo:** chico (texto en `app/premium.tsx`), una vez confirmada la lista.

---

## 6. Paywall / prueba gratis — 🟢 HECHO (2026-09-09, falta build)

> **Auto-mostrar el paywall** (promo de la prueba gratis) sin ser molesto:
> - `lib/promoPremium.ts` (`debeMostrarPromo`/`marcarPromoMostrada`, AsyncStorage `promo_premium_ultima_v1`,
>   regla: nunca-mostrado o ≥7 días).
> - `components/PromoPremium.tsx` (invisible, montado en `app/(tabs)/_layout.tsx`): si NO es Premium y ya
>   vio el tutorial → abre `/premium`. Se dispara **al terminar el tutorial** (pub/sub `onOnboardingCerrado`
>   en `Onboarding.tsx` + helper `onboardingVisto`) y **al abrir la app cada 7 días**. Una vez por sesión.
> - `app/premium.tsx`: banner **"🎁 Probá 14 días gratis. Cancelás cuando quieras."** (si hay oferta con
>   prueba y no es Premium) + pre-selección de la oferta **que tiene la prueba** (entre esas, la anual).
>
> **Decidido con la usuaria (2026-09-09):**
> - Frecuencia: **tutorial + cada 7 días** si no es Premium.
> - La prueba es la **REAL de Google Play** (ofertas mensual + anual, ambas con prueba de 14 días,
>   configuradas por la usuaria vía RevenueCat). NO se usa el toggle "local" — activar el paywall inicia
>   la oferta con sus 14 días.
> - Plan pre-seleccionado por defecto: **MENSUAL** (decisión de la usuaria — barrera de entrada más baja).

---

## Decisiones tomadas (2026-09-08)

- **(1.a)** Editar hora en el calendario → **toda la serie**. Editar días de la recurrencia → sincroniza
  ambos lados.
- **(1.b + 3.b)** 🔒 Nunca borrar historial. Al eliminar (app o calendario): **"dejar de hacerlo de hoy
  en adelante"** (`fecha_fin`, conserva pasado) vs **"eliminar todo"**. Borrar 1 ocurrencia = omitir ese día.
- **(5.b)** Cada dragón muestra **su vía** (monedas/nivel/logro/gratis); premium-only con 👑 + 🔒 si no
  hay Premium. (No "todos con monedas".)
- **(5.a)** Dragón arcoíris = **nuevo**, la usuaria pasa el arte.

## Aún por definir (menores, se resuelven al implementar)

- **(5.a)** Criterio visual exacto del multicolor en la grilla.
- **(1.a)** ¿Sincronizar el título del evento? (asumo que no).
- **(2.a)** ¿Vista mensual o semanal-calendario primero? ¿eventos dentro del día o solo indicador?
- **(3.a)** Qué campos de la propuesta de la IA se pueden editar (además de la hora).
- **(4)** Textos/umbral exacto del límite IA (asumo 150/mes calendario, 1 por request).
- **(6)** Frecuencia del paywall (propuesta: post-onboarding + cada ~7 días si no es Premium) y si la
  prueba de 14 días es funcional o solo promocional (depende de RevenueCat, aún pendiente).

## Orden sugerido de trabajo

1. **Prioridad — Sincronización de calendario (1.a/1.b/1.c/1.d) + borrado con opciones (3.b)** — van juntas.
2. IA: límite server-side 150/mes + contador (4).
3. Vistas de Mi semana (2.a/2.b).
4. Editar sugerencias de la IA (3.a).
5. ✅ Dragones/Premium: vías + arcoíris + beneficios (5.a/5.b/5.c) — HECHO (2026-09-09).
6. Paywall / prueba gratis (6) — **próximo**.
