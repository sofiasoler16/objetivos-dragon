// Config plugin local: agrega el <queries> que permite a la app "ver"/detectar
// la app Health Connect (com.google.android.apps.healthdata). Necesario para que
// getSdkStatus() funcione y para poder abrir Health Connect en Android 13 y anteriores
// (en Android 14+ HC es parte del sistema, pero declararlo es inocuo y correcto).
// El config plugin oficial de react-native-health-connect NO agrega esto.
const { withAndroidManifest } = require('@expo/config-plugins');

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

module.exports = function withHealthConnectQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!Array.isArray(manifest.queries)) {
      manifest.queries = [];
    }

    const yaDeclarado = manifest.queries.some((q) =>
      (q.package || []).some(
        (p) => p?.$?.['android:name'] === HEALTH_CONNECT_PACKAGE
      )
    );

    if (!yaDeclarado) {
      manifest.queries.push({
        package: [{ $: { 'android:name': HEALTH_CONNECT_PACKAGE } }],
      });
    }

    return config;
  });
};
