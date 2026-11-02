import { esc } from './utils.js';

const field = (f, v) => {
  if (f.t === 'section') return `<h4 class="sec">${esc(f.l)}</h4>`;
  const val = v ?? '', cls = f.full ? 'full' : '', req = f.req ? 'required' : '';
  if (f.t === 'select') {
    const opts = f.o.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${ov === val ? 'selected' : ''}>${esc(ol)}</option>`; }).join('');
    return `<label class="${cls}">${f.l}<select name="${f.k}" ${req}>${opts}</select></label>`;
  }
  if (f.t === 'textarea') return `<label class="${cls}">${f.l}<textarea name="${f.k}" rows="3">${esc(val)}</textarea></label>`;
  if (f.t === 'checkbox') return `<label class="${cls}" style="flex-direction:row;align-items:center"><input type="checkbox" name="${f.k}" style="width:auto" ${val ? 'checked' : ''}> ${f.l}</label>`;
  return `<label class="${cls}">${f.l}<input name="${f.k}" type="${f.t || 'text'}" ${f.t === 'number' ? 'step="any" min="0"' : ''} value="${esc(val)}" ${req}></label>`;
};

/**
 * Modal con formulario. fields: [{k, l, t?, o?, req?, full?}]
 * t: text (defecto) | number | date | select | textarea | checkbox | section (solo título)
 * preview(valores) → html opcional que se actualiza en vivo mientras se escribe.
 * Devuelve una promesa con los valores, o null si se cancela.
 */
export function formModal({ title, fields, values = {}, preview }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3><div class="form">${fields.map((f) => field(f, values[f.k])).join('')}</div>
      ${preview ? '<div class="preview"></div>' : ''}
      <div class="modal-act"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn green">Guardar</button></div></form>`;
    document.body.append(d);
    const form = d.querySelector('form');
    const collect = () => {
      const fd = new FormData(form), out = {};
      fields.filter((f) => f.t !== 'section').forEach((f) => {
        const v = fd.get(f.k);
        out[f.k] = f.t === 'checkbox' ? fd.has(f.k) : f.t === 'number' ? (v === '' ? null : Number(v)) : f.t === 'date' ? v || null : v;
      });
      return out;
    };
    let out = null;
    if (preview) { const pv = d.querySelector('.preview'), upd = () => (pv.innerHTML = preview(collect())); form.addEventListener('input', upd); upd(); }
    d.querySelector('[data-x]').onclick = () => d.close();
    form.onsubmit = (e) => { e.preventDefault(); if (!form.reportValidity()) return; out = collect(); d.close(); };
    d.addEventListener('close', () => { d.remove(); resolve(out); });
    d.showModal();
  });
}

/** Ventana informativa de solo lectura. `html` debe venir ya escapado por quien llama. */
export function infoModal({ title, html }) {
  const d = document.createElement('dialog');
  d.innerHTML = `<h3>${esc(title)}</h3>${html}<div class="modal-act"><button class="btn ghost" data-x>Cerrar</button></div>`;
  document.body.append(d);
  d.querySelector('[data-x]').onclick = () => d.close();
  d.addEventListener('close', () => d.remove());
  d.showModal();
}