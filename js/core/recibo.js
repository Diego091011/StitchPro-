import { money, esc } from './utils.js';

const day = (d) => (d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Por definir');
export const itemsDe = (p) => (p.items?.length ? p.items : [{ nombre: p.servicios?.nombre || 'Servicio', cantidad: 1, precio: p.total_cobrado }]);
export const abonado = (p) => (p.pagos || []).reduce((a, x) => a + Number(x.monto), 0);
export const saldo = (p) => Math.max(0, Number(p.total_cobrado) - abonado(p));

/** Abre el recibo en una pestaña lista para imprimir o guardar como PDF. */
export function imprimirRecibo(p, { taller = 'StitchPro', telefono = '', direccion = '', pie = '', num = '' } = {}) {
  const filas = itemsDe(p).map((i) => `<tr><td>${esc(i.nombre)}${i.prenda ? `<br><small>${esc(i.prenda)}</small>` : ''}</td><td class="r">${i.cantidad}</td><td class="r">${money(i.precio)}</td><td class="r">${money(i.cantidad * i.precio)}</td></tr>`).join('');
  const pagos = (p.pagos || []).map((x) => `<tr><td>${day(x.fecha)} · ${esc(x.metodo)}</td><td class="r">${money(x.monto)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${esc(num)}</title><style>
    body{font-family:system-ui,Arial,sans-serif;color:#111;max-width:680px;margin:30px auto;padding:0 20px}
    h1{margin:0;font-size:26px}h2{font-size:15px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#555}
    .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:10px}
    table{width:100%;border-collapse:collapse}td,th{padding:7px 4px;border-bottom:1px solid #ddd;text-align:left;font-size:14px}.r{text-align:right}small{color:#666}
    .tot td{font-weight:700;font-size:16px;border-bottom:0}.foot{margin-top:28px;font-size:12px;color:#666;text-align:center}
    @media print{button{display:none}}</style></head><body>
    <div class="top"><div><h1>${esc(taller)}</h1><small>Recibo de orden${telefono || direccion ? ` · ${esc([telefono, direccion].filter(Boolean).join(' · '))}` : ''}</small></div><div class="r"><b>${esc(num)}</b><br><small>${day(p.fecha_ingreso)}</small></div></div>
    <h2>Cliente</h2><div>${esc(p.clientes?.nombre_completo)}${p.clientes?.telefono ? ` · ${esc(p.clientes.telefono)}` : ''}</div>
    <h2>Servicios</h2><table><tr><th>Detalle</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th></tr>${filas}</table>
    <table style="margin-top:8px"><tr class="tot"><td>Total</td><td class="r">${money(p.total_cobrado)}</td></tr></table>
    ${pagos ? `<h2>Abonos</h2><table>${pagos}</table>` : ''}
    <table style="margin-top:8px"><tr class="tot"><td>Saldo pendiente</td><td class="r">${money(saldo(p))}</td></tr></table>
    <h2>Entrega</h2><div>${day(p.fecha_entrega)}</div>${p.notas ? `<h2>Notas</h2><div>${esc(p.notas)}</div>` : ''}
    <div class="foot">${esc(pie || `¡Gracias por confiar en ${taller}!`)}</div><p style="text-align:center"><button onclick="print()">Imprimir / Guardar PDF</button></p></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html); w.document.close(); w.focus();
  return true;
}

/** Enlace de WhatsApp con el resumen de la orden (null si el cliente no tiene teléfono). */
export function whatsappUrl(p, { taller = 'StitchPro', num = '' } = {}) {
  const d = String(p.clientes?.telefono || '').replace(/\D/g, '');
  if (!d) return null;
  const lista = itemsDe(p).map((i) => `${i.cantidad > 1 ? i.cantidad + '× ' : ''}${i.nombre}`).join(', ');
  const txt = `Hola ${p.clientes.nombre_completo.split(' ')[0]} 👋 Tu orden ${num} en ${taller}: ${lista}.\nTotal: ${money(p.total_cobrado)} · Abonado: ${money(abonado(p))} · Saldo: ${money(saldo(p))}\nEntrega: ${day(p.fecha_entrega)}.\n¡Gracias!`;
  return `https://wa.me/${d.length === 10 ? '57' + d : d}?text=${encodeURIComponent(txt)}`;
}