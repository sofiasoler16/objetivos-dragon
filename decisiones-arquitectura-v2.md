# Decisiones de arquitectura — nativo, Health Connect, calendario e IA

> Datos verificados en agosto 2026. Las políticas de plataformas cambian: confirmá en las
> fuentes oficiales antes de publicar.

## Panorama: el dev build es la llave

```
Expo Go  →  DEVELOPMENT BUILD  →  ┌─ Health Connect (pasos/agua)        ┐
(hoy)       (llave de lo nativo)  └─ IA + Calendario (organizar semana) ┘  → Publicar (Play/App Store)
                                    (ramas INDEPENDIENTES entre sí)         (track de TIEMPO, aparte)
```

El development build desbloquea **cualquier** módulo nativo (Health Connect **y** `expo-calendar`)
y mantiene Fast Refresh. Después, Health Connect y la IA son ramas que no dependen una de la otra.

---

## Decisión 1 — Build nativo y camino a la tienda

**Tipos de build** (no es uno solo):

| Tipo | Para qué | ¿Recarga en vivo? |
|---|---|---|
| Development build | Probar módulos nativos en el cel | ✅ sí (Fast Refresh, con expo-dev-client) |
| Preview (APK) | Un APK suelto para instalar/compartir | ❌ no |
| Production (AAB) | Subir a Google Play | ❌ no |

**Recomendación:** hacé el development build cuando arranques Health Connect o el calendario.
Compilás con EAS Build (capa gratis) o en local (gratis). El dev build se instala una vez; perdés
solo la comodidad del QR de Expo Go, no la recarga.

**Trampas administrativas (planificar desde ya):**
- **Play — regla de testers:** una cuenta de desarrollador **personal** creada después del
  13/11/2023 debe correr un **closed test con ≥12 testers durante 14 días continuos** antes de
  pasar a producción. Las cuentas de **organización** (con número DUNS) están exentas, pero la
  verificación tarda 2-4 semanas. Es un **gate de tiempo, no de código** → arrancá el closed test
  apenas tengas un build instalable; los 14 días corren mientras seguís programando.
- **Health Connect + Play:** al publicar con acceso a datos de salud tenés que completar la
  **declaración de apps de salud** en Play Console + tener **política de privacidad**.
- **iOS es aparte:** cuenta Apple US$99/año, distribución por TestFlight, y salud = **HealthKit**
  (otra integración, no Health Connect). No es obligatorio ahora.

---

## Decisión 2 — Datos de salud (Health Connect)

**Hechos:** +50 tipos de datos (pasos, hidratación, nutrición, sueño, ejercicio, peso…);
guardado **on-device / privado** (no en la nube de Google); en Android 14+ viene integrado al
sistema (sin setup extra); requiere **dev build**; es **solo Android**.

**Matiz importante:** los pasos se **autocapturan**, pero **hidratación y nutrición son tipos de
entrada manual** — Health Connect no conoce tu agua ni tus comidas salvo que otra app (o la tuya)
las escriba.

| Opción | Qué incluye | Nota |
|---|---|---|
| A. Solo pasos (lectura) | Autocompletado, alto valor | El mejor punto de partida |
| B. + sueño / ejercicio (lectura) | Métricas extra automáticas | Fácil de sumar después |
| C. Hidratación / nutrición | Manual, salvo que otra app las provea | Tu app puede ser la fuente y **escribir** a Health Connect para compartir |

**Recomendación:** empezá con **pasos, solo lectura**. Para agua, que **tu app sea la fuente**
(y opcionalmente escriba a Health Connect). Comidas: manual o diferir. Usá el campo
**`fuente_datos` (MANUAL / HEALTH_CONNECT)** por objetivo — ya está previsto en el esquema.
Privacidad: si sincronizás valores derivados a Supabase, tené presente la declaración de salud y
la política de privacidad.

---

## Decisión 3 — Calendario

