import { money } from './utils.js';
import { saldo } from './recibo.js';
import * as S from '../services/index.js';

const dia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const ord = (n) => '#' + String(n).padStart(5, '0');

/** Avisos calculados con los datos actuales: entregas, órdenes listas, saldos y stock. */
export async function notificaciones() {
  const [ped, inv] = await Promise.all([S.pedidos.list(), S.inventario.list()]);
  [...ped].sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso)).forEach((p, i) => (p.num = i + 1));
  const hoy = dia(new Date()), out = [];
  ped.forEach((p) => {
    const cli = p.clientes?.nombre_completo || 'Cliente';
    if (p.estado !== 'entregado' && p.fecha_entrega) {
      const dd = Math.round((dia(p.fecha_entrega) - hoy) / 864e5);
      if (dd < 0) out.push({ pri: 0, icon: 'alert', c: 'bad', t: `Entrega vencida · ${ord(p.num)}`, d: `${cli} · hace ${-dd} día${-dd > 1 ? 's' : ''}`, href: 'pedidos.html' });
      else if (dd === 0) out.push({ pri: 1, icon: 'calendar', c: 'warn', t: `Entrega hoy · ${ord(p.num)}`, d: cli, href: 'pedidos.html' });
      else if (dd === 1) out.push({ pri: 2, icon: 'calendar', c: 'warn', t: `Entrega mañana · ${ord(p.num)}`, d: cli, href: 'pedidos.html' });
    }
    if (p.estado === 'listo') out.push({ pri: 3, icon: 'truck', c: 'ok', t: `Lista para entregar · ${ord(p.num)}`, d: cli, href: 'pedidos.html' });
    if (p.estado === 'entregado' && saldo(p) > 0) out.push({ pri: 4, icon: 'money', c: 'warn', t: `Saldo pendiente · ${money(saldo(p))}`, d: `${cli} · ${ord(p.num)}`, href: 'pedidos.html' });
  });
  inv.filter((i) => Number(i.stock_actual) <= 0).forEach((i) => out.push({ pri: 5, icon: 'box', c: 'bad', t: `Sin stock: ${i.nombre}`, d: 'Repón el inventario', href: 'inventario.html' }));
  const r2 = (x) => Math.round(Number(x) * 100) / 100;
  inv.filter((i) => Number(i.stock_minimo) > 0 && Number(i.stock_actual) > 0 && Number(i.stock_actual) <= Number(i.stock_minimo))
    .forEach((i) => out.push({ pri: 5, icon: 'alert', c: 'warn', t: `Stock bajo: ${i.nombre}`, d: `Quedan ${r2(i.stock_actual)} ${i.unidad_medida} (mínimo ${r2(i.stock_minimo)})`, href: 'inventario.html' }));
  let ult = 0;
  try { ult = Number(localStorage.getItem('stitchpro-backup')) || 0; } catch { /* sin almacenamiento */ }
  const dias = ult ? Math.floor((Date.now() - ult) / 864e5) : null;
  if (ped.length && (dias === null || dias >= 14)) out.push({ pri: 6, icon: 'download', c: 'warn', t: 'Descarga un respaldo', d: dias === null ? 'Aún no has descargado ninguno' : `Hace ${dias} días del último`, href: 'config.html' });
  return out.sort((a, b) => a.pri - b.pri).slice(0, 30);
}