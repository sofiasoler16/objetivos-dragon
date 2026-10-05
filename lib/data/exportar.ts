import { hoyISO } from '@/logic/fecha';
import { supabase } from '../supabase';
import { listarCategorias } from './categorias';
import { requireUserId } from './_helpers';
import { listarObjetivosConDias } from './objetivos';
import { registrosEnRango } from './registros';
import { listarTareas } from './tareas';

/** UUID v4 para generar ids nuevos al migrar un backup a otra cuenta (suficiente para ids de fila). */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Arma un backup con TODOS los datos del usuario (categorías, objetivos + días, tareas, registros).
 * Devuelve un objeto serializable (la UI lo pasa a JSON y lo comparte). Solo lectura, best-effort.
 */
export async function exportarDatos(): Promise<{
  version: number;
  exportado: string;
  categorias: unknown[];
  objetivos: unknown[];
  tareas: unknown[];
  registros: unknown[];
}> {
  const [categorias, objetivos, tareas, registros] = await Promise.all([
    listarCategorias().catch(() => []),
    listarObjetivosConDias().catch(() => []), // todos (activos e inactivos)
    listarTareas().catch(() => []),
    registrosEnRango('2000-01-01', hoyISO()).catch(() => []), // todo el historial
  ]);
  return {
    version: 1,
    exportado: new Date().toISOString(),
    categorias,
    objetivos,
    tareas,
    registros,
  };
}

/**
 * Restaura un backup: hace UPSERT de categorías → objetivos → días → tareas → registros (en ese
 * orden por las FK), poniendo el `id_usuario` de la sesión actual. Merge idempotente (por id).
 * Devuelve cuántos objetos/tareas/registros restauró.
 */
export async function restaurarDatos(
  datos: {
    categorias?: unknown[];
    objetivos?: unknown[];
    tareas?: unknown[];
    registros?: unknown[];
  } | null,
): Promise<{ objetivos: number; tareas: number; registros: number }> {
  const uid = await requireUserId();
  const up = async (tabla: string, filas: unknown[]) => {
    if (filas.length === 0) return;
    const { error } = await (supabase.from as any)(tabla).upsert(filas);
    if (error) {
      // Los errores de Supabase (PostgrestError) NO son instancias de Error → si los tirásemos tal
      // cual, la UI mostraría un mensaje genérico y perderíamos el motivo. Los envolvemos en un
      // Error con tabla + mensaje + detalle + código, para poder diagnosticar qué fila rechaza.
      const partes = [error.message, error.details, error.hint, error.code && `código ${error.code}`]
        .filter(Boolean)
        .join(' · ');
      throw new Error(`Al restaurar "${tabla}": ${partes || 'error desconocido'}`);
    }
  };

  // ¿El backup es de ESTA misma cuenta? Los backups traen `id_usuario` en categorías/objetivos/tareas.
  const owner =
    (datos?.categorias?.[0] as any)?.id_usuario ??
    (datos?.objetivos?.[0] as any)?.id_usuario ??
    (datos?.tareas?.[0] as any)?.id_usuario ??
    null;
  const mismaCuenta = owner == null || owner === uid;

  // Quita los campos calculados/anidados que NO son columnas de `objetivo` (si quedaban, el upsert
  // fallaba con "columna objetivo_dia inexistente"). Devuelve las columnas reales.
  const limpiarObjetivo = (o: any) => {
    const { dias, horariosDia, objetivo_dia, ...rest } = o;
    return rest;
  };

  if (mismaCuenta) {
    // MISMA cuenta → mantenemos los ids → upsert idempotente (re-restaurar NO duplica).
    const cats = (datos?.categorias ?? []).map((c: any) => ({ ...c, id_usuario: uid }));
    await up('categoria', cats);

    const diasRows: any[] = [];
    const objs = (datos?.objetivos ?? []).map((o: any) => {
      for (const h of o?.horariosDia ?? [])
        diasRows.push({ id_objetivo: o.id_objetivo, dia_semana: h.dia, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin });
      return { ...limpiarObjetivo(o), id_usuario: uid };
    });
    await up('objetivo', objs);
    await up('objetivo_dia', diasRows);

    const tareas = (datos?.tareas ?? []).map((t: any) => ({ ...t, id_usuario: uid }));
    await up('tarea', tareas);

    const registros = (datos?.registros ?? []) as any[];
    await up('registro_objetivo', registros);

    return { objetivos: objs.length, tareas: tareas.length, registros: registros.length };
  }

  // CUENTA DISTINTA (migración) → generamos ids NUEVOS y remapeamos las relaciones. Los ids del
  // backup ya existen y son de otra cuenta; la RLS bloquea tocar filas ajenas (42501). Con ids
  // nuevos, cada fila queda como tuya y se inserta limpia.
  const mapCat = new Map<string, string>();
  const cats = (datos?.categorias ?? []).map((c: any) => {
    const nuevo = uuidv4();
    mapCat.set(c.id_categoria, nuevo);
    return { ...c, id_categoria: nuevo, id_usuario: uid };
  });
  await up('categoria', cats);

  const mapObj = new Map<string, string>();
  const diasRows: any[] = [];
  const objs = (datos?.objetivos ?? []).map((o: any) => {
    const nuevo = uuidv4();
    mapObj.set(o.id_objetivo, nuevo);
    for (const h of o?.horariosDia ?? [])
      diasRows.push({ id_objetivo: nuevo, dia_semana: h.dia, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin });
    return {
      ...limpiarObjetivo(o),
      id_objetivo: nuevo,
      id_usuario: uid,
      id_categoria: o.id_categoria ? (mapCat.get(o.id_categoria) ?? null) : null,
      id_evento_calendario: null, // los eventos de calendario eran de la otra cuenta/dispositivo
    };
  });
  await up('objetivo', objs);
  await up('objetivo_dia', diasRows);

  const tareas = (datos?.tareas ?? []).map((t: any) => ({
    ...t,
    id_tarea: uuidv4(),
    id_usuario: uid,
    id_categoria: t.id_categoria ? (mapCat.get(t.id_categoria) ?? null) : null,
    id_evento_calendario: null,
  }));
  await up('tarea', tareas);

  const registros = ((datos?.registros ?? []) as any[])
    .map((r: any) => {
      const nuevoObj = mapObj.get(r.id_objetivo);
      if (!nuevoObj) return null; // registro de un objetivo que no está en el backup → se omite
      return { ...r, id_registro: uuidv4(), id_objetivo: nuevoObj };
    })
    .filter(Boolean) as any[];
  await up('registro_objetivo', registros);

  return { objetivos: objs.length, tareas: tareas.length, registros: registros.length };
}
