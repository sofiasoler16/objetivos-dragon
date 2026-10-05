// Backup a ARCHIVO .json (exportar/importar). Usa expo-file-system + expo-sharing +
// expo-document-picker (NATIVOS → se ven recién en el rebuild). BEST-EFFORT con LAZY require +
// try/catch: si el módulo nativo no está (dev-client), NO se importa al cargar (no rompe la app)
// y las funciones devuelven false/null. (No usar imports estáticos acá: rompen el dev-client.)

function getFS(): any | null {
  try {
    return require('expo-file-system');
  } catch {
    return null;
  }
}
function getSharing(): any | null {
  try {
    return require('expo-sharing');
  } catch {
    return null;
  }
}
function getPicker(): any | null {
  try {
    return require('expo-document-picker');
  } catch {
    return null;
  }
}

/** Escribe `json` a un archivo .json y abre el menú de compartir para guardarlo. */
export async function exportarArchivo(json: string, nombre: string): Promise<boolean> {
  const FS = getFS();
  const Sharing = getSharing();
  if (!FS?.File || !Sharing) return false;
  try {
    const file = new FS.File(FS.Paths.cache, nombre);
    if (file.exists) file.delete();
    file.create();
    file.write(json);
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Backup Drakostone',
    });
    return true;
  } catch {
    return false;
  }
}

/** Deja elegir un archivo .json y devuelve su contenido de texto (o null si canceló/falló). */
export async function elegirArchivoJson(): Promise<string | null> {
  const Picker = getPicker();
  const FS = getFS();
  if (!Picker || !FS?.File) return null;
  try {
    const res = await Picker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return null;
    return await new FS.File(res.assets[0].uri).text();
  } catch {
    return null;
  }
}
