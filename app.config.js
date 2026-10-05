// Config dinámica de Expo.
//
// Sirve para UNA sola cosa: permitir un **dev build que CONVIVA** con la versión de Google Play,
// dándole un `package` (applicationId) y un `name` distintos SOLO cuando se compila el perfil
// `development` (que setea APP_VARIANT=development en eas.json). Así podés tener las dos apps
// instaladas a la vez y hacer hot-reload en el dev build sin desinstalar la de Play.
//
// En cualquier otro caso (preview / production / correr sin la variable), devuelve EXACTAMENTE la
// config de app.json, sin cambios. Los valores base siguen viviendo en app.json.
//
// ⚠️ En el dev build (paquete `.dev`) el login con Google NO funciona: el OAuth de Google está
// atado al paquete real `com.sofiasoler.drakostone`. Todo lo demás (vistas, calendario del
// teléfono, IA, etc.) sí. Para probar Google, usar el build de producción.

module.exports = ({ config }) => {
  // `config` ya trae los valores de app.json.
  const esDev = process.env.APP_VARIANT === 'development';
  if (!esDev) return config;
  return {
    ...config,
    name: 'Drakostone dev',
    scheme: 'objetivosdragondev',
    android: {
      ...config.android,
      package: 'com.sofiasoler.drakostone.dev',
    },
  };
};
