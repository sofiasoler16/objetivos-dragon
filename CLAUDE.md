# CLAUDE.md — Contexto del proyecto

App móvil de **objetivos, hábitos y tareas** con mascota (dragón).
Concepto central: **Planificar → Hacer → Medir**. El usuario define qué quiere cumplir,
la app arma automáticamente qué tiene que hacer hoy, y a partir de lo que cumple genera
estadísticas de progreso.

Tres pantallas (tabs inferiores): **Objetivos | Hoy | Progreso**. La default es **Hoy**.

> Este archivo es el contexto permanente. Leelo al inicio de cada sesión.
> Archivos hermanos: `plan-desarrollo.md` (roadmap por fases), `esquema.sql` (base de datos)
> y `esquema-dragones.sql` (migración aditiva del sistema de dragones/temas/XP — ver Anexo).

---

## Stack (confirmado)

- **App:** Expo (React Native) + **TypeScript**. App **nativa** para Google Play y App Store
  (NO es PWA ni web).
- **Navegación:** expo-router (file-based). Tabs: Objetivos · **Hoy (index)** · Progreso.
- **Backend / DB:** **Supabase** (Postgres + Auth + RLS). La app habla **directo** a Supabase
  con `supabase-js`. **No hay servidor propio en el MVP.**
- **Consultas con lógica** (objetivos "esperados hoy", cálculo de progreso): **funciones SQL / RPC**
  en Postgres, no en el cliente.
- **Estado de servidor:** TanStack Query (React Query).
- **Notificaciones:** expo-notifications (locales) — Fase 10.
- **Health Connect:** react-native-health-connect (solo V2, requiere dev build, solo Android).

---

## Estructura de carpetas

```
/app
  /(auth)            # login, registro
  /(tabs)            # objetivos.tsx, index.tsx (=Hoy), progreso.tsx
  /objetivo/[id].tsx # detalle / editar objetivo
  /tarea/[id].tsx    # detalle / editar tarea
/lib
  supabase.ts        # cliente
  types.ts           # tipos generados: `supabase gen types typescript`
  /data              # funciones tipadas: objetivos.ts, tareas.ts, registros.ts, progreso.ts
/components          # tarjetas, barra de progreso, dragón, inputs
/logic               # reglas puras: mensaje del dragón, cálculo de %, esperados hoy
```

## Convenciones

- La **UI nunca llama a Supabase directo**: siempre pasa por `/lib/data`. (Así, migrar de base
  = reescribir solo esa carpeta.)
- Identificadores del dominio en **español** (objetivo, registro_objetivo, tarea, categoria…).
- TypeScript estricto. Tipos generados desde Supabase, no escritos a mano.
- Lógica de cálculo y de mensajes en `/logic` como **funciones puras** (testeables, sin UI).

---

## Modelo de datos (resumen)

Tablas: `perfil`, `categoria`, `objetivo`, `objetivo_dia`, `registro_objetivo`, `tarea`.
Ver `esquema.sql` para el detalle (enums, RLS, trigger de alta). Puntos clave:

- `objetivo` = lo que la persona **quiere** hacer (intención + configuración).
- `registro_objetivo` = lo que **realmente** hizo (una fila por objetivo y día, con
  `UNIQUE(id_objetivo, fecha)` → usar **upsert**).
- Tipos de objetivo: `BOOLEAN`, `NUMERIC`.
- Frecuencias: `DAILY`, `SPECIFIC_DAYS` (usa `objetivo_dia`, ISO 1=lunes…7=domingo),
  `WEEKLY_COUNT` (usa `frecuencia_cantidad`).

## 🔒 Reglas que NO se tocan

1. **El Progreso se calcula SIEMPRE desde `registro_objetivo`**, nunca del estado actual de
   `objetivo`. (Esto es lo que permite sumar gráficos, XP, Health Connect, etc. sin rehacer nada.)
2. **% del día:** denominador = objetivos obligatorios de hoy (`DAILY` + `SPECIFIC_DAYS` que caen
   hoy), **sin** los omitidos. Numéricos = crédito **proporcional** (1500/2000 = 0,75).
   `omitido` queda fuera del numerador **y** del denominador. Las **tareas** se cuentan aparte
   de los objetivos.
3. **WEEKLY_COUNT** no está atado a un día: en Hoy aparece como tarjeta **opcional** que suma al
   progreso semanal y **no** penaliza el % del día.
4. **Semana = lunes** (ISO). **"Hoy" se calcula en la zona horaria del usuario**
   (`America/Argentina/Buenos_Aires`), **no** en UTC.
5. Los **mensajes del dragón se generan por reglas** (según hora + % + tareas), no se guardan en base.

---

## Flujo de trabajo con Claude Code

- **Una fase por sesión** (ver `plan-desarrollo.md`). Al terminar: commit + `/clear`.
- Actualizá abajo "Fase actual" al avanzar.
- Antes de agregar cualquier feature, pasala por: *¿ayuda a planificar, cumplir o entender los
  objetivos?* Si no, no va.

**Fase actual: Post-MVP V3 — sistema de dragones.** Plan de la usuaria (en orden, preguntando
y probando antes de cada paso): 1) pantalla "Mi Dragón" + botón arriba-izq, 2) XP+monedas visibles
arriba en todas las pantallas, 3) comprar+equipar, 4) sistema de temas (equipar cambia colores).
**Paso 1 hecho:** 2º dragón **Fuego** (`assets/dragons/fuego/` registrado en `constants/dragons.ts`;
imágenes redimensionadas, originales en `art-source/uploads/fuego-originales/`). Seed en
`seed-dragon-fuego.sql` (tema Fuego cálido + dragón credit_cost 100 + regla FREE) — **la usuaria lo
corre en Supabase**. Capa `lib/data/dragones.ts` (`cargarColeccion`, `assetKeyEquipado`), lógica pura
`logic/dragones.ts` (`estadoColeccion`/`requisitoCumplido`/`textoRequisito`). Pantalla modal
`app/mi-dragon.tsx` (grupos: Mi colección/Disponibles/Bloqueados/Premium; header nivel·XP·monedas).
`components/DragonButton.tsx` (cara del dragón equipado → abre Mi Dragón) arriba-izq en las 3 tabs.
Comprar/Equipar por ahora avisan "Paso 3". Los tokens del tema Fuego recién aplican en el Paso 4.
**Paso 2 hecho (XP+monedas):** RPC `otorgar_recompensa(p_motivo, p_clave)` en `funciones-recompensas.sql`
(SECURITY DEFINER, idempotente por `clave_idempotencia`, montos server-side: objetivo +10 XP/+5 🪙,
tarea +15 XP/+8 🪙; recalcula caché perfil, nivel = XP/100 + 1) — **la usuaria lo corre en Supabase**.
`lib/data/recompensas.ts` (`otorgarRecompensa`/`recompensaSegura` best-effort con cast rpc hasta
regenerar tipos). Cableado en `marcarObjetivoCompletado`/`registrarValorNumerico`/`completarTarea`
(clave `obj:{id}:{fecha}` / `tarea:{id}`; no rompe si el RPC falla). `obtenerPerfilStats` +
`components/StatsPills.tsx` (⚡XP 🪙monedas, query `['perfil-stats']`) arriba-izq junto al DragonButton
en las 3 tabs; se invalidan `['perfil-stats']`+`['coleccion']` al completar.
Barra superior muestra: **Nivel** (número + "Nivel") · **⚡ XP dentro del nivel** (0–99, se reinicia al
subir) · **🪙 monedas**. Helpers puros en `logic/dragones.ts` (`nivelDesdeXp`, `xpEnNivel`,
`progresoNivel`, `XP_POR_NIVEL=100`). `xp_total` en DB sigue acumulativo (🔒); el "reinicio" es solo
de display (`xp % 100`). Mi Dragón muestra barra de progreso al próximo nivel.
**Paso 3 hecho (comprar+equipar):** RPC `comprar_dragon(p_id_dragon)` en `funciones-compra.sql`
(SECURITY DEFINER: valida ya-lo-tiene/premium/requisito FREE·NIVEL·XP/monedas, resta créditos
idempotente `compra:{id}`, crea `usuario_dragon`, recalcula caché). `comprarDragon` (cast rpc) +
`equiparDragon` (upsert `preferencia_usuario`, dragón+tema; RLS lo permite). Mi Dragón: botones
Comprar (confirm + "faltan X 🪙" si no alcanza + celebración → ofrecer equipar) y Equipar reales.
**El dragón equipado aparece en todas las pantallas**: hook `hooks/useDragonEquipado.ts` (query
`['dragon-equipado']`) usado en el hero de Hoy (`DragonHero assetKey`), Objetivos y Progreso
(`DragonMascot assetKey`) + el DragonButton. Al comprar/equipar se invalidan
`['coleccion','perfil-stats','dragon-equipado']`. Los COLORES siguen igual (Paso 4). 
**Paso 4 hecho (sistema de temas):** `constants/theme.ts` ahora exporta `type Tema` + `TEMA_ORIGINAL`
(y `colors` como alias de respaldo). `logic/tema.ts` (`temaAColores`: mapea los 9 colores del `tema`
de la DB a la paleta completa, derivando variantes con tint/shade/alpha; rojo de error fijo).
`components/theme-provider.tsx` (`ThemeProvider`+`useTheme`, query `['tema-activo', userId]` que lee
`preferencia_usuario → tema`; fallback TEMA_ORIGINAL). Montado en `_layout` bajo SessionProvider.
`lib/data/dragones.ts` → `temaActivo()`. **Los 21 archivos** convertidos al patrón
`const colors = useTheme(); const styles = makeStyles(colors)` (styles como factory `(colors: Tema) =>
StyleSheet.create`). Al equipar se invalida `['tema-activo']` → toda la app se repinta. ⚠️ Correr
`actualizar-tema-original.sql` (alinea el tema Original de la DB al fondo verde actual). 

**Sistema de dragones (V3) COMPLETO:** Mi Dragón + XP/monedas + comprar/equipar + temas.

**Ajustes post-V3 (lote de mejoras):**
- 3er dragón **Nocturno** 🌙 (`assets/dragons/nocturno/`, `seed-dragon-nocturno.sql`, credit 250).
  Tema **OSCURO**: `logic/tema.ts` ahora detecta fondo oscuro (luminancia) y deriva chips oscuros +
  textos claros. (Es tema del dragón, NO sigue el modo oscuro del celular.)
- Fix: objetivo diario creado de noche no aparecía en Hoy → `fecha_inicio` ahora usa `hoyISO()` (local).
- Fix: encabezados de Mi Dragón y Perfil tapados por la cámara → `SafeAreaView edges top`.
- Recompensa por **prioridad** de tarea (BAJA 10/5 · MEDIA 15/8 · ALTA 25/13) y **devolución al
  desmarcar** (XP/monedas): `funciones-recompensas-v2.sql` (`otorgar_recompensa` con motivos por
  prioridad + `revocar_recompensa`); `lib/data/recompensas.ts` (`motivoPorPrioridad`, `revocacionSegura`);
  wired en `marcarObjetivoCompletado`/`registrarValorNumerico`/`completarTarea` (revoca al desmarcar).
- Hoy: **Tareas de hoy** arriba (no desaparecen al marcarlas, se ven hechas todo el día; incluye
  vencidas); **Próximas** (mañana→7 días) abajo. Numéricos: botones **−chico/−grande** + **botones
  personalizados guardados** por objetivo (AsyncStorage `pasos_custom_v1`, long-press para borrar);
  "Ingresar" ahora crea un botón nuevo (no setea el total). Los +250/+500 salen de `pasosNumericos(meta)`.

