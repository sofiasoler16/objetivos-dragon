// Muro de reseñas/comentarios. Una reseña por usuario (editable, como Google Play).
// La tabla `comentario` es nueva y todavía no está en los tipos generados → se accede con un
// cast puntual (mismo criterio que otras partes que usan rpc sin tipos). RLS: leer todas, escribir
// solo la propia.
import { supabase } from '../supabase';

export type Comentario = {
  id_comentario: string;
  id_usuario: string;
  puntaje: number; // 1..5
  texto: string | null;
  created_at: string;
};

// Acceso a la tabla sin tipos generados (localizado acá).
const tabla = () => (supabase as any).from('comentario');

/** Muro público: mejor valoradas primero, luego más recientes. */
export async function listarComentarios(): Promise<Comentario[]> {
  const { data, error } = await tabla()
    .select('id_comentario, id_usuario, puntaje, texto, created_at')
    .order('puntaje', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Comentario[];
}

/** La reseña del usuario actual (o null si todavía no dejó ninguna). */
export async function miComentario(): Promise<Comentario | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await tabla()
    .select('id_comentario, id_usuario, puntaje, texto, created_at')
    .eq('id_usuario', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Comentario) ?? null;
}

/**
 * Crea o actualiza la reseña del usuario (una por persona). `puntaje` 1..5 obligatorio; `texto`
 * opcional (vacío = sin texto).
 */
export async function guardarComentario(puntaje: number, texto: string | null): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  if (puntaje < 1 || puntaje > 5) throw new Error('Elegí de 1 a 5 estrellas.');
  const limpio = texto?.trim() || null;
  const { error } = await tabla().upsert(
    { id_usuario: user.id, puntaje, texto: limpio },
    { onConflict: 'id_usuario' },
  );
  if (error) throw error;
}
