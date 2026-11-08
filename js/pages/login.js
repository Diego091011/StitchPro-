import { redirectIfAuth, signIn, signUp, friendly } from '../core/auth.js';
import { SPRITE, ic } from '../core/icons.js';
import { $, $$ } from '../core/utils.js';
import { applyTheme } from '../core/theme.js';

applyTheme();
await redirectIfAuth();
document.body.insertAdjacentHTML('afterbegin', SPRITE);
$('#logo').innerHTML = `${ic('dress')}<div class="brand">Stitch<span>Pro</span></div><small>Gestiona · Cose · Crece</small>`;
document.body.classList.add('ready');

let mode = 'in';
const msg = (type, text) => { const m = $('#msg'); m.className = 'msg ' + (type || ''); m.textContent = text || ''; };

function setMode(m) {
  mode = m;
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  $('#go').textContent = m === 'in' ? 'Ingresar' : 'Crear cuenta';
  $('[name=password]').autocomplete = m === 'in' ? 'current-password' : 'new-password';
  msg();
}
$$('.tabs button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (!f.reportValidity()) return;
  const btn = $('#go');
  btn.disabled = true; btn.textContent = 'Un momento…'; msg();
  try {
    const { email, password } = Object.fromEntries(new FormData(f));
    if (mode === 'up') {
      const d = await signUp(email, password);
      if (!d.session) { setMode('in'); msg('ok', 'Cuenta creada. Revisa tu correo para confirmarla y luego ingresa.'); return; }
    } else await signIn(email, password);
    location.replace('dashboard.html');
  } catch (err) { msg('err', friendly(err)); }
  finally { btn.disabled = false; btn.textContent = mode === 'in' ? 'Ingresar' : 'Crear cuenta'; }
});