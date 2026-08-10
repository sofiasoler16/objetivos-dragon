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

**Fase actual: Fase 1 — Base de datos y capa de datos (completada).**
Hecho: `esquema.sql` + `esquema-dragones.sql` aplicados en Supabase; tipos generados en
`lib/types.ts` (`supabase gen types`); capa de datos tipada en `/lib/data`
(`categorias`, `objetivos` + `objetivo_dia`, `registros`, `tareas`).
Pendiente de verificación: un select **autenticado** de prueba (se prueba en Fase 2).
Próxima: **Fase 2 — Autenticación.**

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