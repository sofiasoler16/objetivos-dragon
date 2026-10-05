# Configurar FCM (notificaciones push) — para el BUILD FINAL

> **Cuándo hacer esto:** al final del desarrollo, junto con el **rebuild final** (necesita un build
> nuevo sí o sí — no se puede probar en el dev-client actual).
>
> **Qué logra:** que "te asignaron una tarea/objetivo" te llegue **aunque tengas la app cerrada**.
> El código ya está hecho (ver "Estado del código" abajo); acá falta solo la config de Firebase +
> subir credenciales a EAS + el build.
>
> **Por qué hace falta FCM:** en Android, TODA push pasa por FCM (el "cartero" de Google). Supabase
> despacha la notificación, pero FCM es el que la entrega al teléfono. Es gratis e ilimitado.

---

## Estado del código (YA HECHO, no hay que reprogramar)

- **`grupos-14-push-asignacion.sql`** — tabla `push_token` + RPCs `registrar_push_token` /
  `borrar_push_token` + disparador `notificar_asignacion` que, al asignar un ítem, manda la push
  al servicio de Expo (usa `pg_net`, no cuenta como Edge Function). **Todavía NO correr** (esperar al
  paso 6 de abajo).
- **`components/PushSync.tsx`** — registra el token del dispositivo al abrir y abre el grupo al tocar
  la noti. **Está desmontado** (no se usa mientras no haya FCM). Hay que volver a montarlo (paso 7).
- **`lib/notificaciones.ts`** → `obtenerPushToken()` / `pushTokenEnMemoria()`.
- **`lib/data/push.ts`** → `registrarPushToken` / `borrarPushToken`. Borrado del token al cerrar
  sesión ya cableado en `lib/data/auth.ts`.

---

## Pasos (una sola vez)

### 1. Crear proyecto en Firebase (gratis)
- Entrá a https://console.firebase.google.com con tu cuenta de Google.
- "Agregar proyecto" → nombre (ej: Drakostone) → podés desactivar Analytics → Crear.

### 2. Agregar una app Android al proyecto
- En el proyecto → ícono de Android ("Agregar app").
- **Nombre del paquete (EXACTO):** `com.sofiasoler.drakostone`
  (si querés push también en el dev-client, agregá una segunda app con `com.sofiasoler.drakostone.dev`).
- Registrar app.

### 3. Descargar `google-services.json`
- Firebase te ofrece bajar **`google-services.json`**. Descargalo.
- Guardalo en la raíz del proyecto: `Objectives.dragon/google-services.json`.
- (No es un secreto, pero podés ponerlo en `.gitignore` si preferís no subirlo.)

### 4. Referenciarlo en `app.json`
Dentro de `expo.android`, agregar:
```json
"android": {
  "googleServicesFile": "./google-services.json",
  ...lo que ya está...
}
```

### 5. Subir la credencial FCM V1 a EAS (para que Expo pueda entregar a Android)
- En Firebase → **⚙ Configuración del proyecto → Cuentas de servicio →** "Generar nueva clave
  privada" → descarga un **JSON de cuenta de servicio**. **⚠️ ESTE SÍ es sensible** — NO subir a git.
- En la terminal del proyecto: `eas credentials`
  → Android → elegí el perfil (production) → **Google Service Account / FCM V1** → subí ese JSON.
  (Esto le da a Expo permiso de entregar tus push por FCM.)

### 6. Correr el SQL del push en Supabase
- Correr **`grupos-14-push-asignacion.sql`** en el SQL Editor (activa `pg_net`, crea la tabla de
  tokens y el disparador). Recién ahora, porque antes no tenía sentido sin el build con FCM.

### 7. Reactivar `PushSync` en la app
- En `app/(tabs)/_layout.tsx`: volver a importar y montar `<PushSync />`.
- **Decisión de doble aviso:** con FCM activo, si la app está ABIERTA podrías recibir la push Y el
  aviso en vivo (`AvisoAsignacion`) a la vez. Elegir uno:
  - **Opción simple:** sacar `<AvisoAsignacion />` del layout y quedarte solo con la push (Expo
    puede mostrar la noti también con la app abierta).
  - **Opción prolija:** dejar el aviso en vivo para app abierta y que la push se muestre solo con la
    app cerrada (se ajusta en el handler de `configurarNotificaciones`).

### 8. Build final + probar
- `EAS_NO_VCS=1 eas build --profile production --platform android`
- Instalar en dos teléfonos con dos cuentas. Desde el admin, asignar una tarea a otro miembro.
- El otro teléfono, **con la app cerrada**, tiene que recibir la notificación.

---

## Notas
- El servicio de push de **Expo es gratis** y el disparador usa `pg_net` (no gasta Edge Functions).
- FCM **no reemplaza** a Supabase: Supabase sigue siendo el backend; FCM es solo el último tramo al
  teléfono.
- Mientras tanto (sin FCM), funciona el **aviso en vivo con la app abierta** (`grupos-15` +
  `AvisoAsignacion`).
