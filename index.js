// Entry point de la app. Arranca expo-router y, además, registra el task handler del widget de
// Android (react-native-android-widget). Ese registro es NATIVO → solo existe en el dev-build /
// rebuild: va con lazy require + try/catch para NO romper el dev-client actual (que no lo tiene).

import 'expo-router/entry';

try {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
} catch {
  /* módulo nativo ausente (dev-client viejo): el widget se ve recién en el rebuild */
}
