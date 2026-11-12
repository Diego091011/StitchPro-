/**
 * consumo.js — Estimación de tela y materiales a partir de las medidas del cliente.
 * Módulo puro (sin DOM). Todas las medidas en cm. Es una estimación de patronaje
 * por piezas rectangulares con holguras y costuras; ajusta los parámetros a tu forma de trabajar.
 */
const n = (v) => Number(v) || 0;

export const MEDIDAS_LABEL = { cintura: 'Contorno de cintura', cadera: 'Contorno de cadera', busto: 'Contorno de busto', largo_pantalon: 'Largo de pantalón', largo_falda: 'Largo de falda', largo_blusa: 'Largo de blusa', largo_talle: 'Centro atrás', costado: 'Costado', cuello: 'Contorno de cuello', escote: 'Escote', ciza_posterior: 'Ciza posterior', ciza_delantero: 'Ciza delantero', contorno_brazo: 'Contorno de manga', largo_interno_manga: 'Largo interno de manga', tiro: 'Tiro', largo_bata: 'Largo de bata', largo_chaqueta: 'Largo de chaqueta', largo_capa: 'Largo de capa', largo_abrigo: 'Largo de abrigo', largo_falda_larga: 'Largo de falda larga total' };
/** Medida de respaldo si el cliente aún no tiene la principal (ej. chaqueta usa el largo de blusa). */
export const ALT = { largo_chaqueta: 'largo_blusa' };
export const MANGAS = [['Sin manga', 0], ['Corta', 22], ['Tres cuartos', 45], ['Larga', 60]];
export const VUELOS = [['Recta', 1], ['Evasé', 1.4], ['Amplia', 1.8], ['Vuelo completo', 2.5]];

/** req: medidas necesarias · minutos: tiempo base · hilo: yardas · extras: [{kw: palabras clave de inventario, qty}] */
const MO = ['contorno_brazo', 'largo_interno_manga'];
export const PRENDAS = {
  pantalon: { nombre: 'Pantalón', req: ['cintura', 'cadera', 'largo_pantalon'], minutos: 240, hilo: 250, opt: ['tiro', 'ciza_delantero', 'ciza_posterior'], extras: [{ kw: ['cierre'], qty: 1 }, { kw: ['boton'], qty: 1 }] },
  short: { nombre: 'Short', req: ['cintura', 'cadera'], minutos: 150, hilo: 130, opt: ['tiro'], extras: [{ kw: ['cierre'], qty: 1 }, { kw: ['boton'], qty: 1 }] },
  falda: { nombre: 'Falda', req: ['cintura', 'cadera', 'largo_falda'], minutos: 150, hilo: 120, vuelo: true, extras: [{ kw: ['cierre'], qty: 1 }, { kw: ['boton'], qty: 1 }] },
  blusa: { nombre: 'Blusa / Camisa', req: ['busto', 'largo_blusa'], minutos: 180, hilo: 150, manga: true, mangaDef: 22, opt: ['cuello', 'escote', ...MO], extras: [{ kw: ['boton'], qty: 6 }] },
  vestido: { nombre: 'Vestido', req: ['busto', 'cintura', 'cadera', 'largo_talle', 'largo_falda'], minutos: 360, hilo: 250, manga: true, mangaDef: 0, vuelo: true, opt: ['escote', 'cuello', 'costado', ...MO], extras: [{ kw: ['cierre'], qty: 1 }] },
  chaqueta: { nombre: 'Chaqueta', req: ['busto', 'largo_chaqueta'], minutos: 480, hilo: 300, manga: true, mangaDef: 60, forro: true, opt: ['cuello', 'costado', ...MO], extras: [{ kw: ['boton'], qty: 4 }] },
  bata: { nombre: 'Bata', req: ['busto', 'largo_bata'], minutos: 300, hilo: 200, manga: true, mangaDef: 45, opt: ['cuello', 'escote', ...MO], extras: [{ kw: ['boton'], qty: 6 }] },
  capa: { nombre: 'Capa', req: ['largo_capa'], minutos: 240, hilo: 150, opt: ['cuello'], extras: [{ kw: ['boton'], qty: 2 }] },
  abrigo: { nombre: 'Abrigo', req: ['busto', 'largo_abrigo'], minutos: 600, hilo: 350, manga: true, mangaDef: 60, forro: true, opt: ['cuello', 'costado', ...MO], extras: [{ kw: ['boton'], qty: 6 }] },
  faldalarga: { nombre: 'Falda larga', req: ['cintura', 'cadera', 'largo_falda_larga'], minutos: 200, hilo: 160, vuelo: true, extras: [{ kw: ['cierre'], qty: 1 }, { kw: ['boton'], qty: 1 }] },
};

