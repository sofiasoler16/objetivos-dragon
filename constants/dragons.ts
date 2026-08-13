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
    neutral: require('../assets/dragons/original/dragon.png'),
    manana: require('../assets/dragons/original/manana.png'),
    animo: require('../assets/dragons/original/animo.png'),
    orgullo: require('../assets/dragons/original/orgullo.png'),
    festejo: require('../assets/dragons/original/festejo.png'),
    enojado: require('../assets/dragons/original/enojado.png'),
  },
  dragon_fuego: {
    neutral: require('../assets/dragons/fuego/dragon-fuego.png'),
    manana: require('../assets/dragons/fuego/dragon-fuego-manana.png'),
    animo: require('../assets/dragons/fuego/dragon-fuego-animo.png'),
    orgullo: require('../assets/dragons/fuego/dragon-fuego-orgullo.png'),
    festejo: require('../assets/dragons/fuego/dragon-fuego-festejo.png'),
    enojado: require('../assets/dragons/fuego/dragon-fuego-enojado.png'),
  },
  dragon_nocturno: {
    neutral: require('../assets/dragons/nocturno/dragon-nocturno.png'),
    manana: require('../assets/dragons/nocturno/dragon-nocturno-manana.png'),
    animo: require('../assets/dragons/nocturno/dragon-nocturno-animo.png'),
    orgullo: require('../assets/dragons/nocturno/dragon-nocturno-orgullo.png'),
    festejo: require('../assets/dragons/nocturno/dragon-nocturno-festejo.png'),
    enojado: require('../assets/dragons/nocturno/dragon-nocturno-enojado.png'),
  },
  dragon_hielo: {
    neutral: require('../assets/dragons/hielo/dragon-hielo.png'),
    manana: require('../assets/dragons/hielo/dragon-hielo-manana.png'),
    animo: require('../assets/dragons/hielo/dragon-hielo-animo.png'),
    orgullo: require('../assets/dragons/hielo/dragon-hielo-orgullo.png'),
    festejo: require('../assets/dragons/hielo/dragon-hielo-festejo.png'),
    enojado: require('../assets/dragons/hielo/dragon-hielo-enojado.png'),
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
