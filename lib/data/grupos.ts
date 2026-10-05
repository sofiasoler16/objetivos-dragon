// Capa de datos de GRUPOS (familias/amigos). La UI nunca toca Supabase directo: pasa por acá.
// Las RPCs nuevas todavía no están en los tipos generados → cast a `any` (como el resto).
import { supabase } from '../supabase';

export type GrupoResumen = {
  id_grupo: string;
  nombre: string;
  icono: string | null;
  es_admin: boolean;
  cant_miembros: number;
};

export type MiembroGrupo = {
  id_miembro: string;
  nombre: string;
  rol: 'ADMIN' | 'MIEMBRO';
  es_placeholder: boolean;
  es_yo: boolean;
};

export type TipoItem = 'TAREA' | 'OBJETIVO';
export type FrecuenciaItem = 'DIARIA' | 'DIAS' | 'SEMANAL';
export type PrioridadItem = 'BAJA' | 'MEDIA' | 'ALTA';

export type ItemGrupo = {
  id_item: string;
  titulo: string;
  tipo: TipoItem;
  frecuencia: FrecuenciaItem | null;
  dias: number[] | null;
  fecha_limite: string | null;
  id_miembro_asignado: string | null;
  asignado_nombre: string | null;
};

export type NuevoItemGrupo = {
  titulo: string;
  tipo: TipoItem;
  descripcion?: string | null;
  frecuencia?: FrecuenciaItem | null; // OBJETIVO
  dias?: number[] | null; // OBJETIVO DIAS
  veces_semana?: number | null; // OBJETIVO SEMANAL
  fecha_inicio?: string | null; // OBJETIVO
  fecha_fin?: string | null; // OBJETIVO
  fecha_limite?: string | null; // TAREA
  hora_limite?: string | null; // TAREA (HH:MM)
  prioridad?: PrioridadItem | null; // TAREA
  id_miembro_asignado?: string | null;
  icono?: string | null;
};

/** Un ítem del grupo "esperado" en una fecha, con estado para la pantalla tipo Hoy. */
export type EsperadoGrupo = {
  id_item: string;
  titulo: string;
  descripcion: string | null;
  icono: string | null;
  tipo: TipoItem;
  frecuencia: FrecuenciaItem | null;
  dias: number[] | null;
  fecha_limite: string | null;
  hora_limite: string | null;
  fecha_fin: string | null;
  prioridad: PrioridadItem | null;
  id_miembro_asignado: string | null;
  asignado_nombre: string | null;
  mio: boolean; // asignado a mí
  puedo_marcar: boolean; // admin, o mío, o sin asignar
  hecho: boolean;
  puedo_editar: boolean; // admin o creador
};

/** Un objetivo "X veces por semana" del grupo, con el progreso de la semana. */
export type SemanalGrupo = {
  id_item: string;
  titulo: string;
  descripcion: string | null;
  icono: string | null;
  veces_semana: number;
  id_miembro_asignado: string | null;
  asignado_nombre: string | null;
  mio: boolean;
  puedo_marcar: boolean;
  hechos: number; // cuántas veces se hizo esta semana
  hecho_fecha: boolean; // si el día que se está viendo está marcado
  puedo_editar: boolean; // admin o creador
};

/** Datos completos de un ítem (para precargar el formulario de editar). */
export type ItemGrupoFull = {
  id_item: string;
  titulo: string;
  descripcion: string | null;
  icono: string | null;
  tipo: TipoItem;
  frecuencia: FrecuenciaItem | null;
  dias: number[] | null;
  veces_semana: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fecha_limite: string | null;
  hora_limite: string | null;
  prioridad: PrioridadItem | null;
  id_miembro_asignado: string | null;
};