/** Piezas rectangulares aproximadas: {n: nombre, w: ancho, h: largo, qty, f: va en el forro}. */
export function piezas(tipo, m, o = {}) {
  const L = (d) => n(o.largo) || n(d), vuelo = n(o.vuelo) || 1;
  const mangas = (base) => {
    if (!(n(o.manga) > 0)) return [];
    const lm = n(m.largo_interno_manga) > 0 ? (n(m.largo_interno_manga) * n(o.manga)) / 60 : n(o.manga); // proporcional al tipo de manga elegido
    return [{ n: 'Mangas', w: n(m.contorno_brazo) > 0 ? n(m.contorno_brazo) + base : n(m.busto) / 3 + base, h: lm + 5, qty: 2, f: 1 }];
  };
  const detalles = (def) => (n(m.cuello) > 0 || n(m.escote) > 0
    ? [...(n(m.cuello) > 0 ? [{ n: 'Cuello', w: n(m.cuello) + 8, h: 14, qty: 1 }] : []), ...(n(m.escote) > 0 ? [{ n: 'Vista de escote', w: n(m.escote) + 6, h: 8, qty: 1 }] : [])] : def);
  const costados = (extra) => (n(m.costado) > 0 ? [{ n: 'Costados', w: n(m.busto) / 4 + 6, h: n(m.costado) + extra, qty: 2, f: 1 }] : []);
  switch (tipo) {
    case 'pantalon': case 'short': {
      const l = tipo === 'short' ? n(o.largo) || (n(m.tiro) > 0 ? n(m.tiro) + 20 : 45) : L(m.largo_pantalon);
      const wf = n(m.cadera) / 4 + (n(m.ciza_delantero) > 0 ? n(m.ciza_delantero) / 2.5 : 9), wt = n(m.cadera) / 4 + (n(m.ciza_posterior) > 0 ? n(m.ciza_posterior) / 2.5 : 11);
      return [{ n: 'Delanteros', w: wf, h: l + 7, qty: 2 }, { n: 'Traseros', w: wt, h: l + 7, qty: 2 }, { n: 'Pretina', w: n(m.cintura) + 12, h: 9, qty: 1 }, { n: 'Bolsillos', w: 20, h: 25, qty: 2 }];
    }
    case 'falda': return [{ n: 'Paneles', w: (n(m.cadera) / 2 + 10) * vuelo, h: L(m.largo_falda) + 6, qty: 2 }, { n: 'Pretina', w: n(m.cintura) + 10, h: 8, qty: 1 }];
    case 'blusa': return [{ n: 'Delantero y espalda', w: n(m.busto) / 2 + 8, h: L(m.largo_blusa) + 5, qty: 2 }, ...mangas(6), ...detalles([{ n: 'Cuello y detalles', w: 40, h: 12, qty: 1 }])];
    case 'vestido': return [{ n: 'Cuerpo', w: n(m.busto) / 2 + 8, h: n(m.largo_talle) + 6, qty: 2, f: 1 }, { n: 'Falda', w: (n(m.cadera) / 2 + 10) * vuelo, h: L(m.largo_falda) + 6, qty: 2, f: 1 }, ...mangas(6), ...detalles([]), ...costados(8)];
    case 'chaqueta': {
      const l = L(m.largo_chaqueta);
      return [{ n: 'Frentes', w: n(m.busto) / 4 + 12, h: l + 8, qty: 2, f: 1 }, { n: 'Espalda', w: n(m.busto) / 2 + 12, h: l + 8, qty: 1, f: 1 }, ...mangas(8), { n: 'Solapa y bolsillos', w: 60, h: 30, qty: 1 }, ...detalles([]), ...costados(10)];
    }
    case 'bata': return [{ n: 'Frentes', w: n(m.busto) / 4 + 14, h: L(m.largo_bata) + 6, qty: 2 }, { n: 'Espalda', w: n(m.busto) / 2 + 14, h: L(m.largo_bata) + 6, qty: 1 }, ...mangas(8), { n: 'Bolsillos', w: 20, h: 22, qty: 2 }, ...detalles([{ n: 'Cuello y detalles', w: 40, h: 12, qty: 1 }])];
    case 'capa': return [{ n: 'Capa', w: 2 * (L(m.largo_capa) + 8), h: L(m.largo_capa) + 8, qty: 1 }, ...detalles([{ n: 'Cuello y cierre', w: 40, h: 14, qty: 1 }])];
    case 'abrigo': {
      const l = L(m.largo_abrigo);
      return [{ n: 'Frentes', w: n(m.busto) / 4 + 14, h: l + 8, qty: 2, f: 1 }, { n: 'Espalda', w: n(m.busto) / 2 + 14, h: l + 8, qty: 1, f: 1 }, ...mangas(10), { n: 'Solapa y bolsillos', w: 60, h: 30, qty: 1 }, ...detalles([]), ...costados(10)];
    }
    case 'faldalarga': return [{ n: 'Paneles', w: (n(m.cadera) / 2 + 10) * vuelo, h: L(m.largo_falda_larga) + 8, qty: 2 }, { n: 'Pretina', w: n(m.cintura) + 10, h: 8, qty: 1 }];
    default: return [];
  }
}

/** Metros de tela: agrupa piezas de igual largo en filas a lo ancho de la tela; suma merma y redondea a 5 cm. */
export function metrosTela(ps, ancho = 150, { merma = 8, estampado = false, soloForro = false } = {}) {
  const W = Math.max(30, n(ancho) - 4), grupos = new Map();
  ps.filter((p) => !soloForro || p.f).forEach((p) => {
    let { w, qty } = p;
    if (w > W) { const s = Math.ceil(w / W); qty *= s; w /= s; }
    grupos.set(p.h, (grupos.get(p.h) || 0) + w * qty);
  });
  let cm = 0;
  grupos.forEach((tw, h) => (cm += Math.ceil(tw / W) * h));
  cm *= 1 + n(merma) / 100;
  if (estampado) cm *= 1.12;
  return Math.ceil(cm / 5) / 20;
}

const M_POR = { metro: 1, yarda: 0.9144, cm: 0.01 };
/** Convierte metros a la unidad de uso del insumo (null si no es una medida de largo). */
export const aUnidad = (metros, unidad) => (M_POR[unidad] ? metros / M_POR[unidad] : null);
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');