import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { $, esc } from '../core/utils.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('asistente');

const SUG = ['¿Cuánto me deben en total y quién?', 'Resumen de ventas y utilidad de este mes', '¿Qué insumos debo comprar pronto?', '¿Qué órdenes tienen la entrega vencida?', '¿Qué prenda me deja más utilidad?', '¿Quién es mi mejor cliente?'];
const hist = [];
let busy = false;
const box = $('#msgs'), q = $('#q'), go = $('#go');

const fmt = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
/** Markdown mínimo: párrafos, listas con "-" y **negritas** (el texto se escapa primero). */
function md(t) {
  let h = '', ul = false;
  esc(t).split('\n').forEach((l) => {
    const m = l.match(/^\s*[-*•]\s+(.*)/);
    if (m) { if (!ul) { h += '<ul>'; ul = true; } h += `<li>${fmt(m[1])}</li>`; }
    else { if (ul) { h += '</ul>'; ul = false; } if (l.trim()) h += `<p>${fmt(l)}</p>`; }
  });
  return h + (ul ? '</ul>' : '');
}
function add(cls, html) {
  const d = document.createElement('div');
  d.className = 'm ' + cls; d.innerHTML = html;
  box.append(d); box.scrollTop = box.scrollHeight;
  return d;
}
function inicio() {
  box.innerHTML = ''; hist.length = 0;
  add('b', '<p>Hola 👋 Soy tu asistente. Leo los datos de tu taller y respondo lo que me preguntes. Solo consulto: no modifico nada.</p>');
  $('#sug').innerHTML = SUG.map((s) => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('');
}
async function enviar(texto) {
  texto = (texto ?? q.value).trim();
  if (!texto || busy) return;
  busy = true; go.disabled = true; q.value = ''; q.style.height = 'auto'; $('#sug').innerHTML = '';
  add('u', esc(texto));
  const t = add('b', '<span class="dots"><i></i><i></i><i></i></span>');
  try {
    const r = await S.ia.chat({ pregunta: texto, historial: hist.slice(-8) });
    t.innerHTML = md(r.respuesta);
    hist.push({ rol: 'user', texto }, { rol: 'bot', texto: r.respuesta });
  } catch (e) { t.classList.add('err'); t.textContent = e.message; }
  busy = false; go.disabled = false; box.scrollTop = box.scrollHeight; q.focus();
}

go.onclick = () => enviar();
q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
q.addEventListener('input', () => { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 120) + 'px'; });
$('#sug').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) enviar(b.dataset.s); });
$('#clear').onclick = inicio;
inicio();