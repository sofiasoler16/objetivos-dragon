# Cambios para el próximo build — Drakostone

Texto para pasarle a Claude Code. Priorizar los **BUGS**, sobre todo el bloque de
sincronización con Google Calendar. Mantener los principios de siempre:

> **Principios base:** schema-first · la IA propone y el código ejecuta · lógica sensible
> (XP, créditos, compras, premium, IA) server-side · el progreso se calcula desde los registros,
> nunca del estado actual del objetivo.

---

## DECISIONES IMPORTANTES (contexto para no re-discutir)

- **Objetivo no cumplido:** no debe quedar igual que uno pendiente o cumplido. Se marca
  **visualmente distinto** (ej. gris o tachado en "Mi semana"/calendario), conservando el
  registro de que estaba planificado. *(Decisión abierta: marcar visualmente —preferido— vs.
  sacarlo del calendario.)*
- **Sincronización con Google Calendar:** debe ser **idempotente**. Guardar un mapeo estable
  (id del evento) entre cada ocurrencia de objetivo y su evento en Google Calendar, para que
  editar actualice el mismo evento, eliminar borre solo ese, y recolorear/mover modifique el
  existente — nunca crear uno nuevo.
- **Recurrencia:** editar o eliminar un objetivo recurrente nunca reescribe el pasado. Siempre
  "de hoy en adelante" vs "todos", conservando el historial.
- **Premium offline:** si el usuario está sin internet, se mantiene su estado premium cacheado;
  no se revoca.

---

## BUGS (prioridad)

### 1. Sincronización con Google Calendar (el más grande — todos son el mismo problema de fondo)
La sincronización **no es idempotente**: al editar un objetivo se crea un evento nuevo en vez de
modificar el existente, lo que genera **duplicados y huérfanos**. Síntomas observados:
- Al cambiar el **horario o los días** de un objetivo (en la app o en Google) **se duplican** eventos.
- El botón **"Reparar"** duplica **TODOS** los eventos en vez de arreglarlos.
- Al cambiar el **color**, quedan **duplicados con el color viejo** que no se actualizan ni borran.
- Modificar **un solo día** deja el evento viejo **colgado** (ni se actualiza ni se elimina).
- **Desconectar/reconectar** Google re-agrega los eventos "en etapas raras" / parcialmente.
- Eliminar eventos en Google Calendar **no se refleja** en "Mi semana" (o tarda mucho).

**Solución de raíz:** mapeo estable objetivo↔evento (id guardado) para que editar → actualice,
eliminar → borre solo ese, recolorear/mover → modifique el mismo. Con la raíz arreglada deberían
caerse casi todos los síntomas.

### 2. Recurrencia que destruye el historial
Al editar la recurrencia (ej. "agregar sábados de hoy en adelante"), se borra del calendario
"desde siempre" y se re-crea **incluyendo fechas pasadas**. Debe aplicar **desde la fecha del
cambio en adelante**, conservando el historial. Ofrecer "de hoy en adelante" vs "todos".

### 3. Grupos
- Al **eliminar un grupo** no se saca automáticamente a los miembros y el grupo **sigue
  existiendo hasta reiniciar la app** (el estado no se refresca) → que se refleje al instante.
- El **link de grupo** debe llevar a **unirse directamente**, no solo mostrar el código.
- Una tarea/objetivo de grupo debe aparecer **a partir de su fecha de creación**, no antes.

### 4. Notificaciones
Llegó una **notificación de un objetivo ya terminado/cumplido**. No deben dispararse
notificaciones de objetivos finalizados o completados.

### 5. Premium sin conexión
Sin internet, la app trata al usuario como **NO premium** (lo saca del premium). Debe ser al
revés: **mantener el estado premium cacheado** cuando está offline y no revocarlo.

### 6. Objetivo no cumplido en el calendario
Ver "Decisiones importantes": marcarlo visualmente distinto (gris/tachado), conservando el
registro de que estaba planificado. No dejarlo igual que uno pendiente/cumplido.

### 7. Insights / progreso
- El gráfico de **% de cumplimiento por categoría** hoy es **semanal** → pasarlo a **mensual**.
- Aplicarle el mismo arreglo de cálculo de % que ya se hizo en la vista semanal.
- En la vista de mes, **no permitir navegar infinitamente** hacia atrás/adelante (no pasar del
  mes actual hacia adelante).

---

## FEATURES / MEJORAS

- **Hoy:** al entrar, que la vista del Día aparezca **centrada en la hora actual** (auto-scroll a "ahora").
- **Tareas:** botón **"marcar como completada"** dentro de la pantalla de info/detalle de la tarea.
- **Tareas:** con **duración (cantidad de tiempo) + cronómetro** (parte del tipo DURATION ya planeado).
- **Objetivos:** opción de **"reprogramar"** un objetivo que se omite (moverlo a otro momento).
- **IA:** más funciones / más preguntas (ampliar el organizador; *a definir cuáles*).
- **Gamificación** (ya en diseño aparte): **mascotas** que decoran los bordes de las tarjetas +
  **efectos/adornos** + un **consumible** (escudo de racha) como "sink" infinito de monedas.

---

*Nota: quedó fuera de este brief lo de "metas medibles / tipo de prueba / impacto tipificado /
diagrama de flujo" — es de otro proyecto, no de Drakostone.*