**Logros (Pasos A–C hechos):** tablas ya existían (`logro`/`usuario_logro`). SQL en
`funciones-logros.sql` (la usuaria lo corre): RPC `evaluar_logros()` (SECURITY DEFINER) que mira el
historial con el MISMO crédito que Progreso, desbloquea logros nuevos, otorga XP/monedas idempotente
(`logro:{id}`) y devuelve los recién ganados para celebrar; seed de 3 logros (En racha=RACHA 3, +20/10 ·
Imparable=RACHA 7, +40/25 · Semana perfecta=SEMANA_PERFECTA ≥80% con mín. 5 días activos en 7, +50/30);
`comprar_dragon` actualizado: reglas de historial se habilitan si tenés un logro de ese `rule_type`.
Cliente: `lib/data/logros.ts` (`evaluarLogros`/`evaluarLogrosSeguro`/`listarLogros`), `logic/dragones.ts`
(`requisitoCumplido`/`estadoColeccion` toman `logrosDesbloqueados:Set<string>`; `textoRequisito` para
SEMANA_PERFECTA/RACHA), `cargarColeccion` ahora devuelve `logrosDesbloqueados`, hook
`hooks/useRevisarLogros.ts` (llama a `evaluarLogrosSeguro`, invalida perfil/colección/logros y celebra
con Alert 🏆). Cableado en Hoy (`marcar`/`registrar`/`completar`) y Objetivos (`completar`). Sección
**Logros 🏆** en Mi Dragón (`listarLogros`, query `['logros']`). ⚠️ Correr `funciones-logros.sql`.
**Paso D hecho — dragón de HIELO ❄️:** arte de la usuaria en `assets/dragons/hielo/` (6 PNG
redimensionadas a máx 700px, originales en `art-source/uploads/hielo-originales/`), registrado en
`constants/dragons.ts` (`dragon_hielo`). `seed-dragon-hielo.sql` (la usuaria lo corre): tema **Hielo**
claro helado (celeste `#eef7fb`) + dragón `credit_cost 0`, `orden 4` + regla `SEMANA_PERFECTA`. **Los
dragones de logro NO se compran: `evaluar_logros` los REGALA** (inserta `usuario_dragon` precio 0) al
desbloquear un logro de ese mismo `rule_type` (decisión de la usuaria). Se muestra "Bloqueado" hasta
cumplir el logro; ahí pasa directo a "Mi colección" (Equipar). `test-desbloquear-hielo.sql` simula el
desbloqueo para probarlo sin esperar la semana real. **Sistema de logros + hielo COMPLETO.**

**Bugs arreglados (post-logros):** (a) botones "Editar" de Objetivos usaban `backgroundColor:'#fff'` y
checkbox `borderColor:'#d8d3ea'` fijos → ahora `colors.surface`/`colors.track` (responden al tema).
(b) tema Original volvía a crema: el seed base en `esquema-dragones.sql` creaba Original con fondo
`#faf6ef` → corregido a `#f1f8f3`; para bases ya creadas correr `actualizar-tema-original.sql`.

**Fase 17 HECHA — builds con EAS (nube):** cuenta Expo `sofi16044s-team`, proyecto `objetivos-dragon`
(projectId en `app.json`). `eas.json` con perfiles `development` (dev-client, APK) / `preview`
(standalone, APK) / `production` (AAB); las credenciales EXPO_PUBLIC de Supabase están en `env` de cada
perfil (la `anon key` es pública, seguro). Keystore lo maneja EAS. **⚠️ 3 crashes resueltos:** la
plantilla SDK 54 traía `@expo/ui`, `expo-symbols` y `expo-glass-effect` (todos SIN usar) que rompían
el arranque en Android (`NoClassDefFoundError: ComposeViewFunctionDefinitionBuilder`, `ExpoUIModule`) →
**removidos** (`npm uninstall`). **⚠️ EAS compila desde el commit de git**: como estos cambios están SIN
COMMITEAR, hay que buildear con **`EAS_NO_VCS=1`** para que suba el working dir (si no, revive el crash).
La usuaria eligió el **preview standalone** (anda solo, sin Metro/QR/cable — evita los líos de red del
dev-client). **Actualizar la app = `EAS_NO_VCS=1 eas build --profile preview --platform android`** +
reinstalar el APK. Free tier EAS = ~15 Android builds/mes. Ver [[build-eas-workflow]]. Build local con
Android Studio queda para desarrollo intenso (necesita JDK 17 —hay 21— + `ANDROID_HOME`). Publicar a
Play sigue diferido ([[build-apk-diferido]]).

**Fase 18 HECHA — Health Connect: pasos** (Android, solo lectura). `react-native-health-connect@4`
(+ `expo-build-properties` con `minSdkVersion 26`) + config plugin oficial; **plugin local
`plugins/withHealthConnectQueries.js`** agrega el `<queries>` de `com.google.android.apps.healthdata`
(el plugin oficial solo pone el rationale). Permisos en `app.json → android.permissions`
(`READ_STEPS`, `READ_NUTRITION`). Puente `lib/health.ts` (ÚNICO que toca el nativo: `tienePermiso`/
`pedirPermiso`/`conectarHealthConnect`/`abrirHealthConnect`/`estadoHealthConnect`/`leerPasosDeHoy`).
Orquestación `lib/data/salud.ts`: `objetivosHealthConnect`, `sincronizarHealthConnect(interactivo)`
(por cada objetivo con `fuente_datos=HEALTH_CONNECT` lee el valor de hoy y hace upsert vía
`registrarValorNumerico` — guarda SOLO el valor, no el flujo crudo 🔒). En el form: switch "🔗 Traer de
Health Connect" (NUMERIC). En Hoy: auto-sync al abrir (si hay permiso) + tarjeta especial (tag +
botón Actualizar, sin botones manuales). Perfil → sección **Permisos** (estado + Conectar/Administrar).
Fix incluido: al crear/editar un objetivo ahora se invalida `['esperados-hoy','semanales-hoy',
'objetivos-hc']` (antes el objetivo nuevo no aparecía en Hoy hasta reiniciar).

**Fase 19 HECHA — Health Connect: calorías + comidas.** Un objetivo HC puede traer **pasos o calorías**;
la métrica se deriva de la **unidad** (`metricaDeUnidad`: `/cal/i` → CALORIES, si no STEPS) para NO
tocar el schema. Form: al activar HC aparece selector **👟 Pasos / 🍎 Calorías** (fija la unidad
`pasos`/`kcal` + meta sugerida; unidad read-only). `lib/health.ts` lee Nutrition: `leerComidasDeHoy`
(nombre + kcal `energy.inKilocalories` + mealType) y `leerCaloriasDeHoy` (suma). `salud.ts`:
`comidasDeHoy(interactivo)` + tipo `ComidaHC`. En Hoy: la tarjeta de calorías tiene un **ícono info ℹ️
al lado del nombre** que abre un **modal "🍽️ Comidas de hoy"** (lista en violeta claro + total). La
pantalla de editar quedó SOLO con lo editable (las comidas NO van ahí, decisión de la usuaria).
**Requiere una app que escriba nutrición a Health Connect** (la usuaria usa **SnapCalorie** → Samsung
Health → HC). Los datos de Samsung Health a HC tienen **latencia** (el contador en vivo va adelante).
Ver [[health-connect]].

**Cómo se desarrolla/prueba HC (dev build + USB):** dev build de EAS instalado por cable
(`adb install -r`), `adb reverse tcp:8081 tcp:8081` (túnel que evita los líos de WiFi), Metro con
`npx expo start --dev-client`, y se abre apuntando a localhost con
`adb shell am start -a android.intent.action.VIEW -d "objetivosdragon://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`.
**Solo se recompila si cambia config nativa** (permiso nuevo); el resto es hot reload. `adb` está en
`~/Android/Sdk/platform-tools/adb`.

**Objetivos predeterminados (presets) HECHO:** los "Sugeridos" (Pasos 👟 8000, Calorías 🍎 2000 kcal,
Agua 💧 2000 ml) son objetivos NORMALES marcados con `clave_preset` (columna nueva, migración
`agregar-clave-preset.sql` — corrida + tipos regenerados). Se prenden/apagan con un interruptor en la
pestaña Objetivos (sección **Sugeridos**, abajo de "Objetivos") en vez de crearlos a mano; activos,
son objetivos comunes (editás meta/días, se conectan a HC igual). Catálogo puro `logic/presets.ts`
(`PRESETS`, `clavePresetDe`); capa `lib/data/presets.ts` (`listarEstadoPresets`/`activarPreset`/
`desactivarPreset`). **Activar** = crear desde defaults (DAILY·NUMERIC, `fecha_inicio=hoyISO()`, con la
`fuente_datos` del preset) o **reactivar** la fila existente conservando ediciones; **desactivar** =
`activo=false` (oculta sin borrar → índice único parcial `(id_usuario, clave_preset)` garantiza una
sola fila y que reactivar restaure lo editado). Los presets activos salen de la lista "Objetivos"
(filtro `clavePresetDe`) para no duplicar, pero SÍ aparecen en Hoy (y los de HC se autcollenan). Al
togglear se invalidan `['presets','objetivos','esperados-hoy','semanales-hoy','objetivos-hc']`.
Pendiente futuro: modo "meta vs límite" para calorías (alcanzar vs no pasarse), se dejó para después.

**Fix UI:** los `placeholder` de todos los `TextInput` (login, registro, categorías, objetivo, tarea)
ahora fijan `placeholderTextColor={colors.textMuted}` (antes tomaban un default invisible en el tema).

**Fase 20 HECHA — Calendario del dispositivo (Track B).** Lee los eventos del **calendario del
teléfono** con `expo-calendar@15` (solo lectura, incluye los de Google que el SO sincroniza) — NO la
API de Google Calendar (evita su verificación OAuth). Puente ÚNICO `lib/calendario.ts`
(`permisoCalendario`/`pedirPermisoCalendario`/`leerEventos` → tipo `EventoCalendario` normalizado).
Orquestación `lib/data/agenda.ts`: `eventosDeLaSemana(interactivo)` arma lun→dom (🔒 semana=lunes,
TZ usuario) agrupando por día (best-effort, nunca lanza); los eventos **de todo el día** toman el día
de `inicio.slice(0,10)` para no correrse por TZ. Lógica pura `logic/agenda.ts` (`nombreDia`,`horaHHMM`,
`rangoHorario`). Pantalla nueva **`app/agenda.tsx` "Mi semana"** (futura premium): lista de la semana
con Hoy destacado, puntito con el color del calendario de origen, botón "Conectar calendario" si falta
permiso, y botón **"Organizá mi semana con la IA"** (placeholder → se cablea en Fase 21). Se entra por
un **recuadro violeta "Mi semana" arriba en la pestaña Objetivos** (`router.push('/agenda')`) — NO en
Perfil. Config: plugin `expo-calendar` en `app.json` (agrega permisos READ/WRITE_CALENDAR en Android;
solo usamos lectura — al publicar conviene dejar solo READ), ruta en `_layout`. Query `['agenda-semana']`.
**⚠️ Requirió rebuild del dev build** (módulo nativo): dev build development recompilado con
`EAS_NO_VCS=1 eas build --profile development --platform android` + `adb install -r`. Ver [[calendario]].

