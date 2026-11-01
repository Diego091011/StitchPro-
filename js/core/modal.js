import { esc } from './utils.js';

const field = (f, v) => {
  const val = v ?? '', cls = f.full ? 'full' : '', req = f.req ? 'required' : '';
  if (f.t === 'select') {
    const opts = f.o.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${ov === val ? 'selected' : ''}>${esc(ol)}</option>`; }).join('');
    return `<label class="${cls}">${f.l}<select name="${f.k}" ${req}>${opts}</select></label>`;
  }
  if (f.t === 'textarea') return `<label class="${cls}">${f.l}<textarea name="${f.k}" rows="3">${esc(val)}</textarea></label>`;
  return `<label class="${cls}">${f.l}<input name="${f.k}" type="${f.t || 'text'}" ${f.t === 'number' ? 'step="any" min="0"' : ''} value="${esc(val)}" ${req}></label>`;
};

/**
 * Modal con formulario. fields: [{k, l, t?, o?, req?, full?}]
 * Devuelve una promesa con los valores, o null si se cancela.
 */
export function formModal({ title, fields, values = {} }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3><div class="form">${fields.map((f) => field(f, values[f.k])).join('')}</div>
      <div class="modal-act"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn green">Guardar</button></div></form>`;
    document.body.append(d);
    const form = d.querySelector('form');
    let out = null;
    d.querySelector('[data-x]').onclick = () => d.close();
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      out = {};
      fields.forEach((f) => { const v = fd.get(f.k); out[f.k] = f.t === 'number' ? (v === '' ? null : Number(v)) : v; });
      d.close();
    };
    d.addEventListener('close', () => { d.remove(); resolve(out); });
    d.showModal();
  });
}