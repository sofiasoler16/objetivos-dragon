# Plan — Amigos / Grupos (familias) con tareas y objetivos compartidos

> Documento de planificación. Todavía SIN código. Definido con la usuaria el 2026-09-11.

## Resumen
Grupos (familia o amigos) donde se crean **tareas y objetivos DEL GRUPO**, se asignan a miembros, y
cada uno marca lo suyo. Todos los miembros ven las tareas del grupo, **a quién le toca cada una** y si
se cumplieron. **Lo personal de cada usuario sigue siendo privado** (los otros NO ven tus objetivos/tareas
personales, solo los del grupo).

**No hay un sistema de "amigos" aparte:** ser "amigo" = ser **miembro del mismo grupo**. Cuando alguien se
une a un grupo (con la app instalada), automáticamente ve las tareas de ese grupo, marca las suyas y puede
crear tareas — no hace falta un sistema de solicitudes de amistad. La fila de "Amigos" que se ve arriba en
la pantalla de Grupos es, simplemente, **las personas con las que compartís grupos** (cosmético).

## Estado (2026-09-15)
- ✅ **Fase 0** (verificación OAuth) · ✅ **Fase 1** (grupos/miembros/invitaciones/placeholders) ·
  ✅ **Fase 2** (tareas y objetivos del grupo: crear con todas las opciones, marcar con permisos,
  navegar días, dragón + barra de progreso del grupo). Todo en **DEV** (falta build para los testers).
- ⏳ **Pendiente dentro de la feature:**
  - ✅ **Editar / borrar** tareas y objetivos del grupo — HECHO (2026-09, en dev). Tocar el ítem → info
    (incluye los "veces por semana") → botones **Editar** / **Borrar** (solo si sos **admin o creador**;
    validado server-side). Editar abre el mismo formulario **precargado**. SQL: `grupos-10-editar.sql`
    (+ se agregó `puedo_editar` a esperados/semanales en `grupos-8`, hay que re-correrlo).
  - **Fase 3** — integración con el **Hoy personal** (**NO descartada**, por REFERENCIA no copia): en el
    ítem del grupo una **casilla "Agregar a mi pantalla de inicio"**; el ítem sigue siendo del grupo
    (`adopcion_personal` = vínculo liviano con hora opcional). Se muestra en Hoy por comodidad; al
    cumplirlo suma **solo al % del grupo** (NO al personal). Marcar desde Hoy = marcar en el grupo (misma
    fuente de verdad); con hora, se agenda en el calendario personal del usuario.
  - **Fase 3 ✅ HECHA** — adopción al Hoy personal por referencia (`grupos-12`), solo lo propio/sin asignar.
  - **Fase 4** — parcial: ✅ **transferir admin** (`grupos-13`); ✅ **aviso "te asignaron"** EN VIVO con app
    abierta (Supabase Realtime, `grupos-15` + `AvisoAsignacion`). ⏳ **push real (app cerrada)** requiere
    FCM → DIFERIDO al build final (código hecho y parqueado: `grupos-14` + `PushSync`, guía en
    `configurar-fcm-push.md`). ❌ fila "Amigos" descartada (no aporta hoy). "Eliminar cuenta que maneje
    grupos huérfanos" → al implementar borrado de cuenta / antes de publicar.
  - **Fase 5 ✅ HECHA** — Progreso por miembro (`grupos-16` + pestaña "Progreso"): rango Hoy/Semana/Mes,
    % del grupo + por miembro. Decisiones: % sobre lo ASIGNADO; sin asignar cuenta a quien lo hizo (bonus);
    placeholders se muestran; SEMANAL fuera del %.
  - **Fase 6** (nueva) — **Puntos y recompensas** del grupo (ganar puntos por cumplir, canjear por premios).
  - **Publicación:** Data Safety + política de privacidad (datos del grupo) + App Link tappable + build.