**Fase 21 HECHA — Edge Function + IA "Organizá mi semana" (Track B).** 🔒 La IA PROPONE, el código
EJECUTA (la IA nunca escribe en la base). Edge Function `supabase/functions/organizar-semana/index.ts`
(Deno): valida `Authorization` + `supabase.auth.getUser()` (protege los créditos de la API), arma el
`systemPrompt(hoy, categorias)` (guardrail estricto: SOLO agendar objetivos/tareas, si el pedido es de
otro tema devuelve listas vacías + "Solo puedo ayudarte a agendar objetivos y tareas 🐉"; mapea a DAILY/
SPECIFIC_DAYS/WEEKLY_COUNT, NUMERIC con meta+unidad o BOOLEAN, examen→fecha_fin+tarea, categorías SOLO
de la lista), llama a **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`, `max_tokens 1600`) y devuelve
SOLO el JSON. La API key vive como **secret de Supabase** (`ANTHROPIC_API_KEY`), nunca en la app.
Cliente: `logic/ia.ts` (tipos `PropuestaIA`/`ObjetivoPropuesto`/`TareaPropuesta` + `sanitizarPropuesta`
= última barrera 🔒: descarta enums/frecuencias/categorías/fechas inválidas antes de escribir);
`lib/data/ia.ts` (`organizarSemana(texto)` invoca la función con `{texto, hoy, categorias}` y sanea;
`crearDesdePropuesta(objetivos, tareas)` escribe vía `crearObjetivo`/`crearTarea`).
`components/OrganizarSemanaModal.tsx` (modal full-screen: escribir pedido → "Generar propuesta" → lista
con checkboxes por objetivo/tarea → "Agendar (N)" → invalida `['objetivos','tareas','esperados-hoy',
'semanales-hoy']`). Cableado en `app/agenda.tsx` (el botón "Organizá mi semana con la IA" abre el modal).
`supabase/functions` excluido en `tsconfig.json` (código Deno). **Desplegada y probada** (la usuaria
cargó ~US$5 de crédito en console.anthropic.com, key como secret, `supabase functions deploy
organizar-semana`). Costo: Edge Functions gratis (≤500k/mes), la IA se paga por token (centavos).
No requirió rebuild (es 100% JS; el dev build carga el código por Metro). Ver [[ia-organizar-semana]].

**Fase 21.1 HECHA — Objetivos "con horario" + espejo a Google Calendar + anti-solapes.** Migración
aditiva `agregar-horario-objetivos.sql` (corrida): `hora_inicio`/`hora_fin`/`id_evento_calendario` en
`objetivo` y `tarea` (tipos regenerados). **Con hora_inicio+hora_fin = EVENTO** (se agenda en el
calendario); **sin hora = objetivo del día** (no es evento); WEEKLY_COUNT nunca lleva hora (sin día
fijo). El evento se escribe en el **calendario PRINCIPAL de Google del usuario** con prefijo de título
**MARCA "🐉 "** — Android NO deja crear una capa dedicada que sincronice (solo Google, vía su API OAuth
que se evitó); un calendario local no sincroniza a la web. `lib/calendario.ts` ahora ESCRIBE:
`calendarioDestino(preferirEmail)` (elige el Google primario de la cuenta logueada, cae a cualquiera
modificable), `crearEventoDragon` (prefija 🐉, recurrencia WEEKLY para SPECIFIC_DAYS vía isoADiaExpo,
DAILY = los 7 días, `endDate`=fecha_fin), `borrarEventoDragon`; `leerEventos` EXCLUYE por defecto los
títulos con 🐉 (ya salen de la base → sin duplicados). `lib/data/agenda.ts`: `eventosDeLaSemana(interactivo,
lunesISO)` ahora mezcla eventos externos + objetivos/tareas propios con horario (tipo `ItemAgenda`,
`esApp`), con **navegación de semanas**; `compromisosDeContexto(21)` arma los bloques ocupados;
`espejarEnCalendario`/`borrarEspejo`. `logic/agenda.ts`+`logic/ia.ts`: helpers puros
(`primeraFechaOcurrencia`, `ocurrenciasObjetivo`/`ocurrenciasTarea`, `conflicto`/`primerConflicto`).
`crearDesdePropuesta` guarda hora + espeja el evento y guarda `id_evento_calendario`; `eliminarObjetivo`/
`eliminarTarea` borran el evento espejo. La IA recibe los compromisos (no pisar) + puede agendar a
FUTURO; el prompt pide revisar cada día de la recurrencia. **🔒 La IA no es 100% confiable con horarios
→ el cliente valida:** `organizarSemana` devuelve `{propuesta, ocupado}`; `OrganizarSemanaModal` deja
**mover la hora** (DateTimeField) y muestra **⚠️ aviso de solapamiento** (contra lo ocupado + los otros
ítems propuestos), que se resuelve al mover la hora. `app/agenda.tsx` navega semanas y marca los
objetivos con tag 🐉. **Probado end-to-end** (evento aparece en Google Calendar de la cuenta logueada;
⚠️ aparece/desaparece). Pendiente futuro: capa dedicada sincronizada = requeriría la **API de Google
Calendar** (OAuth + verificación de Google), diferida a la etapa de publicación. Ver [[objetivos-con-horario]].

**Fase 21.2 HECHA — Horario por día + duración→sí/no + info + tareas sin bloque.**
- **Duración → BOOLEAN + bloque:** "estudiar 2 horas" ya NO es NUMERIC; es sí/no y la duración define
  el LARGO del bloque de horario. Cantidades contables (pasos, ml, km, páginas) siguen NUMERIC. (Regla
  en el prompt de la Edge Function.)
- **Hora POR DÍA (SPECIFIC_DAYS):** migración `agregar-horario-por-dia.sql` (corrida) → `hora_inicio`/
  `hora_fin` en `objetivo_dia`. Cada día puede caer a distinta hora. `ObjetivoConDias.horariosDia`;
  `DiaHorario`; `setDiasObjetivo`/`crearObjetivo` aceptan `(number | DiaHorario)[]`; `listarHorariosDia`.
  `logic/ia.ts` (`horarios_dia` en `ObjetivoPropuesto`, saneo por día, `ocurrenciasObjetivo` por día);
  `espejarEnCalendario` es unión discriminada (DAILY una hora / SPECIFIC_DAYS un evento semanal POR DÍA
  a su hora / UNICO). El prompt pide `horarios_dia` = [{dia,hora_inicio,hora_fin}].
- **Horario editable en el form** (`app/objetivo/[id].tsx`): interruptor "🕐 Agregar horario" (opcional,
  OFF por defecto; no aparece en WEEKLY_COUNT), auto-relleno al editar. DAILY = un rango; SPECIFIC_DAYS
  = rango por día con switch "Usar horario diferente para cada día" (OFF por defecto = misma hora para
  todos). Componente `RangoHora`. Al guardar espeja/borra el evento (borra el viejo y recrea).
- **Recurrencia confiable:** el espejo crea UN evento semanal POR DÍA (Android ignora BYDAY multi-día y
  repetía solo el día de inicio). `id_evento_calendario` puede guardar varios ids coma-separados;
  `borrarEventoDragon` los borra todos.
- **Tareas SIN bloque de horario (🔒 decisión):** las tareas son solo vencimiento (fecha + hora límite),
  NUNCA evento de calendario. Se quitó hora_inicio/hora_fin de `TareaPropuesta`, del prompt, de
  `crearDesdePropuesta`, de la info y de la agenda. (Las columnas quedaron en la tabla pero sin uso.)
- **Pantallas de INFO (solo lectura):** `app/objetivo/info/[id].tsx` y `app/tarea/info/[id].tsx`
  (registradas en `_layout`), muestran lo cargado + botón "Editar" → al form existente. En **Hoy** el
  nombre/flecha de cada objetivo (booleano, numérico, HC, WEEKLY_COUNT) abre la info del objetivo, y el
  nombre de cada tarea abre la info de la tarea (el checkbox sigue marcando). Tarea info: "Hora: 16:00"
  (una sola hora). En **Mi semana** los objetivos son tocables (→ info, con `refObjetivoId`).

**Sistema Premium (V4) + dragones nuevos + celebraciones HECHO.** Premium = **"Mi semana"/IA** +
**dragones/temas premium** (elección de la usuaria). 🔒 Premium es **server-side** (tabla `suscripcion`,
fuente de verdad): `funciones-premium.sql` (corrida) → RPC `es_premium()` + toggle de PRUEBA
`establecer_premium_prueba(bool)` (escribe `suscripcion`; se reemplaza por el webhook de RevenueCat) +
`comprar_dragon` valida Premium contra `suscripcion`. Cliente: `hooks/usePremium.ts` (`usePremium`
=`es_premium`, `useSetPremiumPrueba`). `app/premium.tsx` (paywall modal: beneficios + planes Mensual/
Anual placeholder + "Activar Premium" de prueba). Gate: **Mi semana** (card en Objetivos → `/premium`
si no premium), y **dragones** en Mi Dragón. **Posesión vs uso** 🔒: los dragones premium quedan tuyos
para siempre; sin Premium NO se pueden usar → estado `premium_bloqueado` (en Mi colección con candado +
"Reactivar Premium"), y el dragón/tema equipado **cae al Original** (assetKeyEquipado/temaActivo chequean
premium; la preferencia se conserva → al reactivar vuelve solo). **2 tipos de dragón premium:** tipo A
(gratis con Premium, `credit_cost 0` → botón "Reclamar") y tipo B (premium + monedas, ej. 100 → sin
Premium no se compra ni con monedas). **Dragones nuevos:** **Caballero Medieval** 🛡️ (premium gratis,
`seed-dragon-medieval.sql`, `assets/dragons/caballero-medieval/`) y **Princesa Medieval** 👑 (premium
+100🪙, `seed-dragon-princesa-medieval.sql`). 6 expresiones c/u, **normalizadas** con Pillow (mismo
tamaño/centrado; DragonHero sin el boost de festejo para estos). **Cartel de celebración**
`components/CelebracionDragon.tsx` (montado en tabs): al **desbloquear un logro que regala dragón**
(vía RPC `dragon_de_logro`, `funciones-dragon-logro.sql`) → "¡Desbloqueaste el dragón X!" + Equipar; al
**activar Premium con un dragón gratis sin reclamar** (vigía sobre la colección) → "Podés reclamar X" +
Reclamar. No repite (AsyncStorage `dragones_celebrados_v1`).

**Dragones nuevos 2026-09-04 — MAGO 🧙 y GIMNASIO 💪 (comprables con monedas, 150 c/u).** Arte de la
usuaria (ya venía en `assets/dragons/mago/` y `.../gimnasio/`) con poses de tamaños dispares →
**normalizado con Pillow** (script en scratchpad `normalizar.py`; recorta al contenido, iguala la ALTURA
del dragón y centra en canvas uniforme: mago 549x703, gimnasio 583x703; originales en
`art-source/uploads/<n>-originales/`). Registrados en `constants/dragons.ts` (`dragon_mago`,
`dragon_gimnasio`) y sumados al set `NORMALIZADOS` de `DragonHero` (sin boost de festejo). Temas: Mago =
violeta místico + dorado; Gimnasio = azul eléctrico + naranja (distinto de Fuego). Seeds
`seed-dragon-mago.sql` / `seed-dragon-gimnasio.sql` (tema + dragón `credit_cost 150` + regla FREE). ⚠️
Correr esos 2 seeds. Se ven en el próximo build.

**Lote de UX HECHO:** categorías fuera de Perfil → chip **"+ Nueva"** en el selector de objetivo/tarea
(→ `/categorias`). Onboarding con **Atrás** + **deslizar** (PanResponder); "Ver tutorial de nuevo" lo
abre **al instante** (pub/sub `mostrarOnboarding`). **Hoy vacío** con botones **+ Objetivo / + Tarea**.
Guía objetivo vs tarea en la IA + subtítulos en Objetivos/Tareas + nota "sin horario no va al calendario".
**Tareas en Mi semana** el día que vencen (tag 📌, "Vence HH:MM", tocables → info; NO son evento ni van a
Google; NO cuentan como "ocupado" para la IA). **Fechas con día de la semana** (`fechaLargaConDia`) y
selector de fecha tipo **calendario** en Android (`DateTimeField` date→calendar, time→spinner). Hoy
**refresca al enfocar** la pestaña (`useFocusEffect`). IA afinada: guardrail generoso + `temperature 0.2`
+ regla UNA VEZ (tarea, con hora_limite) vs RECURRENTE (objetivo). Objetivos con horario se pueden crear
**a mano** y sincronizan a Google igual que por IA (el form pide permiso de calendario al guardar).

Próximo (orden de la usuaria): ~~APK~~ → ~~Health Connect~~ → ~~objetivos predeterminados~~ →
~~Calendario~~ → ~~IA "Organizá mi semana" + horario (Fase 21.x)~~ → ~~Premium + dragones + celebraciones
(V4)~~ (todo hecho). **App feature-complete para el MVP + Premium.** Sigue para PUBLICAR:
(1) 🔴 **rotar la API key de Anthropic** (quedó expuesta en el chat — quick); (2) **APK preview nuevo**
(`EAS_NO_VCS=1 eas build --profile preview`) para usar la app sin Metro; (3) **cobro real** = integrar
**RevenueCat + Google Play Billing** (el gate ya está con toggle de prueba; falta SDK `react-native-purchases`
→ rebuild + productos en Play Console + probar en test interno); (4) **Track C — Publicación (Fase 22)**:
política de privacidad + declaración de apps de salud + data safety + **closed test 12 testers × 14 días**.
OPCIONALES: HC sueño/agua/ejercicio; modo "meta vs límite" para calorías. Ver [[premium-y-dragones]].

Fase 11 quedó completa salvo el **build** (diferido, ver memoria [[build-apk-diferido]]).
Hecho Fase 1: `esquema.sql` + `esquema-dragones.sql` aplicados; tipos en `lib/types.ts`;
capa de datos en `/lib/data` (`categorias`, `objetivos`+`objetivo_dia`, `registros`, `tareas`).
Hecho Fase 2: auth 100% Supabase (`lib/data/auth.ts`); `SessionProvider` + `useSession`
(`components/session-provider.tsx`); pantallas `app/(auth)/login.tsx` y `registro.tsx`;
guard con `Stack.Protected` en `app/_layout.tsx`; React Query enchufado (QueryClientProvider).
La **confirmación de email está DESACTIVADA** (decisión 2026-08-17): en móvil el link de confirmación
default de Supabase iba a `localhost` y rompía el registro de usuarios reales. Sin confirmación, al
registrarse `signUp` devuelve sesión y el guard entra directo (la pantalla de registro ya lo maneja).
Se apaga en Supabase → Authentication → Providers → Email → "Confirm email" OFF.

**Design system integrado**: tokens en `constants/theme.ts` (única fuente de color, sin hex
sueltos), componentes base en `components/` y `components/ui/` (`Card`, `ProgressBar`,
`SpeechBubble`, `IconBadge`, `Tag`, `DragonMascot`, `ProfileButton`). Las 3 pantallas
(`app/(tabs)/`) están con el diseño real pero **datos MOCK** — se cablean a datos reales en
sus fases (Objetivos F4, Hoy F6, Progreso F8). `app/perfil.tsx` (modal) ya tiene logout real.

**Arte de dragones**: `assets/dragons/<key>/dragon.png` + registro `constants/dragons.ts`
(mapea `dragon.asset_key` → imagen, con require() estáticos). `DragonMascot` acepta
`assetKey`. Arte fuente (alta resolución, referencias) en `art-source/` (no se empaqueta).
Cuando llegue el sistema de temas (V3), `constants/theme.ts` pasa a ser el tema "Original"
accedido vía `useTheme()`, y `DragonMascot` recibe el `asset_key` del dragón equipado.

**Fase 3 hecha:** CRUD de categorías en `app/categorias.tsx` (Perfil → Categorías).

**Fase 4 hecha:** pestaña Objetivos (`app/(tabs)/objetivos.tsx`) con lista real (React Query,
`listarObjetivosConDias`) + botón Nuevo/Editar. Formulario `app/objetivo/[id].tsx`
(id='nuevo' = crear): nombre, descripción, categoría (selector real), tipo BOOLEAN/NUMERIC
(+meta+unidad), frecuencia DAILY/SPECIFIC_DAYS(días→`objetivo_dia`)/WEEKLY_COUNT
(`frecuencia_cantidad`), hora_recordatorio, + eliminar. Resumen de frecuencia puro en
`logic/objetivos.ts`. Fechas (inicio/fin) usan el default de la DB (no expuestas aún).

**Fase 5 hecha:** sección Tareas real en la pestaña Objetivos (completar con checkbox,
editar, nueva). Formulario `app/tarea/[id].tsx` (título, descripción, categoría, prioridad
BAJA/MEDIA/ALTA, fecha_limite/hora_limite opcionales por texto, + eliminar). Resumen puro en
`logic/tareas.ts`. `completarTarea` setea `fecha_completada`.
**Fase 6 hecha (🔒):** RPCs `esperados_hoy` + `semanales_hoy` en `funciones-hoy.sql` (isodow
+ zona horaria). Capa `lib/data/hoy.ts`. Lógica pura `logic/hoy.ts` (`porcentajeDia`,
`creditoObjetivo`, `mensajeDragon`) y `logic/fecha.ts` (`hoyISO`, `horaActual`, `sumarDiasISO`,
TZ Buenos Aires). Pantalla Hoy real: hero con % del día + mensaje del dragón por reglas;
**Hoy** (booleanos, marcar → upsert `registro_objetivo` → recalcula %); **Recordá**
(numéricos con barra, aún sin sumar valor); **Esta semana** (WEEKLY_COUNT, toggle, no penaliza
el %); **Tareas próximas** (vencen hoy/mañana, completar).
**Fase 7 hecha:** interacción numérica en **Recordá**. `logic/hoy.ts` → `pasosNumericos(meta)`
(dos incrementos "lindos" 1/2/2,5/5×10ⁿ derivados de la meta; agua 2000 → +250/+500).
`lib/data/registros.ts` → `registrarValorNumerico(id, fecha, valor, meta)` (upsert `valor`,
marca `completado` si llegó a la meta; valor real se guarda aunque pase la meta). Pantalla Hoy:
botones +chico/+grande suman, "Ingresar" abre modal (setea total exacto, teclado numérico) con
opción **Omitir hoy** (`omitirObjetivo` → fila con `omitido`, queda fuera del % y se muestra
con "Deshacer"). El % del día se recalcula proporcional al invalidar `esperados-hoy`.

**Fase 8 hecha (🔒):** Progreso 100% desde `registro_objetivo`. RPCs en
`funciones-progreso.sql`: `progreso_por_dia(desde,hasta)` (crédito/esperados/pct por día),
`progreso_por_objetivo(desde,hasta)` (por objetivo, para agrupar por categoría) y
`detalle_dia(fecha)`. Todos usan el mismo crédito que Hoy (NUMERIC proporcional, BOOLEAN 0/1,
omitido fuera). Capa `lib/data/progreso.ts` (wrapper `rpc<T>` mientras no se regeneren tipos).
Lógica pura `logic/progreso.ts` (`resumenRango`=consistencia sum(credito)/sum(esperados),
`delta`, `semanaLD`, `agruparPorCategoria`, `nivelIntensidad`, `mensajeProgreso`) + helpers de
fecha (`inicioSemanaISO`, `diaSemanaISO`, `primer/ultimoDiaMesISO`, `sumarMesesISO`, `nombreMes`).
Pantalla Progreso real: resumen semanal (consistencia + delta vs semana anterior), barras L→D,
por categoría con desglose expandible por objetivo, calendario mensual con intensidad + navegación
+ modal de detalle del día. **Métrica principal = consistencia** (racha, secundaria/pendiente).
⚠️ Correr `funciones-progreso.sql` en Supabase antes de probar; después conviene regenerar tipos.

**Fase 9 hecha:** dragón con expresiones por estado. Arte por expresión en
`assets/dragons/original/` (`dragon.png`=busto neutral + `manana/animo/orgullo/festejo/enojado.png`
= cuerpo entero, PNG transparentes que subió la usuaria). Registro `constants/dragons.ts`
reestructurado a sets por expresión (`DRAGON_ART[asset_key][expresion]`, `dragonSource(key, expr)`).
Lógica pura `logic/dragon.ts`: `estadoDragon(percent, hora)` (festejo≥100, orgullo≥70, **enojado**
si ≥19h y <50%, manana si <12h y <30%, animo el resto) + `mensajeDragon(estado)`. `mensajeDragon`
viejo salió de `logic/hoy.ts`. `DragonMascot` acepta `expresion`. **Solo el hero de Hoy** usa la
expresión según el % del día, vía `components/DragonHero.tsx` (apila las 5 imágenes y muestra la
activa por opacidad → cambio instantáneo, sin recarga/parpadeo; `fadeDuration=0`). El hero lleva
`marginTop` para que el borde del ScrollView no recorte la cabeza (cuerpo entero, `top -46`), y la
barra de progreso `paddingRight` para no quedar tapada. Las 5 PNG se **redimensionaron a máx 700px**
(originales en `art-source/uploads/expresiones-originales/`) porque a 1024×1536 tardaban en decodificar.
**Objetivos y Progreso siguen con el busto neutral** (`DragonMascot`) en el mismo lugar. Tokens de color ya centralizados en `constants/theme.ts` (identidad
violeta+pastel). Falta (V3): temas por dragón equipado.

**Fase 10 hecha:** recordatorios locales con `expo-notifications` (~0.32, SDK 54). Lógica pura
`logic/recordatorios.ts` (`construirRecordatorios`: DAILY→diario, SPECIFIC_DAYS→semanal por día ISO,
tareas con fecha_limite→fecha puntual; WEEKLY_COUNT sin recordatorio). Puente `lib/notificaciones.ts`
(handler + canal Android, permisos, `sincronizarRecordatorios`=cancelar todo y reprogramar,
convierte isoDow→weekday expo 1=dom, saltea fechas pasadas, `notificacionDePrueba` en 5s).
Componente invisible `components/RecordatoriosSync.tsx` montado en el layout de tabs: reusa las
queryKeys ['objetivos']/['tareas'] → al invalidarse (crear/editar/completar), reprograma solo.
Perfil → "Probar recordatorio" dispara la prueba. Plugin `expo-notifications` en app.json (para dev
build). ⚠️ En Expo Go (SDK 53+) el soporte es limitado; garantizado con development build.

**Fase 11 (en curso — pulido, SIN build):** el build/APK queda **diferido** hasta que la usuaria
diga que la app está lista (ver memoria `build-apk-diferido`). Hecho del pulido:
- **Selectores nativos de fecha/hora** (`components/ui/DateTimeField.tsx`, rueda/spinner, abre en
  hoy/ahora) reemplazan el texto a mano en ambos formularios; helpers en `logic/fecha.ts`
  (`isoADate`/`dateAISO`/`horaADate`/`dateAHora`/`fechaLarga`). `KeyboardAvoidingView` en los forms.
- **Fechas inicio/fin** de objetivos editables en `app/objetivo/[id].tsx` (antes usaban el default).
- **Recordatorio WEEKLY_COUNT**: lun/mié/vie a su hora (`logic/recordatorios.ts`, no tiene día fijo).
- **Racha** en Progreso (`rachaActual` en `logic/progreso.ts`, días consecutivos 100%, secundaria).
- **Tareas en Progreso**: sección con completadas esta semana + pendientes (aparte de objetivos 🔒).
- **Estados vacíos/loading/error**: componente `components/ui/EstadoMensaje.tsx` (vacío con dragón /
  error con "Reintentar"); cableado en las 3 pestañas (esperados-hoy, objetivos, tareas, progreso-dias)
  con `isError`+`refetch`. Los "no hay nada" ahora invitan a la acción; los errores no dejan pantalla en blanco.
- **Onboarding**: `components/Onboarding.tsx` (Modal de 5 pasos con el dragón cambiando de expresión,
  bandera `onboarding_visto_v1` en AsyncStorage → una sola vez). Montado en el layout de tabs. Perfil →
  "Ver tutorial de nuevo" lo reactiva (`reiniciarOnboarding`).
Único pendiente de la Fase 11: el **build/APK**, diferido hasta que la usuaria diga que la app está lista.

# ANEXO — Dragones, temas, XP y créditos (recompensas)

## Decisión de diseño (definitiva)

Modelo de **TIENDA con créditos**, NO de desbloqueo automático. Cuatro sistemas
**separados pero relacionados**:

- **XP** = progreso acumulado. Se gana al cumplir. **Nunca se gasta ni se pierde.** Sirve para
  niveles, estadísticas y como *requisito* de algunos dragones.
- **Créditos** = moneda interna. Se ganan al cumplir y **se gastan** para comprar dragones.
- **Logros** = condiciones especiales. Pueden dar XP/créditos y **habilitar** (no regalar) dragones.
- **Dragones + Temas** = identidad visual comprable. Comprar un dragón cuesta créditos y equiparlo
  cambia el tema de toda la app.

## Reglas que NO se tocan 🔒

1. **Theme tokens desde el día uno.** Ningún componente hardcodea un color. Todo sale de
   `currentTheme` con nombres semánticos (`primaryColor`, `secondaryColor`, `accentColor`,
   `backgroundColor`, `surfaceColor`, `successColor`, `warningColor`, `textPrimary`, `textSecondary`).
   Cambiar de dragón = cambiar el tema activo y que la app se redibuje sola. **Sin rehacer pantallas.**
2. **Nunca guardar flags "aplanados"** tipo `dragon_medieval_unlocked` o `color_app = red` en `perfil`.
   Dragón, tema, XP y créditos son tablas separadas.
3. **Fuente de verdad = los logs:** `movimiento_xp` y `movimiento_credito`. Los totales en `perfil`
   (`xp_total`, `creditos`, `nivel`) son **caché** derivable de los logs.
4. **Otorgamiento SIEMPRE del lado del servidor.** XP, créditos, compras y logros se escriben con
   funciones **RPC `SECURITY DEFINER`** que validan `auth.uid()`. La RLS **bloquea inserts directos**
   del cliente en `movimiento_xp`, `movimiento_credito`, `usuario_dragon`, `usuario_logro` y
   `suscripcion`. (Si no, cualquiera se auto-regala créditos con la anon key.)
5. **Idempotencia.** Cada evento otorga XP/créditos una sola vez, vía `clave_idempotencia`
   (`ON CONFLICT DO NOTHING`). Marcar/desmarcar un objetivo NO genera XP infinito.
6. **No punitivo.** El XP no baja nunca; los créditos solo bajan al comprar. Las estadísticas sí
   reflejan incumplimientos, pero la experiencia acumulada permanece.
7. **Premium no regala dragones.** Habilita comprarlos si además cumplís el requisito y tenés
   créditos. Si Premium vence, `usuario_dragon` **permanece** (no perdés lo comprado); solo se
   impide equipar los premium mientras no seas Premium.
8. **Requisitos calculados desde el historial** (registros, movimientos), no guardados como fuente
   principal. Se pueden cachear por rendimiento, pero deben poder reconstruirse.

## Flujo al completar un objetivo/tarea

`registro_objetivo.completado = true` (o `tarea.completada = true`)
→ RPC `otorgar_recompensa` (XP + créditos, con clave de idempotencia)
→ recalcular `perfil.xp_total / creditos / nivel`
→ comprobar logros nuevos → (si aplica) otorgar sus XP/créditos
→ **no** se auto-entrega ningún dragón (eso es compra manual).

## Flujo de compra de dragón

Tocar "Comprar" → RPC `comprar_dragon(id)`:
¿ya lo tiene? → ¿cumple la regla (calculada del historial)? → ¿si es premium, tiene Premium activo?
→ ¿tiene créditos suficientes? → resta créditos (`movimiento_credito` −costo) → crea
`usuario_dragon` (con `credit_price_paid`) → celebración → ofrecer equipar.

## Pantalla "Mi Dragón"

Encabezado: nivel · XP · créditos. Colección en grupos: **Mi colección** (adquiridos) ·
**Disponibles** (puede comprar ya) · **Bloqueados** (falta nivel/logro) · **Premium 👑**.
Cada tarjeta muestra por qué sí/no puede conseguirlo (precio, requisito cumplido o no, premium).
El dragón equipado (`preferencia_usuario.id_dragon_seleccionado`) aparece en Hoy, Progreso, logros,
desbloqueos y tutorial — nunca hardcodear el dragón Original.

## Nombres de tablas (español, consistente con el esquema base)

`tema`=THEME · `dragon`=DRAGON · `dragon_regla_desbloqueo`=UNLOCK_RULE ·
`usuario_dragon`=USER_DRAGON · `movimiento_xp`=XP_TRANSACTION ·
`movimiento_credito`=CREDIT_TRANSACTION · `logro`=ACHIEVEMENT ·
`usuario_logro`=USER_ACHIEVEMENT · `preferencia_usuario`=USER_PREFERENCE · `suscripcion`=SUBSCRIPTION.

## MVP de este anexo (no construir todo de una)

- Sistema de **temas** funcionando de punta a punta (tokens + tema activo + redibujo).
- 1 dragón inicial (Original) equipado por defecto.
- Esqueleto de **XP + créditos**: RPC de otorgamiento con idempotencia + caché en perfil.
- 1 dragón comprable por créditos (para probar el flujo de compra).
- Pantalla **Mi Dragón** básica.
Después, agregar un dragón nuevo = asset + tema + `credit_cost` + regla, **sin tocar componentes**.

# ANEXO al CLAUDE.md — Nativo, Integraciones e IA (decisiones)

> Pegá esta sección en tu `CLAUDE.md`. Explica el *porqué* de cada decisión para no desviarse.
> El detalle largo con opciones está en `decisiones-arquitectura-v2.md`.

## Build nativo

- **Decisión:** app nativa con Expo. Se distribuye por Play Store (AAB) y, más adelante, App Store.
- **El development build es la llave** de cualquier módulo nativo (Health Connect, expo-calendar) y
  **mantiene Fast Refresh**. Seguir en Expo Go hasta que se necesite un módulo nativo.
- **No** compilar producción hasta ir a publicar. Preview (APK) = probar suelto; Production (AAB) = Play.

## Health Connect (solo Android)

- **Decisión:** leer datos de salud desde Health Connect, empezando por **pasos, solo lectura**.
- **Es una caja compartida en el dispositivo:** solo contiene lo que otras apps escriben (Samsung
  Health, Hevy, etc.). Tu app **lee** lo que haya; no "genera" datos de salud.
- Cada objetivo lleva `fuente_datos` (`MANUAL` / `HEALTH_CONNECT`). Si ninguna app escribe un tipo
  (p. ej. comidas), ese objetivo queda `MANUAL`.
- En Supabase guardar **solo el valor decidido** (ej. "6821/8000 pasos"), nunca el flujo crudo de salud.
- Al publicar: **declaración de apps de salud** en Play Console + **política de privacidad** obligatorias.
- iOS es otra integración (HealthKit), a futuro.

## Calendario

- **Decisión (MVP): `expo-calendar` (calendario del dispositivo), NO la API de Google Calendar.**
- **Porqué:** los scopes de Google Calendar son *sensibles* → obligan a verificación de OAuth de
  Google (consent screen, política, video, ~10 días) antes de publicar. `expo-calendar` no requiere
  nada de eso, y como el SO ya sincroniza los eventos de Google al calendario del teléfono, la app
  los ve igual.
- Límites: funciona **solo en el dispositivo** (no desde el servidor) y necesita permiso de calendario.
- Ir a la API de Google Calendar **solo** si algún día hace falta acceso desde el servidor o sin
  depender de la sincronización del dispositivo (y ahí se presupuesta la verificación).

## IA (chat que organiza)

- 🔒 **La IA PROPONE, el código EJECUTA.** La IA **nunca** escribe en la base. Flujo: la app junta
  contexto (objetivos/tareas de la semana + eventos + categorías) → Edge Function llama al modelo →
  devuelve una **propuesta en JSON** → la app la muestra → la usuaria confirma/edita → la app escribe
  vía `/lib/data`.
- 🔒 **La API key vive en la Edge Function de Supabase (secret), nunca en la app.**
- **Modelo:** Claude **Haiku 4.5** (barato y suficiente para esto).
- **Guardrails:** validar el JSON contra el schema antes de escribir; el modelo mapea lenguaje
  natural a los tipos reales (p. ej. "pilates 3×/semana" → `WEEKLY_COUNT`, `frecuencia_cantidad=3`,
  o `tarea` si es puntual); pasarle **las categorías existentes** para que **elija** (que no invente
  ids ni categorías); **contexto acotado** a la semana relevante; detrás de **Premium**; disparar con
  un **botón explícito** ("Organizá mi semana"), no en cada acción; usar prompt caching del system prompt.

## Costos / hosting

- **Edge Function:** gratis hasta 500.000 invocaciones/mes (una organización = 1 invocación).
- **Costo real de la IA:** la API de Claude, **por token, pago por uso** (aparte de Supabase); centavos.
- **Supabase Pro (US$25/mes):** solo al superar el free tier general. Recordar: los proyectos free se
  pausan tras 7 días sin actividad.

## Publicación

- **Gate de TIEMPO, no de código:** una cuenta de desarrollador personal nueva necesita un closed
  test con **12 testers durante 14 días continuos** antes de producción en Play (las cuentas de
  organización con DUNS están exentas pero tardan 2-4 semanas en verificarse). Arrancar el test
  temprano, apenas haya un build instalable.

  # Plan de trabajo — Nativo, Integraciones e IA (Bloque V2)

Se apoya en la app que ya funciona (Expo + Supabase). Va **después del MVP** y es
**independiente** del bloque de dragones: podés intercalarlos.

> Cómo usarlo con Claude Code: una fase por sesión, `CLAUDE.md` siempre actualizado,
> commit + `/clear` al terminar cada fase.

## La llave y las ramas

```
Fase 17 — DEVELOPMENT BUILD  (la llave de todo lo nativo)
        │
        ├── Track A ─ Health Connect ── Fase 18 (pasos) ── Fase 19 (agua/ejercicio, opcional)
        │
        ├── Track B ─ IA + Calendario ── Fase 20 (expo-calendar) ── Fase 21 (Edge Function + IA)
        │
        └── Track C ─ Publicación (en PARALELO, es gate de TIEMPO) ── Fase 22