/** Crea un grupo (requiere Premium; el servidor lo valida). Devuelve el id del grupo nuevo. */
export async function crearGrupo(nombre: string, icono?: string | null): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('crear_grupo', {
    p_nombre: nombre,
    p_icono: icono ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Lista los grupos donde participo (con si soy admin y cuántos miembros tiene). */
export async function misGrupos(): Promise<GrupoResumen[]> {
  const { data, error } = await (supabase.rpc as any)('mis_grupos');
  if (error) throw error;
  return ((data ?? []) as any[]).map((g) => ({
    id_grupo: String(g.id_grupo),
    nombre: String(g.nombre),
    icono: g.icono ?? null,
    es_admin: g.es_admin === true,
    cant_miembros: Number(g.cant_miembros ?? 0),
  }));
}

/** Datos de un grupo (nombre, ícono, si soy admin). null si no existe o no soy miembro. */
export async function detalleGrupo(idGrupo: string): Promise<GrupoResumen | null> {
  const { data, error } = await (supabase.rpc as any)('detalle_grupo', { p_grupo: idGrupo });
  if (error) throw error;
  const g = Array.isArray(data) ? data[0] : data;
  if (!g) return null;
  return {
    id_grupo: String(g.id_grupo),
    nombre: String(g.nombre),
    icono: g.icono ?? null,
    es_admin: g.es_admin === true,
    cant_miembros: Number(g.cant_miembros ?? 0),
  };
}

export type Membresia = { id_miembro: string; id_grupo: string; grupo_nombre: string };

/** Mis membresías (un id_miembro por grupo donde estoy), para reconocer asignaciones para mí. */
export async function misMembresias(): Promise<Membresia[]> {
  const { data, error } = await (supabase.rpc as any)('mis_membresias');
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({
    id_miembro: String(m.id_miembro),
    id_grupo: String(m.id_grupo),
    grupo_nombre: String(m.grupo_nombre),
  }));
}

/** Cambio de asignación recibido en vivo (Realtime) sobre un ítem del grupo. */
export type CambioAsignacion = {
  id_item: string;
  titulo: string;
  tipo: TipoItem;
  id_grupo: string;
  id_miembro_asignado: string | null;
};

/**
 * Se suscribe EN VIVO a los cambios de asignación de ítems de grupo (Supabase Realtime).
 * Llama a `onCambio(fila, asignadoAnterior)` en cada INSERT/UPDATE. `asignadoAnterior` es el
 * id_miembro que tenía antes (null en un alta), para detectar si la asignación realmente cambió.
 * Devuelve una función para cortar la suscripción. La UI nunca toca supabase directo: pasa por acá.
 */
export function suscribirAsignaciones(
  onCambio: (fila: CambioAsignacion, asignadoAnterior: string | null) => void,
): () => void {
  const aFila = (r: any): CambioAsignacion => ({
    id_item: String(r.id_item),
    titulo: String(r.titulo ?? ''),
    tipo: r.tipo === 'OBJETIVO' ? 'OBJETIVO' : 'TAREA',
    id_grupo: String(r.id_grupo),
    id_miembro_asignado: r.id_miembro_asignado ? String(r.id_miembro_asignado) : null,
  });
  const canal = supabase
    .channel('asignaciones-grupo')
    .on(
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'item_grupo' },
      (p: any) => onCambio(aFila(p.new), null),
    )
    .on(
      'postgres_changes' as any,
      { event: 'UPDATE', schema: 'public', table: 'item_grupo' },
      (p: any) => onCambio(aFila(p.new), p.old?.id_miembro_asignado ? String(p.old.id_miembro_asignado) : null),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

/** Lista los miembros de un grupo (incluye placeholders). */
export async function miembrosGrupo(idGrupo: string): Promise<MiembroGrupo[]> {
  const { data, error } = await (supabase.rpc as any)('miembros_grupo', { p_grupo: idGrupo });
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({
    id_miembro: String(m.id_miembro),
    nombre: String(m.nombre),
    rol: m.rol === 'ADMIN' ? 'ADMIN' : 'MIEMBRO',
    es_placeholder: m.es_placeholder === true,
    es_yo: m.es_yo === true,
  }));
}

/** El admin suma un miembro "placeholder" (solo nombre, sin app). Devuelve su id. */
export async function agregarPlaceholder(idGrupo: string, nombre: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('agregar_placeholder', {
    p_grupo: idGrupo,
    p_nombre: nombre,
  });
  if (error) throw error;
  return data as string;
}

export type InfoInvitacion = {
  id_grupo: string;
  grupo_nombre: string;
  grupo_icono: string | null;
  destino_nombre: string | null; // si el link es para reclamar un placeholder puntual
};

/**
 * Genera un link de invitación (admin + Premium). Devuelve el CÓDIGO.
 * `idMiembroDestino` opcional: si es un placeholder, quien entre con este código toma ESE lugar.
 */
export async function generarInvitacion(idGrupo: string, idMiembroDestino?: string | null): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('generar_invitacion', {
    p_grupo: idGrupo,
    p_destino: idMiembroDestino ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Datos de una invitación por su código (para mostrar a dónde te estás uniendo). null = inválido. */
export async function infoInvitacion(codigo: string): Promise<InfoInvitacion | null> {
  const { data, error } = await (supabase.rpc as any)('info_invitacion', { p_codigo: codigo });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    id_grupo: String(r.id_grupo),
    grupo_nombre: String(r.grupo_nombre),
    grupo_icono: r.grupo_icono ?? null,
    destino_nombre: r.destino_nombre ?? null,
  };
}

/** Se une al grupo por código (o reclama el placeholder si el link estaba atado a uno). Devuelve el id del grupo. */
export async function unirsePorCodigo(codigo: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('unirse_por_codigo', { p_codigo: codigo });
  if (error) throw error;
  return data as string;
}

/** El admin saca a un miembro del grupo. */
export async function sacarMiembro(idMiembro: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('sacar_miembro', { p_id_miembro: idMiembro });
  if (error) throw error;
}

/** El usuario actual (no admin) se va del grupo. */
export async function salirGrupo(idGrupo: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('salir_grupo', { p_grupo: idGrupo });
  if (error) throw error;
}

/** El admin elimina el grupo entero. */
export async function eliminarGrupo(idGrupo: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('eliminar_grupo', { p_grupo: idGrupo });
  if (error) throw error;
}

/** El admin transfiere el rol de admin a otro miembro (queda como MIEMBRO). */
export async function transferirAdmin(idMiembro: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('transferir_admin', { p_id_miembro: idMiembro });
  if (error) throw error;
}

/** Crea una tarea u objetivo del grupo (cualquier miembro). Devuelve el id. */
export async function crearItemGrupo(idGrupo: string, item: NuevoItemGrupo): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('crear_item_grupo', {
    p_grupo: idGrupo,
    p_titulo: item.titulo,
    p_tipo: item.tipo,
    p_frecuencia: item.frecuencia ?? null,
    p_dias: item.dias ?? null,
    p_veces_semana: item.veces_semana ?? null,
    p_fecha_inicio: item.fecha_inicio ?? null,
    p_fecha_fin: item.fecha_fin ?? null,
    p_fecha_limite: item.fecha_limite ?? null,
    p_hora_limite: item.hora_limite ?? null,
    p_prioridad: item.prioridad ?? null,
    p_descripcion: item.descripcion ?? null,
    p_asignado: item.id_miembro_asignado ?? null,
    p_icono: item.icono ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Lo que "toca" en una fecha (objetivos según frecuencia + tareas), con estado para marcar. */
export async function esperadosGrupo(idGrupo: string, fecha?: string): Promise<EsperadoGrupo[]> {
  const { data, error } = await (supabase.rpc as any)('esperados_grupo', {
    p_grupo: idGrupo,
    ...(fecha ? { p_fecha: fecha } : {}),
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((i) => ({
    id_item: String(i.id_item),
    titulo: String(i.titulo),
    descripcion: i.descripcion ?? null,
    icono: i.icono ?? null,
    tipo: i.tipo === 'OBJETIVO' ? 'OBJETIVO' : 'TAREA',
    frecuencia: ['DIARIA', 'DIAS', 'SEMANAL'].includes(i.frecuencia) ? i.frecuencia : null,
    dias: Array.isArray(i.dias) ? i.dias.map(Number) : null,
    fecha_limite: i.fecha_limite ?? null,
    hora_limite: i.hora_limite ?? null,
    fecha_fin: i.fecha_fin ?? null,
    prioridad: ['BAJA', 'MEDIA', 'ALTA'].includes(i.prioridad) ? i.prioridad : null,
    id_miembro_asignado: i.id_miembro_asignado ? String(i.id_miembro_asignado) : null,
    asignado_nombre: i.asignado_nombre ?? null,
    mio: i.mio === true,
    puedo_marcar: i.puedo_marcar === true,
    hecho: i.hecho === true,
    puedo_editar: i.puedo_editar === true,
  }));
}

/** Objetivos "X veces por semana" del grupo, con el progreso de la semana de `fecha`. */
export async function semanalesGrupo(idGrupo: string, fecha?: string): Promise<SemanalGrupo[]> {
  const { data, error } = await (supabase.rpc as any)('semanales_grupo', {
    p_grupo: idGrupo,
    ...(fecha ? { p_fecha: fecha } : {}),
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((i) => ({
    id_item: String(i.id_item),
    titulo: String(i.titulo),
    descripcion: i.descripcion ?? null,
    icono: i.icono ?? null,
    veces_semana: Number(i.veces_semana ?? 1),
    id_miembro_asignado: i.id_miembro_asignado ? String(i.id_miembro_asignado) : null,
    asignado_nombre: i.asignado_nombre ?? null,
    mio: i.mio === true,
    puedo_marcar: i.puedo_marcar === true,
    hechos: Number(i.hechos ?? 0),
    hecho_fecha: i.hecho_fecha === true,
    puedo_editar: i.puedo_editar === true,
  }));
}

/** Todos los datos de un ítem (para editar). null si no existe / no sos del grupo. */
export async function obtenerItemGrupo(idItem: string): Promise<ItemGrupoFull | null> {
  const { data, error } = await (supabase.rpc as any)('obtener_item_grupo', { p_item: idItem });
  if (error) throw error;
  const i = Array.isArray(data) ? data[0] : data;
  if (!i) return null;
  return {
    id_item: String(i.id_item),
    titulo: String(i.titulo),
    descripcion: i.descripcion ?? null,
    icono: i.icono ?? null,
    tipo: i.tipo === 'OBJETIVO' ? 'OBJETIVO' : 'TAREA',
    frecuencia: ['DIARIA', 'DIAS', 'SEMANAL'].includes(i.frecuencia) ? i.frecuencia : null,
    dias: Array.isArray(i.dias) ? i.dias.map(Number) : null,
    veces_semana: i.veces_semana != null ? Number(i.veces_semana) : null,
    fecha_inicio: i.fecha_inicio ?? null,
    fecha_fin: i.fecha_fin ?? null,
    fecha_limite: i.fecha_limite ?? null,
    hora_limite: i.hora_limite ?? null,
    prioridad: ['BAJA', 'MEDIA', 'ALTA'].includes(i.prioridad) ? i.prioridad : null,
    id_miembro_asignado: i.id_miembro_asignado ? String(i.id_miembro_asignado) : null,
  };
}

/** Edita un ítem del grupo (admin o creador; el servidor valida). */
export async function editarItemGrupo(idItem: string, item: NuevoItemGrupo): Promise<void> {
  const { error } = await (supabase.rpc as any)('editar_item_grupo', {
    p_item: idItem,
    p_titulo: item.titulo,
    p_tipo: item.tipo,
    p_frecuencia: item.frecuencia ?? null,
    p_dias: item.dias ?? null,
    p_veces_semana: item.veces_semana ?? null,
    p_fecha_inicio: item.fecha_inicio ?? null,
    p_fecha_fin: item.fecha_fin ?? null,
    p_fecha_limite: item.fecha_limite ?? null,
    p_hora_limite: item.hora_limite ?? null,
    p_prioridad: item.prioridad ?? null,
    p_descripcion: item.descripcion ?? null,
    p_asignado: item.id_miembro_asignado ?? null,
    p_icono: item.icono ?? null,
  });
  if (error) throw error;
}

/** Borra un ítem del grupo (admin o creador). */
export async function borrarItemGrupo(idItem: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('borrar_item_grupo', { p_item: idItem });
  if (error) throw error;
}

// ── Fase 3: adoptar ítems del grupo a tu Hoy personal ────────────────────────

/** Un ítem de grupo adoptado, para mostrar en el Hoy personal. */
export type ItemHoyGrupo = {
  id_item: string;
  titulo: string;
  icono: string | null;
  tipo: TipoItem;
  grupo_nombre: string;
  hora_inicio: string | null;
  puedo_marcar: boolean;
  hecho: boolean;
};

/** Adopta un ítem del grupo a tu Hoy personal (sigue siendo del grupo). */
export async function adoptarItem(idItem: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('adoptar_item', { p_item: idItem });
  if (error) throw error;
}

/** Quita un ítem del grupo de tu Hoy personal. */
export async function quitarAdopcion(idItem: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('quitar_adopcion', { p_item: idItem });
  if (error) throw error;
}

/** Ids de ítems que adopté en un grupo (para el interruptor "Agregar a mi Hoy"). */
export async function misAdopcionesGrupo(idGrupo: string): Promise<string[]> {
  const { data, error } = await (supabase.rpc as any)('mis_adopciones', { p_grupo: idGrupo });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => String(r.id_item));
}

/** Mis ítems de grupo adoptados que "tocan" un día (para el Hoy personal, de todos mis grupos). */
export async function misItemsHoyGrupos(fecha?: string): Promise<ItemHoyGrupo[]> {
  const { data, error } = await (supabase.rpc as any)('mis_items_hoy_grupos', {
    ...(fecha ? { p_fecha: fecha } : {}),
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((i) => ({
    id_item: String(i.id_item),
    titulo: String(i.titulo),
    icono: i.icono ?? null,
    tipo: i.tipo === 'OBJETIVO' ? 'OBJETIVO' : 'TAREA',
    grupo_nombre: String(i.grupo_nombre),
    hora_inicio: i.hora_inicio ?? null,
    puedo_marcar: i.puedo_marcar === true,
    hecho: i.hecho === true,
  }));
}

export type ProgresoMiembro = {
  id_miembro: string;
  nombre: string;
  es_placeholder: boolean;
  es_yo: boolean;
  esperados: number;
  hechos: number;
  pct: number;
};

/** Progreso por miembro en un rango (día/semana/mes). % de cada uno sobre lo que le está asignado. */
export async function progresoMiembros(
  idGrupo: string,
  desde: string,
  hasta: string,
): Promise<ProgresoMiembro[]> {
  const { data, error } = await (supabase.rpc as any)('progreso_miembros', {
    p_grupo: idGrupo,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({
    id_miembro: String(m.id_miembro),
    nombre: String(m.nombre),
    es_placeholder: m.es_placeholder === true,
    es_yo: m.es_yo === true,
    esperados: Number(m.esperados ?? 0),
    hechos: Number(m.hechos ?? 0),
    pct: Number(m.pct ?? 0),
  }));
}

export type ProgresoGrupo = { esperados: number; hechos: number; pct: number };

/** % del día del grupo (sobre sus objetivos DIARIA/DIAS de esa fecha). */
export async function progresoGrupo(idGrupo: string, fecha?: string): Promise<ProgresoGrupo> {
  const { data, error } = await (supabase.rpc as any)('progreso_grupo', {
    p_grupo: idGrupo,
    ...(fecha ? { p_fecha: fecha } : {}),
  });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return {
    esperados: Number(r?.esperados ?? 0),
    hechos: Number(r?.hechos ?? 0),
    pct: Number(r?.pct ?? 0),
  };
}

// ---------- Puntos y recompensas (Fase 6) ----------

export type RecompensaGrupo = {
  id_recompensa: string;
  nombre: string;
  costo: number;
  unica: boolean;
  puedo_borrar: boolean;
};

export type MiCanje = {
  id_canje: string;
  nombre: string;
  costo: number;
  usado: boolean;
  usado_en: string | null;
  fecha_creacion: string;
};

/** Puntos que da cada cumplimiento (debe coincidir con puntos_de_item del SQL, grupos-19). */
export const PUNTOS_ITEM = { objetivo: 10, tareaBaja: 5, tareaMedia: 10, tareaAlta: 15 } as const;

export type PuntosMiembro = { id_miembro: string; nombre: string; es_yo: boolean; puntos: number };

export type PuntajeMiembro = { id_miembro: string; nombre: string; es_yo: boolean; puntaje: number };

/** Puntaje TOTAL por miembro (solo lo ganado por cumplir; no baja al canjear). Ranking "quién hizo más". */
export async function puntajeTotalMiembros(idGrupo: string): Promise<PuntajeMiembro[]> {
  const { data, error } = await (supabase.rpc as any)('puntaje_total_miembros', { p_grupo: idGrupo });
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({
    id_miembro: String(m.id_miembro),
    nombre: String(m.nombre),
    es_yo: m.es_yo === true,
    puntaje: Number(m.puntaje ?? 0),
  }));
}

/** Mis puntos acumulados en un grupo. */
export async function misPuntosGrupo(idGrupo: string): Promise<number> {
  const { data, error } = await (supabase.rpc as any)('mis_puntos_grupo', { p_grupo: idGrupo });
  if (error) throw error;
  const v = Array.isArray(data) ? data[0] : data;
  return Number(v ?? 0);
}

/** Puntos de cada miembro (ranking). */
export async function puntosMiembrosGrupo(idGrupo: string): Promise<PuntosMiembro[]> {
  const { data, error } = await (supabase.rpc as any)('puntos_miembros_grupo', { p_grupo: idGrupo });
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({
    id_miembro: String(m.id_miembro),
    nombre: String(m.nombre),
    es_yo: m.es_yo === true,
    puntos: Number(m.puntos ?? 0),
  }));
}

/** Catálogo de recompensas activas del grupo. */
export async function recompensasGrupo(idGrupo: string): Promise<RecompensaGrupo[]> {
  const { data, error } = await (supabase.rpc as any)('recompensas_grupo', { p_grupo: idGrupo });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id_recompensa: String(r.id_recompensa),
    nombre: String(r.nombre),
    costo: Number(r.costo ?? 0),
    unica: r.unica === true,
    puedo_borrar: r.puedo_borrar === true,
  }));
}

/** Crea una recompensa (solo admin). `unica` = desaparece del catálogo al canjearla alguien. */
export async function crearRecompensa(
  idGrupo: string,
  nombre: string,
  costo: number,
  unica = false,
): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('crear_recompensa', {
    p_grupo: idGrupo,
    p_nombre: nombre,
    p_costo: costo,
    p_unica: unica,
  });
  if (error) throw error;
  return String(data);
}

/** Mis premios canjeados (pendientes de usar + usados recientes). */
export async function misCanjesGrupo(idGrupo: string): Promise<MiCanje[]> {
  const { data, error } = await (supabase.rpc as any)('mis_canjes_grupo', { p_grupo: idGrupo });
  if (error) throw error;
  return ((data ?? []) as any[]).map((c) => ({
    id_canje: String(c.id_canje),
    nombre: String(c.nombre),
    costo: Number(c.costo ?? 0),
    usado: c.usado === true,
    usado_en: c.usado_en ?? null,
    fecha_creacion: String(c.fecha_creacion),
  }));
}

/** Marca un premio canjeado mío como usado (a los días se borra solo). */
export async function marcarCanjeUsado(idCanje: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('marcar_canje_usado', { p_canje: idCanje });
  if (error) throw error;
}

/** Borra (desactiva) una recompensa (admin o quien la creó). */
export async function borrarRecompensa(idRecompensa: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('borrar_recompensa', { p_recompensa: idRecompensa });
  if (error) throw error;
}

/** Canjea una recompensa (descuenta puntos si alcanzan). */
export async function canjearRecompensa(idRecompensa: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('canjear_recompensa', { p_recompensa: idRecompensa });
  if (error) throw error;
}

/** Marca/desmarca un ítem del grupo en una fecha (autodetecta el miembro; para casos simples). */
export async function marcarItemGrupo(idItem: string, fecha: string, hecho: boolean): Promise<void> {
  const { error } = await (supabase.rpc as any)('marcar_item_grupo', {
    p_item: idItem,
    p_fecha: fecha,
    p_hecho: hecho,
  });
  if (error) throw error;
}

/** Marca/desmarca la instancia de UN miembro puntual (null = marca compartida de ítem sin asignar). */
export async function marcarItemMiembro(
  idItem: string,
  fecha: string,
  idMiembro: string | null,
  hecho: boolean,
): Promise<void> {
  const { error } = await (supabase.rpc as any)('marcar_item_miembro', {
    p_item: idItem,
    p_fecha: fecha,
    p_id_miembro: idMiembro,
    p_hecho: hecho,
  });
  if (error) throw error;
}

/** Una asignación de un ítem: un miembro + los días que le tocan (null = todos). */
export type AsignacionItem = { id_miembro: string; dias: number[] | null };

/** Asignaciones actuales de un ítem (para precargar el formulario de editar). */
export async function asignacionesItem(idItem: string): Promise<AsignacionItem[]> {
  const { data, error } = await (supabase.rpc as any)('asignaciones_item', { p_item: idItem });
  if (error) throw error;
  return ((data ?? []) as any[]).map((a) => ({
    id_miembro: String(a.id_miembro),
    dias: a.dias ?? null,
  }));
}

/** Reemplaza las asignaciones de un ítem (admin o creador). `[]` = sin asignar (cualquiera). */
export async function setAsignacionesItem(idItem: string, asignaciones: AsignacionItem[]): Promise<void> {
  const { error } = await (supabase.rpc as any)('set_asignaciones_item', {
    p_item: idItem,
    p_asignaciones: asignaciones,
  });
  if (error) throw error;
}

/** Lista las tareas y objetivos del grupo (con a quién está asignado cada uno). */
export async function itemsGrupo(idGrupo: string): Promise<ItemGrupo[]> {
  const { data, error } = await (supabase.rpc as any)('items_grupo', { p_grupo: idGrupo });
  if (error) throw error;
  return ((data ?? []) as any[]).map((i) => ({
    id_item: String(i.id_item),
    titulo: String(i.titulo),
    tipo: i.tipo === 'OBJETIVO' ? 'OBJETIVO' : 'TAREA',
    frecuencia: i.frecuencia === 'DIARIA' || i.frecuencia === 'DIAS' ? i.frecuencia : null,
    dias: Array.isArray(i.dias) ? i.dias.map(Number) : null,
    fecha_limite: i.fecha_limite ?? null,
    id_miembro_asignado: i.id_miembro_asignado ? String(i.id_miembro_asignado) : null,
    asignado_nombre: i.asignado_nombre ?? null,
  }));
}
