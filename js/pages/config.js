import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { $, toast } from '../core/utils.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('config');

const FIELDS = ['sueldo_base', 'horas_mes', 'precio_kwh', 'potencia_maquina_w'];
const DEFAULTS = { sueldo_base: 0, horas_mes: 160, precio_kwh: 950, potencia_maquina_w: 500 };
const form = $('#form');

try {
  const c = (await S.config.get()) || DEFAULTS;
  FIELDS.forEach((k) => (form.elements[k].value = c[k]));
} catch (e) { toast(e.message, true); }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await S.config.save(Object.fromEntries(FIELDS.map((k) => [k, Number(form.elements[k].value)])));
    toast('Costos guardados');
  } catch (err) { toast(err.message, true); }
});