## Decisiones nuevas (Fase 2, 2026-09)
- **Los ítems de grupo son su propia tabla** (`item_grupo`), separada de los personales. Ofrecen las
  **mismas opciones que el personal** (frecuencia DIARIA/DIAS/**SEMANAL "X veces"**, fecha inicio/fin,
  fecha/hora límite, prioridad, descripción, emoji, asignar) **MENOS numérico/duración** (no hacen falta
  para un grupo; una "meta compartida entre todos" sería otra cosa, a futuro).
- **NO se reutiliza la pantalla personal de crear** (está atada a Health Connect / calendario /
  categorías / recordatorios) → **formulario propio del grupo que replica las opciones**.
- **Layout tipo Hoy:** títulos "Objetivos"/"Tareas" **fuera** del recuadro; **＋ Objetivo** / **＋ Tarea**
  por sección (vacío = "No tenés…" + botón); separado **"Para vos" / "Del grupo"**.
- **% del día del grupo = objetivos del día (DIARIA/DIAS) + tareas** (cada uno por su casillero). Los
  "veces por semana" van con su propio 2/3, aparte.
- **Permisos de marcar:** admin cualquiera; miembro solo lo suyo; sin asignar lo marca cualquiera.
- **Invitación por CÓDIGO** (popup para pegarlo); el **link tappable** (App Links) queda para el build.
- **Nombre del miembro** cae en cascada: nombre del perfil → nombre visible → prefijo del email → "Miembro".

## Reglas confirmadas
1. **Unirse al grupo:** por un **link de invitación** que genera el **admin** (el creador). El invitado
   debería tener la app instalada.
   - **Miembros "placeholder" (solo nombre):** si la persona NO tiene la app, el admin la agrega **por
     nombre** y le asigna tareas igual. Mientras tanto, **el admin marca las tareas por ella**. Cuando
     esa persona instala la app y entra por el link, **toma ese lugar** en el grupo (hereda las
     asignaciones y el historial del placeholder).
2. **Progreso (%):** (ajustado 2026-09-15)
   - Un ítem de grupo **siempre es del grupo**, aunque el usuario lo "adopte" a su Hoy personal. Al
     cumplirlo **suma SOLO al % del grupo, NO al % personal.** Verlo en Hoy es solo comodidad.
   - Hay un **% DEL GRUPO** = avance del grupo sobre sus objetivos/tareas del día.
   - (Antes se había dicho que sumaba al % personal; se cambió: no lo afecta, así el ítem tiene una sola
     fuente de verdad y no hay que tocar el cálculo del % personal.)
3. **Asignación:** existen tareas **asignadas a alguien fijo** ("Sofía lava los platos") **y** tareas
   **sin asignar** (cualquiera del grupo las puede agarrar).
4. **Recompensas:** las tareas y objetivos de grupo **NO dan monedas ni XP** (se puede sumar más adelante;
   se dejó afuera para evitar que se marquen tareas solo para ganar monedas).
5. **Roles y Premium:** 🔒
   - **Crear un grupo e invitar gente = requiere PREMIUM.** Solo un usuario Premium puede crear un grupo
     y mandar invitaciones (queda como **admin** del grupo).
   - **Unirse y participar es GRATIS:** una persona SIN Premium puede entrar a un grupo al que la
     invitaron, **ver sus tareas, marcar las suyas y crear tareas/objetivos del grupo**. Lo que NO puede
     es **crear grupos propios ni invitar**.
   - **Admin** (el creador, Premium): invita, saca gente, administra el grupo.
   - Si a un admin se le **vence el Premium**: el grupo sigue existiendo, pero no puede crear nuevos grupos
     ni invitar hasta reactivarlo (detalle fino a definir; posesión del grupo se conserva, como con los
     dragones premium).
   - **Server-side:** el gate se valida con `es_premium()` en las RPCs `crear_grupo` / `generar_invitacion`
     (no en la UI nomás), igual que el resto de Premium.

## Google Calendar: NO se toca (salvo elección personal)
Las tareas/objetivos de grupo **no van a Google Calendar por sí solas**. Solo si un usuario **adopta**
una a su Hoy y le pone hora, se agenda en **su** calendario personal (decisión suya, en su cuenta). Al
marcarla hecha/no hecha, **eso sí lo siguen viendo los del grupo**.
→ El flujo de datos de Google **no cambia** → **no afecta la verificación de OAuth en curso.**

## Salud (Health Connect): NUNCA en grupos
Las tareas/objetivos de grupo son **manuales**. **No** se usan datos de Health Connect (no se comparten
datos de salud entre usuarios — lo prohíben las reglas de Google).

## Modelo de datos (conceptual, nombres a afinar al implementar)
- **grupo**: nombre, tipo (FAMILIA / AMIGOS), admin (creador), fecha.
- **miembro_grupo**: grupo, usuario (null si es placeholder), nombre_visible, rol (ADMIN/MIEMBRO),
  estado (ACTIVO/PENDIENTE), es_placeholder (sí/no).
- **invitacion_grupo**: grupo, código/token del link, (opcional) el placeholder al que reemplaza,
  vencimiento.
- **item_grupo** (tarea u objetivo del grupo): grupo, título, tipo (tarea puntual / objetivo recurrente),
  frecuencia, miembro_asignado (null = sin asignar), creado_por.
- **registro_grupo**: item_grupo, fecha, quién lo cumplió, hecho/valor, marcado_por (para saber si lo
  marcó el admin por un placeholder).
- **adopcion_personal**: usuario, item_grupo, (opcional) hora/config → cuando un miembro suma un ítem de
  grupo a su Hoy.

## Seguridad (RLS) — el desafío principal
Hoy la base dice "cada uno ve SOLO lo suyo". Para grupos hay que agregar reglas para que **un miembro vea
los datos de SUS grupos** (grupo, miembros, tareas del grupo, cumplimientos) **sin** ver los grupos
ajenos ni lo personal de otros. Se hace con políticas que chequean "¿este usuario es miembro de este
grupo?" (funciones SECURITY DEFINER / policies por membresía). Es la parte más delicada; hay que hacerla
con cuidado para no filtrar datos.

## Pantallas (UI)
- **4ª pestaña abajo: "Grupos"** (junto a Objetivos · Hoy · Progreso). Al tocarla abre la pantalla de
  grupos.
- **Pantalla de Grupos (lista):**
  - Arriba, una sección **"Amigos"** = **TODAS** las personas con las que compartís grupos, o sea la
    **unión de los miembros de TODOS tus grupos** (tu "gente" en general). Es DISTINTA de "Miembros"
    (que es por grupo). Cosmético por ahora (un roster con avatares); a futuro podría servir para sumar a
    alguien conocido a un grupo nuevo sin mandar el link.
  - **NO se muestran XP ni monedas** en esta pantalla (no se ganan con tareas de grupo).
  - **Lista de tus grupos** (Familia, Viaje, etc.). Si sos Premium, botón **"Crear grupo"**; si no sos
    Premium, no aparece (solo ves los grupos a los que te invitaron).
- **Detalle de un grupo:**
  - Arriba: el **dragón** (el equipado) + la **barra de progreso del día del grupo** (% del grupo), igual
    que en Hoy.
  - **Tareas y objetivos del grupo** (asignados y sin asignar) + botón para **crear** (cualquier miembro).
  - Pestaña **"Miembros"** (separada de las tareas): lista de miembros (incluidos los placeholder) y, para
    el **admin**, un botón **"Invitar +"** que genera/comparte el link. El admin también puede sacar gente.
- **Cada tarea de grupo:** a quién le toca, **marcar hecho** (si es tuya, o si sos admin marcando por un
  placeholder), agarrar una libre, y botón **"Agregar a mi Hoy"**.
- **En Hoy:** interruptor **"mostrar mis tareas de grupo"**; las adoptadas aparecen como personales (con
  hora opcional) y **suman al %**.

## Consecuencias en Google Play / privacidad (actualizar al publicar esta feature)
- **Data Safety (Play Console):** declarar que datos del grupo (**nombre visible, asignaciones,
  cumplimientos**) son visibles para otros miembros del grupo.
- **Política de privacidad:** agregar una sección de **grupos** (qué ve cada miembro).
- **Eliminar cuenta:** al borrarte, salís de los grupos; tus ítems/asignaciones se limpian o reasignan;
  si eras el admin, hay que **transferir o disolver** el grupo.
- **Miembros placeholder:** se guarda el **nombre** de alguien que todavía no es usuario (con el
  consentimiento del admin). Al unirse, la persona consiente. Bajo impacto, pero conviene mencionarlo en
  la política.
- **Feature social:** invitación **con aceptación**, poder **salir del grupo**, y (a futuro, si hace
  falta) reportar/bloquear.

## Fases de implementación (roadmap)

> **Regla base:** cada fase es un bloque cerrado y testeable (una por sesión: probar → seguir). El punto
> más delicado y **transversal a todas** es la **seguridad (RLS)**: en cada fase hay que escribir/ajustar
> las políticas para que un miembro vea SOLO los datos de sus grupos, sin filtrar lo ajeno ni lo personal
> de otros. Todo esto es **JS + SQL (sin módulos nativos nuevos)**, pero **necesita un build nuevo** para
> llegar a los usuarios, y las **invitaciones por link** se prueban en el build instalado.

### Fase 0 — Verificación de Google OAuth ✅ HECHA (2026-09-12)
Prerrequisito para no mezclar temas con Google mientras revisaban. Aprobada.

### Fase 1 — Grupos, miembros e invitaciones ✅ HECHA (2026-09, en dev)
**Objetivo:** crear un grupo, invitar por link, unirse, y manejar miembros "placeholder" (por nombre).
**Base de datos (Supabase):**
- Tablas: `grupo`, `miembro_grupo`, `invitacion_grupo`.
- Función helper `es_miembro(grupo, usuario)` + **políticas RLS** (cada uno ve/gestiona solo sus grupos).
- RPCs: `crear_grupo`, `generar_invitacion` (código/link), `unirse_por_codigo`, `agregar_placeholder`,
  `reclamar_placeholder`, `sacar_miembro`, `salir_grupo`.
**App:**
- Capa `lib/data/grupos.ts` (wrappers tipados).
- Sección **"Grupos"** (entrada + lista de tus grupos + crear grupo).
- **Detalle de grupo:** lista de miembros (con placeholders), botón **Invitar** (comparte el link),
  agregar placeholder por nombre.
- **Unirse por link:** manejar el deep link (esquema `objetivosdragon://`) → abre la app y suma al grupo;
  si el link es de un placeholder puntual, la persona **lo reclama** (hereda su historial).
**Listo cuando:** dos personas pueden estar en el mismo grupo; el admin agrega un placeholder con nombre;
una persona real entra por el link y toma ese lugar.

### Fase 2 — Tareas y objetivos del grupo ✅ HECHA (2026-09, en dev)
**Objetivo:** crear ítems del grupo, asignarlos (fijos o sin asignar), marcarlos y ver el % del grupo.
> ⚠️ **Falta dentro de esta fase:** poder **editar y borrar** un ítem del grupo (hoy solo se crea y marca).
**Base de datos:**
- Tablas: `item_grupo` (tarea/objetivo del grupo), `registro_grupo` (cumplimientos).
- RLS: los miembros ven los ítems y registros de sus grupos.
- RPCs: `crear_item_grupo`, `asignar_item`, `agarrar_item` (sin asignar → me lo asigno), `marcar_item`
  (valida quién puede: el asignado, o el admin marcando por un placeholder), `progreso_grupo`.
**App:**
- Lógica pura en `/logic` para el **% del grupo** (reusa el modelo de crédito existente).
- En el detalle del grupo: lista de ítems (asignados / sin asignar), asignar, agarrar uno libre, marcar
  hecho, y mostrar el **% del grupo**.
**Listo cuando:** la familia crea tareas ("Sofía lava los platos"), las asigna, las marca, y ve el avance
del grupo.

**Detalle de la pantalla "Tareas y objetivos" (pedido de la usuaria, se armó como la de Hoy):**
- Recuadro **🔁 Objetivos** y recuadro **✔️ Tareas** (con casillero para marcar hecho/no hecho al costado).
- Dentro de cada recuadro, **separado "Para vos" vs "Del grupo"** (para ver de un vistazo lo que te toca).
- **Emoji por ítem** (elegible al crear; si no, 🔁/✔️ por defecto).
- **Tocar el nombre → info** del ítem (tipo, frecuencia, a quién le toca).
- **Permisos al marcar:** el **admin** marca cualquiera; un miembro solo los **suyos**; los **sin asignar**
  los puede marcar cualquiera. (Validado server-side en `marcar_item_grupo`.)
- **Navegar días** (‹ fecha ›, "Volver a hoy") para ver/editar días pasados o futuros (por si olvidó marcar).
- SQL: `grupos-6-items.sql` (crear/listar) + `grupos-7-marcar.sql` (emoji, `registro_grupo`,
  `marcar_item_grupo`, `esperados_grupo`) + `grupos-8-campos.sql` (descripción, prioridad, fechas,
  "X veces por semana" `semanales_grupo`) + `grupos-9-progreso.sql` (`progreso_grupo`).
- **Layout final (como Hoy):** títulos "Objetivos"/"Tareas" fuera del recuadro; botón **＋ Objetivo** /
  **＋ Tarea** por sección (vacío = "No tenés..." al medio + botón); el crear abre en modo objetivo o
  tarea según el botón. Formulario del grupo con las **mismas opciones que el personal** (sin
  numérico/duración, decisión de la usuaria).
- ✅ **2.3 HECHO:** **dragón (el equipado) + barra de progreso del día del grupo** arriba de la pestaña
  (`progreso_grupo`, % sobre los objetivos DIARIA/DIAS del día).

**✅ FASE 2 COMPLETA.**

### Fase 3 — Integración con "Hoy" (adoptar a personal) — ⏳ PENDIENTE (NO descartada)
**Objetivo:** que el usuario elija ver sus tareas de grupo en Hoy y pueda "adoptar" una como personal.
**Base de datos:**
- Tabla `adopcion_personal` (usuario ↔ ítem de grupo, con hora/config opcional).
- Ajustar las consultas de **Hoy** para incluir los ítems de grupo adoptados.
**App:**
- Interruptor **"mostrar mis tareas de grupo"** en Hoy.
- Botón **"Agregar a mi Hoy"** en cada ítem de grupo; opción de ponerle **hora** (y si tiene hora, se
  espeja en **SU** calendario personal, reusando lo que ya existe — decisión voluntaria del usuario).
- Al marcar hecho desde Hoy: se actualiza el **registro compartido del grupo** (lo ven los demás) **y**
  **suma a tu % personal**.
**Listo cuando:** un usuario ve en Hoy las tareas de grupo que adoptó, puede agendarlas en su calendario,
y al marcarlas suman a su % y se reflejan en el grupo.

### Fase 4 — Pulido, cuenta y publicación — ⏳ PENDIENTE
**Objetivo:** dejarlo robusto y en regla para publicar.
> Incluye: **editar/borrar ítems del grupo**, **transferir admin**, notificaciones (opcional), la fila
> **"Amigos"** arriba (cosmética). (Salir/sacar/eliminar grupo ya está hecho.)
**App / base:**
- Salir del grupo, el admin saca miembros, **transferir admin**, disolver grupo.
- **Eliminar cuenta** maneja los grupos (salir / transferir admin / las tareas del que se va → "sin asignar").
- (Opcional) Notificaciones: "te asignaron una tarea", "alguien completó…".
**Publicación (Play):**
- Actualizar el formulario de **Data Safety** (datos del grupo visibles entre miembros).
- Agregar la sección de **grupos** a la política de privacidad.
- **Build nuevo** + probar en el canal de prueba cerrada antes de pasar a producción.
**Listo cuando:** la feature está completa, en regla, y publicada.

### Fase 5 — Progreso del grupo (por miembro) — ⏳ PENDIENTE (nueva, pedido 2026-09-15)
**Objetivo:** una pantalla de "Progreso" del grupo (como la personal, pero grupal + individual): el
**% de cada miembro** en el **día / semana / mes** y el **% del grupo**. Ver cómo va cada uno.
**Base:** se apoya en `registro_grupo` (ya guarda `marcado_por` + fecha) → RPCs de agregación por
miembro y por rango, con el mismo criterio de crédito que el % del día.
**A definir:** ¿el % de un miembro se calcula sobre **lo que tiene asignado**? ¿los ítems "sin asignar"
cuentan para quien los hizo? ¿se muestran los placeholders (que marca el admin)?

### Fase 6 — Puntos y recompensas del grupo — ⏳ PENDIENTE (nueva, pedido 2026-09-15)
**Objetivo:** ganar **puntos** por cumplir tareas/objetivos individuales, y **canjearlos por recompensas**
que defina el grupo (ej. "elegir la película = 50 pts"). Gamificación **por grupo**, aparte del XP/monedas
personal de la app.
**A definir:** ¿puntos **fijos por ítem** o según **prioridad**? ¿quién crea las recompensas (el admin)?
¿cómo se "entrega"/marca una recompensa canjeada? 🔒 Otorgamiento server-side (como el resto de premios),
para que nadie se auto-regale puntos.
**Modelo tentativo:** `punto_grupo` (movimientos, idempotente por cumplimiento), `recompensa_grupo`
(catálogo del grupo), `canje_grupo` (quién canjeó qué). Ver [[premium-y-dragones]] para el patrón de
recompensas server-side.

## Pendiente para el build de los grupos
- **Link de invitación tappable (Android App Links):** hoy la invitación se comparte con un **código de
  6-8 caracteres** (funciona). Para que el mensaje lleve un link `https://drakostone.solersofia.com/unirse?
  codigo=…` que **abra la app directo**, hay que: (1) intent filters en `app.json` (autoVerify + dominio),
  (2) subir `/.well-known/assetlinks.json` con la SHA-256 de la app al dominio, (3) una página web `/unirse`
  de fallback (descarga + código), (4) **entra en el build de los grupos** (no es rebuild aparte). La ruta
  `app/grupo/unirse.tsx` (deep link con `?codigo`) YA está lista para recibirlo.

## A definir más adelante (menores)
- ¿El link de invitación es **por miembro** (para reemplazar un placeholder puntual, ej. "invitar a
  Julieta") o **genérico** y el admin le asigna el lugar al entrar? (Propuesta: poder hacer las dos.)
- ¿Qué pasa con las tareas de un miembro que **sale** del grupo? (Propuesta: quedan "sin asignar".)
- ¿El admin puede **transferir** el rol de admin a otro?
- Historial del placeholder al ser reclamado: **se transfiere** al usuario real (propuesta: sí).