```

Los tracks A y B no dependen entre sí: hacé el que quieras primero. El track C conviene
arrancarlo apenas tengas un build instalable, porque los 14 días de testing corren solos.

---

## Fase 17 — Development build (prerequisito de todo lo nativo)

- **Qué construir:** instalar `expo-dev-client`; configurar EAS (`eas.json` con perfil
  `development`); crear cuenta gratis de Expo; correr `eas build --profile development
  --platform android` (o build local con Android Studio); instalar el build en tu teléfono;
  arrancar con `npx expo start --dev-client`.
- **Listo cuando:** la app corre en tu cel desde el dev build **con recarga en vivo** (ya no
  desde Expo Go), lista para sumar módulos nativos.
- **Prompt:** *"Configurá un development build de Expo: instalá expo-dev-client, creá el `eas.json`
  con un perfil development para Android, y dejame los comandos para compilar (EAS y local) e
  instalarlo en mi teléfono. No toques features todavía."*

## Fase 18 — Health Connect: pasos (Track A)

- **Qué construir:** instalar `react-native-health-connect` + su config plugin; declarar permisos
  de lectura (empezar por `Steps`); pedir permisos en runtime; leer los pasos **agregados** de hoy;
  mapearlos al objetivo de pasos con `fuente_datos = HEALTH_CONNECT` y hacer upsert en
  `registro_objetivo`. Guardar en Supabase **solo el valor decidido** (ej. 6821/8000), no el flujo crudo.
- **Listo cuando:** los pasos de hoy aparecen solos en el objetivo de pasos, sin cargarlos a mano.
- **Prompt:** *"Integrá react-native-health-connect (solo Android). Pedí permiso de lectura de
  Steps, leé los pasos agregados de hoy en la zona horaria del usuario, y actualizá el
  registro_objetivo del objetivo de pasos (fuente_datos=HEALTH_CONNECT) por upsert. Manejá el caso
  de permiso denegado."*

## Fase 19 — Health Connect: agua / ejercicio / sueño (opcional, Track A)

- **Qué construir:** sumar tipos de lectura (Hydration, ExerciseSession, SleepSession) según lo que
  tus apps escriban a Health Connect; para el agua, opción de que **tu app escriba** a Health Connect
  para compartirla. Recordá: si una app de origen no soporta ese tipo (ej. comidas), ese objetivo
  queda en `MANUAL`.
- **Listo cuando:** los tipos disponibles se reflejan automáticamente; los que no, siguen manuales.

## Fase 20 — Calendario del dispositivo (Track B)

- **Qué construir:** instalar `expo-calendar`; pedir permiso de calendario; leer los eventos de la
  **semana actual** del calendario del teléfono (que ya incluye los de Google sincronizados por el
  SO); exponerlos en la app para mostrarlos y, después, alimentar a la IA. **No** usar la API de
  Google Calendar.
- **Listo cuando:** ves tus eventos reales de la semana dentro de la app.
- **Prompt:** *"Con expo-calendar, pedí permiso de calendario y leé los eventos de la semana actual
  del calendario del dispositivo. Exponelos en una función de la capa de datos para usarlos en la UI
  y más adelante en la IA. No uses la API de Google Calendar."*

## Fase 21 — Edge Function + IA ("Organizá mi semana") (Track B)

- **Qué construir:** crear la Edge Function `organizar-semana` en Supabase; guardar la
  `ANTHROPIC_API_KEY` como **secret** de Supabase (nunca en la app). La función recibe el contexto
  (objetivos/tareas de la semana + eventos del calendario + las categorías del usuario) y llama a
  **Claude Haiku 4.5** pidiendo una **propuesta en JSON** con los campos de tu schema. La app
  **muestra** la propuesta → la usuaria **confirma/edita** → la app **escribe** vía `/lib/data`.
- **Listo cuando:** escribís "pilates 3 veces por semana", la IA propone un objetivo `WEEKLY_COUNT`
  con `frecuencia_cantidad = 3`, lo confirmás, y aparece en tus objetivos.
- **Prompt:** *"Creá una Edge Function `organizar-semana` que reciba {objetivos, tareas, eventos,
  categorias}, llame a Claude Haiku 4.5 (key desde un secret de Supabase) y devuelva SOLO un JSON con
  objetivos/tareas propuestos usando mi schema y eligiendo de las categorías existentes. En la app:
  mostrar la propuesta, permitir editar/confirmar, y recién ahí escribir vía la capa de datos.
  Validar el JSON contra el schema antes de escribir."*

## Fase 22 — Publicación (Track C, arrancar temprano)

- **Qué construir:** redactar y publicar la **política de privacidad** (una URL); completar en Play
  Console la **declaración de apps de salud** y el formulario de **seguridad de datos**; generar un
  build **preview (APK)** para probar y luego el **AAB** de producción; configurar **internal
  testing**; abrir un **closed test con 12 testers durante 14 días continuos**; aplicar a producción.
  iOS queda para después (cuenta Apple + HealthKit).
- **Listo cuando:** el closed test está corriendo (o ya aplicaste a producción en Play).

---

## Qué cambia en el stack / schema

- **Nuevo:** Edge Functions (Deno) para la IA. `fuente_datos` ya está en el schema.
- Los eventos del calendario se leen **en vivo** (no hace falta tabla de caché en el MVP).
- La propuesta de la IA se guarda **solo tras confirmar**, como objetivos/tareas normales.

# Plan de arreglos y mejoras — Drakostone (post-lanzamiento)

Ordenado por: (1) bugs que molestan ya, (2) el motor de cumplimiento en un solo bloque,
(3) features agrupadas por subsistema, (4) lo grande/incierto al final.
Podés subir builds nuevos al canal de prueba cerrado sin reiniciar los 14 días.

> Marcadas con 🎯 las que necesitan una **mini decisión de diseño** antes de programar.

---

## Respuestas rápidas (tus dudas de la lista)

- **Ver día ±1 en Hoy:** no gasta más espacio; son registros que ya existen.
- **Guardar local / backup:** el espacio no es problema (tus datos son texto minúsculo). Lo valioso
  es *offline* y *exportar/backup* → feature grande, va al final.
- **Veces por semana vs "leer 2h/semana":** la primera cuenta ocurrencias y no penaliza el día; la
  segunda es una **meta numérica/tiempo acumulada en la semana** que hoy no existe → Fase 3.
- **Tiempo en objetivos:** sí, como tipo **DURATION** (minutos). Cronómetro + lectura semanal salen de ahí.
- **Notificaciones que tardan:** optimización de batería/Doze de Android retiene las locales; se
  arregla con notificaciones agendadas + exención de batería, o push desde el servidor.

---

## Fase 1 — Bugs y arreglos rápidos (próximo build) ✅ HECHA (sin build todavía)

Rápidos, de bajo riesgo, alto alivio. Ideal para un build corto ya mismo.
- ✅ **#1 Teclado tapa los campos en Registrarse** (bug bloqueante). Fix: `KeyboardAvoidingView`
  con `behavior="height"` en Android (estaba en `undefined`) + `keyboardDismissMode="interactive"`
  en `app/(auth)/registro.tsx` y `login.tsx`.
- ✅ **#1.5 Barra de navegación del sistema tapaba botones** (extra, no estaba en el plan). Con
  edge-to-edge (SDK 54) la app se dibuja bajo la barrita. Fix con safe-area insets: el tab bar
  (`app/(tabs)/_layout.tsx`) suma `insets.bottom` a `height`/`paddingBottom`; las pantallas
  modales/formulario pasaron a `edges={['top','bottom']}` (objetivo/tarea/info, perfil, premium,
  mi-dragon, agenda, categorias, OrganizarSemanaModal). Se autodetecta (`insets.bottom`=0 si no hay).
- ✅ **#2 Ícono por defecto inteligente** (agua 💧, pasos 👟, calorías 🍎). Helper puro
  `logic/iconos.ts` (`iconoSugerido`/`iconoObjetivo`). El emoji detectado LE GANA a la categoría
  (agua en "Salud" muestra 💧). Cableado en los 4 lugares que muestran el ícono (lista Objetivos +
  3 variantes de Hoy).
- ✅ **#3 Elegir ícono por objetivo.** Migración `agregar-icono-objetivo.sql` (columna `objetivo.icono`
  text nullable, NULL=auto — corrida; `icono` agregado a mano a `lib/types.ts`, conviene regenerar).
  Precedencia final: **elegido a mano › heurística › categoría › 🎯**. Selector COMPACTO en el form
  (`app/objetivo/[id].tsx`): botón con el ícono actual + "Cambiar ícono" que despliega una grilla
  curada (`EMOJIS_OBJETIVO`, incluye 🐴) con opción "Auto"; se cierra al elegir. Se guarda en el payload.
- **Prompt:** *"Arreglá que el teclado no tape los inputs en la pantalla de registro. Agregá un
  selector de ícono por objetivo (columna objetivo.icono nullable) con fallback al ícono de la
  categoría, y poné un ícono de agua por defecto al objetivo de agua."*

## Fase 2 — Motor de cumplimiento (UN bloque) 🔒 (EN CURSO)

Todo esto toca el mismo cálculo: hacerlo junto evita repintar el motor varias veces.
- ✅ **C — Tareas suman al % del día** si vencen ese día. `porcentajeDia(esperados, tareas)` (cada
  tarea = ítem Sí/No). RPC `progreso_por_dia`/`detalle_dia` incluyen las tareas del día
  (⚠️ correr `funciones-progreso.sql`); `progreso_por_objetivo` NO (es desglose por objetivo).
  Completar tarea invalida progreso. **Cambia la regla vieja "tareas aparte" (decisión de la usuaria).**
- ✅ **B — Racha con ≥85%** (`UMBRAL_RACHA=85` en `logic/progreso.ts`, `rachaActual(...,umbral)`).
- ✅ **Omitir objetivo + razón** 🎯: no afecta el % (fuera de numerador y denominador). Omitir se
  movió a la pantalla de **Info** (booleanos y numéricos), fuera del modal de "+ Botón"; "Deshacer"
  inline en Hoy. Omitir oculta el bloque en **Mi semana** y borra la ocurrencia en **Google Calendar**
  (deshacer recrea el evento) — `omitirYReflejar` en `lib/data/agenda.ts`. **Razón:** al tocar Omitir
  (en Info o Mi semana) aparece `components/RazonOmisionModal.tsx` (razón OPCIONAL, vacío = sin razón);
  se guarda en `registro_objetivo.razon_omision` (⚠️ migración `agregar-razon-omision.sql` — incluye
  `drop function detalle_dia(date)` porque cambió las columnas de retorno) y se muestra en cursiva en
  el detalle del día del calendario mensual (Progreso). Al deshacer se limpia la razón.
- ✅ **A — Ver día anterior/siguiente en Hoy** (navegador ‹ fecha ›, hasta 7 días atrás, "Volver a hoy").
  RPC `esperados_hoy`/`semanales_hoy` con `p_fecha` (⚠️ correr `funciones-hoy.sql`); marcar escribe en
  el día elegido; tareas y auto-sync HC solo en "hoy".
- ✅ **E — Eliminar objetivo: solo este día o todos.** Decisión de la usuaria: "solo este día"
  **reusa la omisión** (mismo efecto: sale del %, de Mi semana y de Google) — NO se hizo un mecanismo
  de excepción aparte. Menús: en **Mi semana** al tocar un objetivo (🐉) → Alert "Ver información /
  Quitar de este día / Borrar el objetivo completo"; en **Info del objetivo** → botón rojo
  "Borrar el objetivo completo" (además del "Omitir" que ya es el quitar-este-día). Sin migración.
- **Veces por semana:** confirmar que **no penaliza** el % del día (aparece como oportunidad semanal).

**Estado Fase 2: ✅ COMPLETA** (A, B, C, E + omitir con razón). Migraciones corridas: `funciones-hoy.sql`
(p_fecha), `funciones-progreso.sql` (tareas en el %), `agregar-razon-omision.sql` (razon_omision + drop
detalle_dia). Pendiente menor: confirmar que WEEKLY_COUNT no penaliza (ya es así por diseño).
- **Prompt:** *"Trabajemos el motor de cumplimiento: que las tareas del día sumen al %, que la racha
  cuente días ≥85% (umbral configurable), que omitir un objetivo guarde una razón y lo excluya del %
  mostrándolo en el calendario mensual, que Hoy permita ver el día anterior y el siguiente, y que se
  pueda borrar un objetivo solo para un día o del todo. Todo calculado desde registro_objetivo."*

## Fase 3 — Objetivos con tiempo (duración) ✅ HECHA (falta ver la notif en el rebuild)

- ✅ **Tipo DURATION** (minutos). Migración `agregar-tipo-duracion.sql` (`alter type tipo_objetivo add
  value 'DURATION'` — correr SOLA primero). Enum en `lib/types.ts`; `logic/hoy.ts` (`esAcumulable`,
  `creditoObjetivo` proporcional para NUMERIC+DURATION, `formatearMinutos`, `pasosDuracion`). Las RPC
  de progreso dan crédito proporcional a DURATION (`funciones-progreso.sql` re-corrida). Form: 3er tipo
  "Duración" (meta en minutos, unidad fija `min`). En Hoy se muestra como tiempo (`10 min / 30 min`).
- ✅ **Cronómetro** (`hooks/useCronometro.ts` + `components/cronometro-provider.tsx` montado en raíz =
  timer ÚNICO compartido). Sobrevive cerrar la app (persiste inicio en AsyncStorage `cronometro_v1`).
  Al detener suma los minutos: diario `sumarValorNumerico` (marca completado/recompensa), semanal
  `sumarValorHoy` (sin recompensa por día). **Pantalla de foco** `app/cronometro/[id].tsx`: círculo
  que se LLENA hacia la meta (JS puro, sin svg) + tiempo grande + Iniciar/Detener. En Hoy la barra
  avanza EN VIVO. Se entra por el botón "⏱ Cronómetro" (en la misma línea que ±minutos).
- ✅ **Meta semanal acumulada** ("leer 30 min/semana"): WEEKLY_COUNT + tipo NUMERIC/DURATION usa
  `meta_valor` (valor semanal) en vez de `frecuencia_cantidad` (veces, solo BOOLEAN). RPC
  `semanales_hoy` reescrita (`agregar-meta-semanal.sql`): devuelve `tipo`/`unidad` y `meta`/`hechos`
  numeric (BOOLEAN=veces·count / NUMERIC-DURATION=valor·sum de la semana). Se carga en "Esta semana"
  (barra + cronómetro + botones ±). ⚠️ `arreglar-chk-weekly-count.sql`: la constraint exigía
  `frecuencia_cantidad`; ahora acepta `meta_valor` también.
- ✅ **Recordá separado** por frecuencia: "Recordá hoy" (SPECIFIC_DAYS, arriba) + "Recordá todos los
  días" (DAILY). `renderRecorda` extraído como función.
- ⏳ **Notificación en vivo del cronómetro** (`lib/cronometro-notif.ts` + `@notifee/react-native@9.1.8`):
  notificación fija con cronómetro NATIVO (`showChronometer`+`timestamp`, se actualiza solo con la app
  cerrada). BEST-EFFORT con lazy require + try/catch → el dev-client actual NO se rompe (bundle
  verificado), pero la notif **se ve recién en el rebuild final** (módulo nativo). Ícono chico puede
  salir cuadrado blanco (afinar en rebuild). ⚠️ **Requiere rebuild** cuando se haga el próximo build.
- **Migraciones Fase 3 (en orden):** `agregar-tipo-duracion.sql` (sola) → `funciones-progreso.sql` →
  `agregar-meta-semanal.sql` → `arreglar-chk-weekly-count.sql`. Todas corridas por la usuaria.

## Extras post-Fase 3 (hechos, sin rebuild salvo donde se aclara)

- **Cronómetro = feature PREMIUM.** El botón "⏱ Cronómetro" (Recordá + Esta semana) sin premium va al
  paywall (`abrirCronometro` chequea `usePremium`); los ±minutos manuales siguen gratis. **Pantalla
  nueva `app/cronometros.tsx`** (premium): lista todos los objetivos de duración (del día + semanales)
  con "X min / meta" + botón "Activar" → pantalla del círculo. Card "⏱ Cronómetros" en Hoy (aparece si
  hay objetivos de duración; candado 👑 si no es premium) → `/cronometros` o `/premium`.
- **Congeladores de racha (automáticos, tipo Duolingo) + dragón PHOENIX 🔥.** Migración
  `agregar-congeladores.sql` (corrida): `perfil.congeladores`, tabla `racha_congelada`, RPC
  `aplicar_congeladores()` (al abrir la app tapa gap(s) que rompen una racha si alcanzan los
  congeladores para TODOS, marca los días protegidos), `evaluar_logros` actualizado (+2 congeladores al
  desbloquear "Imparable" racha 7 + regalo de dragón que respeta `target_value`), seed del Phoenix
  (regalo del logro de racha 7, `assets/dragons/phoenix/`, `dragon_phoenix` en `constants/dragons.ts`).
  `rachaActual` saltea los días congelados (neutrales). Hook `useRevisarCongeladores` (avisa "🧊 Racha
  protegida"). Progreso muestra 🧊 N. **Todos arrancan con 1 congelador** (`congeladores-default-1.sql`).
- **Ciclo de vida de tareas.** Migración `agregar-oculta-tarea.sql` (`tarea.oculta`). `logic/tareas.ts`
  → `tareaOculta` (auto-oculta a los 7 días: completadas desde `fecha_completada`, vencidas sin hacer
  desde `fecha_limite`; + flag `oculta`). Objetivos y Hoy filtran las ocultas; **las stats NO** (una
  vencida oculta sigue como "no hecha" en el % de su día 🔒). Info de tarea (`app/tarea/info/[id].tsx`):
  **Reprogramar** (nueva fecha → `reprogramarTarea`) y **Eliminar** (`ocultarTarea` si venció = mantiene
  el registro / `eliminarTarea` de verdad si es futura o de hoy sin vencer). Ver [[tareas-lifecycle]] y
  [[optimizacion-rollup]] (purga futura).

## Fase 4 — Confiabilidad (salud + notificaciones) — parcialmente hecha (sin rebuild)

- ✅ **4.1a — Health Connect automático:** la tarjeta HC dice "🔗 Health Connect" y MANTIENE el botón
  "Actualizar" (manual), pero ADEMÁS sincroniza solo (decisión de la usuaria: los dos).
- ✅ **4.1b — Sync al volver a la app:** `autoSyncHC` (silencioso) se dispara al abrir/cambiar de día
  Y con `AppState 'active'` (primer plano) en `app/(tabs)/index.tsx`.
- ✅ **4.2a — Exención de batería:** `abrirAjustesBateria()` en `lib/notificaciones.ts`
  (`Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')`, fallback openSettings);
  botón en Perfil "Recordatorios llegan tarde" (con Alert explicativo). Es el factor #1 de puntualidad.
