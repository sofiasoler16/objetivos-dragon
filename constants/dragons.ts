import type { ImageSourcePropType } from 'react-native';
import type { EstadoDragon } from '@/logic/dragon';

// Registro de arte de dragones, por expresión.
// React Native necesita require() ESTÁTICOS (no se puede require(variable) ni de
// archivos que no existan), así que cada imagen se declara acá con una línea.
// La clave externa es el `asset_key` de la tabla `dragon` → equipar un dragón (V3)
// elige su set; la clave interna es la expresión (estado de ánimo).
//
//  · neutral  = busto (dragon.png), se usa en Objetivos y Progreso (no cambia).
//  · manana/animo/orgullo/festejo/enojado = cuerpo entero, se usan en Hoy según
//    el estado del día (ver estadoDragon en logic/dragon.ts).
//
// Para sumar un dragón nuevo: creá assets/dragons/<nombre>/ con las 6 imágenes,
// agregá su bloque acá con el asset_key, e insertá la fila en `dragon` (+ `tema`).
export type ExpresionDragon = 'neutral' | EstadoDragon;

export type SetExpresiones = Record<ExpresionDragon, ImageSourcePropType>;

export const DRAGON_ART: Record<string, SetExpresiones> = {
  dragon_original: {
    neutral: require('../assets/dragons/original/dragon.webp'),
    manana: require('../assets/dragons/original/manana.webp'),
    animo: require('../assets/dragons/original/animo.webp'),
    orgullo: require('../assets/dragons/original/orgullo.webp'),
    festejo: require('../assets/dragons/original/festejo.webp'),
    enojado: require('../assets/dragons/original/enojado.webp'),
  },
  dragon_fuego: {
    neutral: require('../assets/dragons/fuego/dragon-fuego.webp'),
    manana: require('../assets/dragons/fuego/dragon-fuego-manana.webp'),
    animo: require('../assets/dragons/fuego/dragon-fuego-animo.webp'),
    orgullo: require('../assets/dragons/fuego/dragon-fuego-orgullo.webp'),
    festejo: require('../assets/dragons/fuego/dragon-fuego-festejo.webp'),
    enojado: require('../assets/dragons/fuego/dragon-fuego-enojado.webp'),
  },
  dragon_nocturno: {
    neutral: require('../assets/dragons/nocturno/dragon-nocturno.webp'),
    manana: require('../assets/dragons/nocturno/dragon-nocturno-manana.webp'),
    animo: require('../assets/dragons/nocturno/dragon-nocturno-animo.webp'),
    orgullo: require('../assets/dragons/nocturno/dragon-nocturno-orgullo.webp'),
    festejo: require('../assets/dragons/nocturno/dragon-nocturno-festejo.webp'),
    enojado: require('../assets/dragons/nocturno/dragon-nocturno-enojado.webp'),
  },
  dragon_hielo: {
    neutral: require('../assets/dragons/hielo/dragon-hielo.webp'),
    manana: require('../assets/dragons/hielo/dragon-hielo-manana.webp'),
    animo: require('../assets/dragons/hielo/dragon-hielo-animo.webp'),
    orgullo: require('../assets/dragons/hielo/dragon-hielo-orgullo.webp'),
    festejo: require('../assets/dragons/hielo/dragon-hielo-festejo.webp'),
    enojado: require('../assets/dragons/hielo/dragon-hielo-enojado.webp'),
  },
  dragon_phoenix: {
    neutral: require('../assets/dragons/phoenix/dragon-phoenix.webp'),
    manana: require('../assets/dragons/phoenix/dragon-phoenix-manana.webp'),
    animo: require('../assets/dragons/phoenix/dragon-phoenix-animo.webp'),
    orgullo: require('../assets/dragons/phoenix/dragon-phoenix-orgullo.webp'),
    festejo: require('../assets/dragons/phoenix/dragon-phoenix-festejo.webp'),
    enojado: require('../assets/dragons/phoenix/dragon-phoenix-enojado.webp'),
  },
  dragon_tormenta: {
    neutral: require('../assets/dragons/tormenta/dragon-tormenta.webp'),
    manana: require('../assets/dragons/tormenta/dragon-tormenta-manana.webp'),
    animo: require('../assets/dragons/tormenta/dragon-tormenta-animo.webp'),
    orgullo: require('../assets/dragons/tormenta/dragon-tormenta-orgullo.webp'),
    festejo: require('../assets/dragons/tormenta/dragon-tormenta-festejo.webp'),
    enojado: require('../assets/dragons/tormenta/dragon-tormenta-enojado.webp'),
  },
  dragon_medieval: {
    neutral: require('../assets/dragons/caballero-medieval/dragon-medieval.webp'),
    manana: require('../assets/dragons/caballero-medieval/dragon-medieval-manana.webp'),
    animo: require('../assets/dragons/caballero-medieval/dragon-medieval-animo.webp'),
    orgullo: require('../assets/dragons/caballero-medieval/dragon-medieval-orgullo.webp'),
    festejo: require('../assets/dragons/caballero-medieval/dragon-medieval-festejo.webp'),
    enojado: require('../assets/dragons/caballero-medieval/dragon-medieval-enojado.webp'),
  },
  dragon_princesa_medieval: {
    neutral: require('../assets/dragons/princesa-medieval/dragon-princesa-medieval.webp'),
    manana: require('../assets/dragons/princesa-medieval/dragon-princesa-medieval-manana.webp'),
    animo: require('../assets/dragons/princesa-medieval/dragon-princesa-medieval-animo.webp'),
    orgullo: require('../assets/dragons/princesa-medieval/dragon-princesa-medieval-orgullo.webp'),
    festejo: require('../assets/dragons/princesa-medieval/dragon-princesa-medieval-festejo.webp'),
    enojado: require('../assets/dragons/princesa-medieval/dragon-princesa-medieval-enojado.webp'),
  },
  dragon_mago: {
    neutral: require('../assets/dragons/mago/dragon-mago.webp'),
    manana: require('../assets/dragons/mago/dragon-mago-manana.webp'),
    animo: require('../assets/dragons/mago/dragon-mago-animo.webp'),
    orgullo: require('../assets/dragons/mago/dragon-mago-orgullo.webp'),
    festejo: require('../assets/dragons/mago/dragon-mago-festejo.webp'),
    enojado: require('../assets/dragons/mago/dragon-mago-enojado.webp'),
  },
  dragon_gimnasio: {
    neutral: require('../assets/dragons/gimnasio/dragon-gimnasio.webp'),
    manana: require('../assets/dragons/gimnasio/dragon-gimnasio-manana.webp'),
    animo: require('../assets/dragons/gimnasio/dragon-gimnasio-animo.webp'),
    orgullo: require('../assets/dragons/gimnasio/dragon-gimnasio-orgullo.webp'),
    festejo: require('../assets/dragons/gimnasio/dragon-gimnasio-festejo.webp'),
    enojado: require('../assets/dragons/gimnasio/dragon-gimnasio-enojado.webp'),
  },
  dragon_arcoiris: {
    neutral: require('../assets/dragons/arcoiris/dragon-arcoiris.webp'),
    manana: require('../assets/dragons/arcoiris/dragon-arcoiris-manana.webp'),
    animo: require('../assets/dragons/arcoiris/dragon-arcoiris-animo.webp'),
    orgullo: require('../assets/dragons/arcoiris/dragon-arcoiris-orgullo.webp'),
    festejo: require('../assets/dragons/arcoiris/dragon-arcoiris-festejo.webp'),
    enojado: require('../assets/dragons/arcoiris/dragon-arcoiris-enojado.webp'),
  },
  dragon_programador: {
    neutral: require('../assets/dragons/programador/dragon-programador.webp'),
    manana: require('../assets/dragons/programador/dragon-programador-manana.webp'),
    animo: require('../assets/dragons/programador/dragon-programador-animo.webp'),
    orgullo: require('../assets/dragons/programador/dragon-programador-orgullo.webp'),
    festejo: require('../assets/dragons/programador/dragon-programador-festejo.webp'),
    enojado: require('../assets/dragons/programador/dragon-programador-enojado.webp'),
  },
  dragon_samurai: {
    neutral: require('../assets/dragons/samurai/dragon-samurai.webp'),
    manana: require('../assets/dragons/samurai/dragon-samurai-manana.webp'),
    animo: require('../assets/dragons/samurai/dragon-samurai-animo.webp'),
    orgullo: require('../assets/dragons/samurai/dragon-samurai-orgullo.webp'),
    festejo: require('../assets/dragons/samurai/dragon-samurai-festejo.webp'),
    enojado: require('../assets/dragons/samurai/dragon-samurai-enojado.webp'),
  },
};

export const DEFAULT_DRAGON_KEY = 'dragon_original';

/** Arte del dragón por asset_key + expresión (default: busto neutral). Cae al Original. */
export function dragonSource(
  assetKey?: string,
  expresion: ExpresionDragon = 'neutral',
): ImageSourcePropType {
  const set = DRAGON_ART[assetKey ?? DEFAULT_DRAGON_KEY] ?? DRAGON_ART[DEFAULT_DRAGON_KEY];
  return set[expresion] ?? set.neutral;
}
