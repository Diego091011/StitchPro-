import { sb } from '../core/supabaseClient.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };

const crud = (table, order, asc = true, select = '*') => ({
  list: async () => unwrap(await sb.from(table).select(select).order(order, { ascending: asc })),
  create: async (row) => unwrap(await sb.from(table).insert(row).select().single()),
  update: async (id, row) => unwrap(await sb.from(table).update(row).eq('id', id).select().single()),
  remove: async (id) => unwrap(await sb.from(table).delete().eq('id', id)),
});

export const inventario = crud('inventario', 'nombre');
export const categorias = {
  ...crud('categorias_inventario', 'nombre'),
  seed: async (names) => unwrap(await sb.from('categorias_inventario').insert(names.map((nombre) => ({ nombre }))).select()),
};
export const clientes = crud('clientes', 'nombre_completo');
export const servicios = crud('servicios', 'nombre');
export const pedidos = crud('pedidos', 'fecha_ingreso', false, '*, clientes(nombre_completo, telefono), pagos(id, monto, metodo, nota, fecha), servicios(nombre, tipo, minutos_estimados, costo_neto, precio_final)');

export const pagos = crud('pagos', 'fecha', false);

export const config = {
  get: async () => unwrap(await sb.from('configuracion_global').select('*').maybeSingle()),
  save: async (c) => unwrap(await sb.from('configuracion_global').upsert(c, { onConflict: 'user_id' }).select().single()),
};