- ✅ **Canal de notificaciones en importancia ALTA** (antes DEFAULT). Aplica del todo en instalación
  nueva (Android congela la importancia de un canal ya creado) → se ve pleno tras el rebuild.
- ⏳ **DIFERIDO 4.1c — Sync de HC en segundo plano (app cerrada):** se hace JUNTO CON LOS WIDGETS
  (Fase 7). Ahora aporta poco: solo se ven los datos al abrir la app, y 4.1b ya sincroniza ahí; el
  background solo rinde cuando algo muestra los datos con la app cerrada (widget). Android además no
  garantiza intervalos (Doze) y HC restringe la lectura en background. [[fase4-pendientes-nativos]]
- ⏳ **DIFERIDO 4.2b — Alarmas exactas (`SCHEDULE_EXACT_ALARM`):** permiso RESTRINGIDO por Google Play
  (riesgo en la revisión) y expo-notifications no lo expone limpio (quizás ni cambie nada). Lo Play-safe
  (canal alto + batería) ya está hecho. **No olvidar** revisarlo si los recordatorios siguen llegando
  tarde tras publicar. [[fase4-pendientes-nativos]]
- **Push desde el servidor (4.2c):** descartado por ahora (decisión de la usuaria) — con batería +
  canal alto suele alcanzar.