| Opción | Qué es | Costo/fricción |
|---|---|---|
| **A. `expo-calendar`** (calendario del teléfono) | Lee/escribe los eventos del cel — que ya incluyen tus eventos de Google sincronizados por el SO | **Sin OAuth, sin verificación de Google**, offline, simple |
| **B. Google Calendar API** (nube, OAuth) | Sync real multi-dispositivo / desde el servidor | Los scopes de Calendar son **sensibles** → **verificación de OAuth de Google** (consent screen, política de privacidad, video demo, ~10 días) antes de publicar; necesita backend para los tokens |

**Recomendación:** **`expo-calendar` para el MVP de la IA.** Le da a la IA tus eventos con cero
fricción de OAuth (y ya trae los de Google porque el sistema los sincroniza). Pasá a la API de
Google solo si necesitás sync en la nube o escribir desde el servidor — y ahí presupuestás la
verificación.

---

## Decisión 4 — Chat con IA que organiza

**Sub-decisiones:**

- **Dónde vive la key:** siempre en el **servidor** (Edge Function de Supabase, Deno). Nunca en la
  app (si no, te la extraen del build).
- **Modelo:** **Claude Haiku 4.5** ($1/$5 por millón de tokens in/out). Cada "organizá mi semana"
  cuesta una fracción de centavo. (Model id: `claude-haiku-4-5-...`.)
- **Patrón central 🔒 — la IA PROPONE, el código EJECUTA.** La IA **no escribe en la base**.

```
App junta contexto (objetivos/tareas de la semana + eventos del calendario)
        ↓
Edge Function llama al modelo → devuelve una PROPUESTA estructurada (JSON)
        ↓
La app muestra la propuesta  →  la usuaria confirma / edita
        ↓
La app escribe vía /lib/data  (validado contra el schema, con RLS)
```

- **Estilos de implementación:** (a) **salida estructurada (JSON)** — recomendado para el MVP;
  (b) function-calling / tools (más agentic, más piezas y costo) — diferir.
- **Guardrails:**
  - Validar el JSON contra tu schema **antes** de escribir.
  - El modelo mapea lenguaje natural ("pilates 3 veces por semana") a tus tipos
    (`frecuencia_tipo = WEEKLY_COUNT`, `frecuencia_cantidad = 3`; o `tarea` si es puntual).
  - Pasarle **las categorías existentes** del usuario para que **elija** una (que no invente ids
    ni categorías nuevas).
  - **Contexto acotado**: solo la semana relevante, no toda la base (barato y enfocado).
  - **Detrás de Premium**: controla el costo y monetiza a quien lo usa.
- **Costo:** un botón explícito "Organizá mi semana" (no en cada acción) + prompt caching del
  system prompt.

---

## Cómo seguir (secuencia recomendada)

1. Terminar en Expo Go lo que falte del core (incluido el sistema de temas).
2. **Development build** (una sola vez) — la llave de todo lo nativo.
3. Dos tracks **independientes**, en el orden que prefieras:
   - **Health Connect** → pasos (lectura) primero.
   - **IA + calendario** → Edge Function + Haiku + `expo-calendar`, con el patrón propone→confirma→escribe.
4. **En paralelo**, apenas tengas un build instalable: arrancá el **closed test de Play**
   (12 testers / 14 días) + declaración de salud + política de privacidad. Corre solo mientras programás.
5. **iOS** más adelante (cuenta Apple + HealthKit).

---

## Qué cambia en tu stack / schema

- **Nuevo:** Edge Functions (Deno) para la IA y, si algún día vas a la API de Google Calendar,
  para el OAuth/tokens.
- **Schema:** `fuente_datos` ya está. Para el MVP **leé el calendario en vivo** (no hace falta
  cachearlo). La propuesta de la IA **solo se guarda tras confirmar**, y se guarda como objetivos/
  tareas normales (no como una entidad "propuesta").
- **CLAUDE.md:** agregar la regla *"la IA propone, el código ejecuta; la API key vive en la Edge
  Function, nunca en la app"* y *"calendario del MVP = expo-calendar (device), no Google Calendar API"*.
