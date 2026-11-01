import { sb } from '../supabaseClient.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };

const crud = (table, order, asc = true, select = '*') => ({
  list: async () => unwrap(await sb.from(table).select(select).order(order, { ascending: asc })),
  create: async (row) => unwrap(await sb.from(table).insert(row).select().single()),
  update: async (id, row) => unwrap(await sb.from(table).update(row).eq('id', id).select().single()),
  remove: async (id) => unwrap(await sb.from(table).delete().eq('id', id)),
});

export const inventario = crud('inventario', 'nombre');
export const clientes = crud('clientes', 'nombre_completo');
export const servicios = crud('servicios', 'nombre');
export const pedidos = crud('pedidos', 'fecha_ingreso', false, '*, clientes(nombre_completo), servicios(nombre, tipo, minutos_estimados, costo_neto, precio_final)');

export const config = {
  get: async () => unwrap(await sb.from('configuracion_global').select('*').maybeSingle()),
  save: async (c) => unwrap(await sb.from('configuracion_global').upsert(c, { onConflict: 'user_id' }).select().single()),
};

export const auth = {
  session: async () => (await sb.auth.getSession()).data.session,
  signIn: async (email, password) => unwrap(await sb.auth.signInWithPassword({ email, password })),
  signUp: async (email, password) => unwrap(await sb.auth.signUp({ email, password })),
  signOut: () => sb.auth.signOut(),
  onChange: (cb) => sb.auth.onAuthStateChange((_e, s) => cb(s)),
};

export const realtime = (tables, cb) => {
  const ch = sb.channel('stitchpro-rt');
  tables.forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb(t)));
  return ch.subscribe();
};