- **Prompt:** *"Hacé que los pasos y calorías de Health Connect se actualicen solos al abrir la app y
  cada cierto tiempo. Revisá el sistema de notificaciones para que las recordatorios lleguen aunque la
  app esté cerrada (batería/Doze), usando notificaciones locales agendadas y exención de optimización."*

## Fase 5 — Solapamientos + progreso ✅ HECHA (sin schema nuevo salvo la retención)

- ✅ **Aviso de solapamiento al crear a mano** (antes solo la IA). `logic/ia.ts` → `detalleConflicto`
  (devuelve el bloque que se pisa con fecha+rango); en el form (`app/objetivo/[id].tsx`) un ⚠️ live
  "Se superpone con X — viernes de 16 a 18. Podés cambiar la hora o guardar igual" (no bloquea).
  Reusa `compromisosDeContexto(14, excluirId)` (excluye el objetivo que se edita para no chocar consigo).
- ✅ **Gráficos en Progreso:** (a) **Tendencia mensual** (`tendenciaMensual` en `logic/progreso.ts`, barra
  por mes); (b) **Grillas anuales POR HÁBITO** (`GridDePuntos`, cuadritos estilo GitHub que se achican para
  entrar enteros en el ancho; selector desplegable de objetivos, se recuerda en AsyncStorage `grillas_v1`;
  `registrosEnRango` agrupa por objetivo). "Por categoría" quedó semanal (título "· esta semana").
- ✅ **Retención = feature Premium.** Ventana de historial: **premium = año calendario** (desde el 1 de
  enero); **no-premium = últimos 3 meses**. Grillas anuales **solo premium** (candado 👑 → paywall).
  Migración `purga-datos-viejos.sql` (⚠️ correr + activar `pg_cron` en el dashboard, es GRATIS):
  `purgar_datos_viejos()` corre a las 03:30 y borra `registro_objetivo`+tareas de +3 meses (no-premium) /
  +1 año (premium); NO toca XP/monedas/logros/dragones (🔒). Ver [[optimizacion-rollup]].
  **Navegador de meses (calendario de Progreso) gateado:** sin Premium el botón "mes anterior" solo
  retrocede hasta 3 meses atrás (coherente con la purga); al querer ir al 4º mes, el chevron es un
  **candado** y muestra Alert → `/premium` (`irMesAtras`/`bloqueaMesAtras` en `app/(tabs)/progreso.tsx`).

## Fase 6 — Dragones + acceso a la IA ✅ HECHA (mic se ve en el rebuild)

- ✅ **Acceso directo a la IA:** botón "✨ Organizá tu semana con la IA" en Objetivos (debajo de "Mi
  semana") → abre `OrganizarSemanaModal` directo (premium; si no, paywall).
- ✅ **Entrada por audio (mic nativo) — HECHA de verdad 2026-09-04.** ⚠️ La versión vieja de este bullet
  (`@react-native-voice/voice`) **nunca existió en el código**. Reimplementada con
  **`expo-speech-recognition@57`** + `lib/voz.ts` (lazy require + try/catch; `vozDisponible()` da false
  sin el módulo → el botón no se muestra en el dev-client). **Micrófono dentro del TextInput** del modal
  de la IA (dicta on-device y AGREGA al texto). Permisos/queries vía plugin en `app.json`. **Se ve recién
  en el rebuild** (módulo nativo). Detalle completo en la lista de pedidos, ítem 1. Ver [[voz-ia]].
- ✅ **Dragón TORMENTA ⛈️** (`assets/dragons/tormenta/`, `dragon_tormenta` en `constants/dragons.ts`).
  Seed `seed-dragon-tormenta.sql` (corrido): tema OSCURO tipo tormenta + regla **NIVEL 10** (gratis al
  llegar, credit_cost 0 → aparece en "Disponibles" al nivel 10, se reclama por 0). No requirió código
  (comprar_dragon ya valida NIVEL). Antes se hicieron Phoenix (racha 7) e Hielo (semana perfecta).

## Fase 7 — Grandes / a evaluar (más adelante)

- **Widgets** de pantalla de inicio. **V1 (solo lectura) SCAFFOLD HECHO — se ve recién en el rebuild.**
  `react-native-android-widget@0.22.1` (plugin en `app.json`). **DOS widgets:** **"Hoy"** 3×2 (label
  "Drakostone — Hoy") muestra la **LISTA** de objetivos + tareas de hoy (✓/○ + nombre, SIN %); y
  **"Porcentaje"** 2×2 (label "Drakostone — Progreso de hoy") muestra SOLO el **% del día** (número
  grande + barra de progreso, verde si ≥85%). Ambos: tocar abre la app. Cómo andan: la app guarda un
  **snapshot** liviano `{fecha,percent,items}` en AsyncStorage (`widget_hoy_v1`) cada vez que recalcula
  Hoy (`guardarSnapshotWidget` en `app/(tabs)/index.tsx`, solo cuando se ve HOY, con firma para no
  reescribir de más) y repinta LOS DOS widgets; corren HEADLESS con la app cerrada y leen ese snapshot
  (no tienen sesión de Supabase). Archivos: `lib/widget.tsx` (snapshot + guardar/leer + `requestWidgetUpdate`
  de ambos), `components/widget/HoyWidget.tsx` y `components/widget/PorcentajeWidget.tsx` (caras:
  FlexWidget/TextWidget, paleta fija violeta+verde, no leen el tema del dragón), `widget-task-handler.tsx`
  (handler headless, rutea por `widgetInfo.widgetName`), `index.js` (nuevo entry: `main` en package.json
  pasó de `expo-router/entry` a `index.js`; registra el task handler). 🔒 **Todo el paquete nativo se
  toca SOLO con lazy require + try/catch** (`react-native-android-widget` hace `TurboModuleRegistry.getEnforcing`
  al importar → rompería el dev-client si se importa estático): las caras y el paquete NUNCA se importan
  en el grafo eager; el dev-client actual no se rompe (bundle verificado). ⚠️ **Requiere el rebuild**
  para verse. Falta a futuro: marcar desde el widget (interacción).
  - **Bug widgets TRANSPARENTES (reportado 2026-09-04): ocupan el lugar pero se ven vacíos, incluso
    abriendo la app.** Diagnóstico: la librería dibuja el widget como IMAGEN (bitmap) y el marco vacío
    (rn_widget = 2 ImageViews transparentes) queda si la imagen no se generó. Causa más probable: raíz
    con `height/width: 'match_parent'` que en varios contextos de render queda en **tamaño 0 →
    transparente**. **Fix aplicado (a validar en el rebuild):** pasar el TAMAÑO real (`widgetInfo.width/
    height`, dp) a las caras: `HoyWidget`/`PorcentajeWidget` ahora reciben `width?/height?` y los usan en
    la raíz (fallback a match_parent). El `widget-task-handler` los toma de `props.widgetInfo` (app
    cerrada); `guardarSnapshotWidget` (foreground) los busca con `getWidgetInfo(widgetName)` (1ra
    instancia). Compila; NO verificable sin build → se prueba en el rebuild final. Si sigue transparente,
    el siguiente sospechoso es el handler headless no corriendo (index.js: `expo-router/entry` podría
    tirar en headless antes de `registerWidgetTaskHandler`).
  - **PROBADO EN BUILD (preview, 2026-09-04): SIGUE TRANSPARENTE, ni un poco.** logcat on-device
    (USB): el **worker de WorkManager `RNWidgetBackgroundTaskWorker` NUNCA se ejecuta** (aparecen los
    workers de otras apps, el nuestro no), ni al agregar el widget ni al abrir la app. → el proceso que
    dibuja el bitmap no arranca. Sospecha fuerte: **minificación/R8 del build de producción** saca algo
    que el widget necesita (o el receiver del manifiesto no enqueua el worker). DIFERIDO post-launch:
    debuggear con **dev build** (ahí SÍ se ven los logs de JS y se itera sin gastar builds de prod). En
    producción NO se ven los `console.log` de JS (por eso el logcat no mostró errores de JS).
  - **Decisión de la usuaria (2026-09-05):** NO se saca el código del widget, pero se **quitó del
    onboarding** el paso "6. Widgets" (`components/Onboarding.tsx`) para no promocionar algo que no anda
    todavía. El cierre "¡Vamos a empezar! 🎉" se movió al paso 5 (Progreso).
- **Offline ✅ HECHO (Nivel 2: ver + marcar sin internet).** 100% JS, sin módulos nativos nuevos.
  - **Ver offline (Parte 1):** cache de React Query persistido en AsyncStorage con
    `@tanstack/react-query-persist-client` + `@tanstack/query-async-storage-persister`. En
    `app/_layout.tsx`: `PersistQueryClientProvider` (persister key `DRAKOSTONE_QUERY_CACHE`,
    `gcTime` 7 días, `staleTime` 30s), y `queryClient.clear()` al cambiar de usuario/logout
    (para no mostrar datos ajenos). React Query mantiene los datos si un refetch falla → offline
    se ven; el cartel de error solo sale si NUNCA se cargó.
  - **Marcar offline (Parte 2):** bandeja de salida (outbox) en `lib/data/pendientes.ts`
    (AsyncStorage `DRAKOSTONE_PENDIENTES_V1`). Guarda el ESTADO FINAL por `(objetivo, fecha)` /
    tarea (no cada toque) → reenviar = upsert idempotente. Recompensas idempotentes por `clave`
    → reenviar no duplica; el XP se acredita al sincronizar (server-side). Wrappers `guardarMarcar`/
    `guardarNumerico`/`guardarOmitir`/`guardarSemanalDelta`/`guardarTarea` (intentan online; si
    `esErrorDeRed`, encolan y devuelven 'encolado'). `sincronizarPendientes()` reenvía (corta si hay
    red caída, descarta ítems con error real para no trabar la cola). `contarPendientes()` para el aviso.
  - **UI:** mutaciones de Hoy (`app/(tabs)/index.tsx`), completar tarea de Objetivos
    (`app/(tabs)/objetivos.tsx`) y omitir de info-objetivo (`app/objetivo/info/[id].tsx`) ahora son
    OPTIMISTAS (`onMutate` parcha el cache → ✓/% al instante; `onError` revierte con snapshot solo si
    es error REAL; offline se conserva). Aviso "Tenés N cambios sin guardar" en Hoy (query `['pendientes']`).
    Componente `components/SyncPendientes.tsx` (montado en tabs) reenvía al arrancar y al volver del
    segundo plano (`AppState 'active'`) + cada guardado online exitoso empuja la cola; sin NetInfo.
  - **NO offline (por diseño):** crear/editar objetivos/tareas/categorías, reprogramar/eliminar tareas,
    commit del cronómetro (premium) → necesitan internet. Ver [[offline]].
- **Backup/exportar:** existe (Perfil → exportar/restaurar .json, `lib/data/exportar.ts` + `lib/backup.ts`).
  🐛 **Bug de restaurar arreglado 2026-09-04:** el export trae cada objetivo con la lista hija
  `objetivo_dia` pegada (JOIN); `restaurarDatos` solo sacaba `dias`/`horariosDia` pero NO `objetivo_dia`
  → el upsert a `objetivo` fallaba ("columna inexistente") = "no se pudo restaurar". Fix: destructurar y
  descartar también `objetivo_dia`. Se ve en el próximo build.
- **Editar eventos de Google Calendar desde la app (cambiar horarios) + color por evento** 🎯:
  **Decisión de la usuaria (tomada):** color REAL en Google (vía API de Google Calendar, asume la
  verificación OAuth) + editar horario **solo de los objetivos 🐉 propios**. Verificado: `expo-calendar`
  puede `updateEventAsync` (cambiar horario, sin API de Google) pero **NO** expone color por evento
  (solo por calendario) → el color real exige la **API de Google Calendar** (`colorId` 1..11). Se hace
  en 2 fases:
  - **Fase A ✅ HECHA (sin Google API):** color por objetivo en NUESTRA base usando el `colorId` de
    Google (1..11), para que mapee directo en la Fase B. Migración `agregar-color-objetivo.sql`
    (columna `objetivo.color` text, check 1..11, NULL=default — ⚠️ correr; `color` agregado a mano a
    `lib/types.ts`, conviene regenerar). Paleta pura `logic/coloresCalendario.ts` (`COLORES_CALENDARIO`
    11 colores id+nombre+hex, `hexDeColor`/`nombreDeColor`). Selector de color en el form
    (`app/objetivo/[id].tsx`, dentro de la sección de horario — el color es del evento; "Auto" =
    default; se guarda `color: conHorario ? color : null`). **Mi semana** pinta el objetivo con su
    color (`itemsAppEnRango` usa `hexDeColor(o.color, COLOR_DRAGON)`). Pendiente chico opcional:
    mostrar el color en **Hoy** (requiere tocar la RPC `esperados_hoy`, se dejó para no migrar RPC).
  - **Fase B ✅ HECHA (staged, se prueba en el rebuild final):** setup GCP hecho (proyecto `drakostone`,
    Calendar API, consent screen scope `calendar.events`, 3 Client ID → `app.json → extra.googleCalendar`:
    `androidClientIdEas`/`androidClientIdPlay`/`webClientId`; DOS Android porque la app queda firmada
    distinto —clave EAS al instalar directo, clave de Google al bajar de Play). Módulo `lib/google-calendar.ts`
    (`expo-auth-session ~7.0.11` + `expo-crypto ~15.0.9`): OAuth flujo "app instalada"+PKCE (sin secret en
    el bundle), tokens en AsyncStorage con refresh (`access_type=offline`), REST v3 sobre `primary` con
    `colorId` (`crearEventoGoogle`/`actualizarEventoGoogle`/`borrarEventoGoogle`/`borrarOcurrenciaGoogle`).
    🔒 Todo el nativo por **lazy require + try/catch** (expo-crypto no está en el dev-client actual → se ve
    post-rebuild; el bundle no se rompe, verificado). **Ruteo transparente** en `lib/data/agenda.ts`:
    `espejarEnCalendario` usa Google si `googleConectado()` (ids prefijados `g:`, con el `colorId` de Fase A),
    si no el device calendar como antes; `borrarEspejo`/omitir-ocurrencia rutean por el prefijo. La
    experiencia es IDÉNTICA (los objetivos propios se dibujan desde la base, no del calendario). UI: fila
    **Google Calendar** en Perfil→Permisos (Conectar/Desconectar, solo si `googleConfigurado()`); "Mi semana"
    ganó **"Editar (horario, color…)"** que salta al form (editar horario ya re-espeja a Google). ⚠️ Al
    publicar: poner **`USAR_CLIENTE_PLAY=true`** en `lib/google-calendar.ts` + sumar la SHA-1 de Play App
    Signing al cliente OAuth. Checklist GCP en `configurar-google-calendar-api.md`. Ver [[editar-google-calendar]].

---

## Orden sugerido de builds

1. **Build A:** Fase 1 (rápido, apenas esté).
2. **Build B:** Fase 2 (el motor — el más importante de hacer bien).
3. Después: Fases 3 → 4 → 5 → 6, una por build.
4. Fase 7 cuando el resto esté firme.

---

## Nuevos pedidos (a organizar/programar) — anotados 2026-09-04

Pendientes NUEVOS de la usuaria (NO empezados). 🎯 = tiene una pregunta abierta que definir antes.

1. **Audio → IA (micrófono). ✅ HECHO (rearmado desde cero).** HALLAZGO: la función de voz **nunca
   estuvo en el código** (no existían `lib/voz.ts` ni el paquete; las notas viejas de "hecho con
   `@react-native-voice/voice`" eran falsas/se perdieron). Por eso nunca apareció. Rearmada con
   **`expo-speech-recognition@3.1.3`** (⚠️ NO la 56/57: esas son para SDK 56 y ROMPEN el build de Gradle
   en SDK 54 — pasó en el 1er intento de build; la 3.1.x es la de SDK 54, fijada en `expo.install.exclude`).
   `lib/voz.ts` (puente ÚNICO, 🔒 lazy require + try/catch → no rompe el dev-client; `vozDisponible()`
   da false sin el módulo): `vozDisponible`/`pedirPermisoVoz`/`iniciarDictado({onParcial,onFinal,onFin,
   onError})`/`detenerDictado` (on-device, `lang:'es-AR'`, interimResults). UI: botón de **micrófono
   dentro del `TextInput`** de la IA (`OrganizarSemanaModal`, esquina inferior derecha; `mic-outline`→
   `mic` violeta/relleno al escuchar + texto "🎙️ Escuchando…"); lo dictado se AGREGA a lo escrito; se
   corta al cerrar el modal o desmontar. `app.json`: plugin configurado (mensajes de permiso ES +
   `androidSpeechServicePackages: com.google.android.googlequicksearchbox`). **Módulo nativo → se ve en
   el rebuild.** Ver [[voz-ia]].

2. **Grilla anual (Progreso) = AÑO CALENDARIO. ✅ HECHO.** `construirGrid` en `app/(tabs)/progreso.tsx`
   ahora arma la grilla del **1/ene → 31/dic del año en curso** (antes iba de `inicioVentana` a `hoy`).
   Todo el año de una (columnas = semanas, se achican para entrar en el ancho). Cada cuadrito = día real;
   los días fuera del año (relleno 1ª/última semana) = transparentes; los **futuros = vacíos tenues**
   (`colors.track + '55'`, distinto del gris pleno de un día pasado sin cumplir). Tipo `CeldaGrid` con
   flag `futuro`; `GridDePuntos` lo pinta. Sigue siendo Premium (los datos ya venían del año, inicioVentana
   premium = 1/ene).

3. **Logros: textos + recompensa con dragón + reglas. ✅ HECHO.** Migración **`arreglar-logros.sql`**
   (correr 1 vez, DESPUÉS de `funciones-logros.sql`):
   - La racha de los logros ahora es **≥85%** (antes exigía 100% en el SQL, incoherente con la racha
     visible/el fueguito). Textos corregidos: "En racha" = 3 días ≥85%, "Imparable" = 7 días ≥85%.
   - **BUG arreglado:** el dragón se regalaba por `rule_type` sin mirar `target_value` (→ "En racha" de
     3 días regalaba el Fénix). Ahora `evaluar_logros` y `dragon_de_logro` matchean rule_type **Y**
     target_value → el **Fénix 🔥 lo da SOLO "Imparable" (7 días)**.
   - **"Semana perfecta" desactivado** (`activo=false` por rule_type SEMANA_PERFECTA).
   - **Hielo ❄️ pasa a NIVEL 15** (antes SEMANA_PERFECTA; decisión de la usuaria) — `credit_cost 0`, se
     reclama gratis al nivel 15, como Tormenta. Seed `seed-dragon-hielo.sql` actualizado también.
   - Cliente: `listarLogros` trae `dragon_nombre` (matchea regla→dragón); Mi Dragón (`LogroCard`) muestra
     **"· Dragón <nombre> 🐉"** en la recompensa cuando el logro entrega uno.
   ⚠️ `test-desbloquear-hielo.sql` quedó obsoleto (Hielo ya no es por logro).

4. **Bug: "tareas pendientes" en Progreso cuenta de más. ✅ HECHO.** Muestra 4 pendientes teniendo <4
   tareas (2 hechas). Causa: `app/(tabs)/progreso.tsx` contaba `tareasPendientes = tareas.filter(!completada)`
   SIN filtrar las ocultas → sumaba las vencidas auto-ocultas (+7 días) y las `oculta`. Fix: agregar
   `&& !tareaOculta(t, hoy)` (importado de `logic/tareas`). El % de cada día sigue contando la vencida como
   "no hecha" (🔒 stats intactas); solo se corrige el CONTADOR de "pendientes". Compila; se ve en el rebuild.

5. **Comparación "vs semana anterior" injusta. ✅ HECHO.** Antes comparaba esta semana PARCIAL vs la
   anterior COMPLETA → un lunes siempre daba "peor". Fix en `app/(tabs)/progreso.tsx`: `estaSemana` =
   inicioSemana..HOY; `semanaAnterior` = inicioSemanaAnterior..(mismo día de la semana pasada, vía
   `sumarDiasISO(inicioSemanaAnterior, diaSemanaISO(hoy)-1)`). Se muestra SIEMPRE (decisión de la
   usuaria), en el mismo lugar (el chip verde/rojo ya existía).
   **+ Carrusel de insights (NUEVO, pedido de la usuaria):** debajo del resumen semanal, tarjetas que se
   mueven solas (~4,5s, deslizables, con puntitos) con datos PERSONALIZADOS del usuario. `components/
   InsightsCarrusel.tsx` (auto-avance con pausa al deslizar; tema del dragón). Lógica pura en
   `logic/progreso.ts`: `mejorDiaSemana` (mira TODAS las semanas de la ventana), `objetivoDestacado`
   (mejor/peor con mín. ocurrencias), `construirInsights` (arma tarjetas: para-prestar-atención /
   mejorando-o-bajando el mes / racha / lo-que-mejor-hacés / mejor-día — **ordenadas por `peso`
   (relevancia) → el orden cambia por usuario**, y SOLO si hay datos suficientes → usuario nuevo ve el
   carrusel vacío = no aparece). Ventana = **mes en Gratis / año en Premium** (queries `insights-dias`/
   `insights-objs` sobre `inicioVentana..hoy`, SIN bloqueo premium en la DATA).
   **El carrusel es PREMIUM (decisión de la usuaria):** `InsightsCarrusel` recibe `esPremium` + `onUpgrade`.
   Premium = ve TODAS, se deslizan y se auto-mueven. Gratis = ve SOLO la 1ª estadística; la 2ª "página" es
   una tarjeta con **candado** (violeta, contenido tapado) → al tocarla abre `/premium`; no accede al resto.
   Ver [[insights-progreso]].

6. **Comentarios/reseñas de testers ✅ HECHO** (falta correr `agregar-comentarios.sql` + rebuild).
   Muro público de reseñas ANÓNIMAS: estrellas obligatorias (1–5) + texto opcional, una por usuario
   (editable, como Google Play), ordenado por mejor valoradas. Tabla `comentario` (`agregar-comentarios.sql`,
   RLS: leer todas / escribir la propia). Capa `lib/data/comentarios.ts` (acceso con cast, tabla nueva sin
   tipos generados). Pantalla `app/comentarios.tsx` (tu reseña + botón "Calificar en Google Play" que abre
   la ficha de Play + el muro). Acceso: Perfil → "Reseñas y comentarios" (`router.push('/comentarios')`,
   ruta en `_layout`). 100% JS (no requiere módulo nativo, pero se ve en el próximo build standalone).