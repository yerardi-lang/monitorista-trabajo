/* CONFIGURACIÓN: reemplazar estos dos valores con los del proyecto Supabase del trabajo. */
const SUPABASE_URL = "https://qqezrhvqiaqjnoivkmtz.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_TMyGQiyBAa-z4YF4wt-hZw_BORiQV1C";

const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PEGA_AQUI") && !SUPABASE_ANON_KEY.includes("PEGA_AQUI");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let channels = [], spots = [], selectedChannelIds = new Set(), editingChannelId = null, editingSpotId = null, toastTimer;
const $ = id => document.getElementById(id);

 document.addEventListener('DOMContentLoaded', async () => {
  $('loginForm').addEventListener('submit', login);
  $('logoutBtn').addEventListener('click', logout);
  $('refreshBtn').addEventListener('click', refreshAll);
  $('searchInput').addEventListener('input', renderSpots);
  $('newChannelBtn').addEventListener('click', openNewChannel);
  $('newSpotBtn').addEventListener('click', openNewSpot);
  $('adminChannelSelect').addEventListener('change', loadAdminSpots);
  $('channelColor').addEventListener('input', () => $('colorValue').textContent = $('channelColor').value.toUpperCase());
  $('channelForm').addEventListener('submit', saveChannel);
  $('spotForm').addEventListener('submit', saveSpot);
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
  if (!configured) { $('loginMessage').textContent = 'Falta configurar la URL y la publishable key de Supabase en app.js.'; return; }
  const { data: { session } } = await db.auth.getSession();
  showSession(session);
  db.auth.onAuthStateChange((_event, sessionNow) => showSession(sessionNow));
});

function showSession(session) {
  const logged = !!session;
  $('loginView').classList.toggle('hidden', logged);
  $('appView').classList.toggle('hidden', !logged);
  $('userBar').classList.toggle('hidden', !logged);
  $('userEmail').textContent = session?.user?.email || '';
  if (logged) refreshAll();
}
async function login(e) {
  e.preventDefault(); $('loginMessage').textContent = 'Ingresando…';
  const { error } = await db.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
  $('loginMessage').textContent = error ? error.message : '';
}
async function logout() { await db.auth.signOut(); $('loginForm').reset(); }
async function refreshAll() { await loadChannels(); await loadMonitorSpots(); }
async function loadChannels() {
  const { data, error } = await db.from('canales').select('id,nombre,color').order('nombre');
  if (error) return toast('Error al cargar canales: ' + error.message);
  channels = data || [];
  selectedChannelIds = new Set([...selectedChannelIds].filter(id => channels.some(c => c.id === id)));
  renderChannels(); renderAdminChannels(); fillChannelSelects();
}
function renderChannels() {
  $('channelList').innerHTML = '';
  if (!channels.length) { $('channelList').innerHTML = '<p class="empty">Todavía no hay canales. Agréguelos desde Administración.</p>'; return; }
  channels.forEach(c => {
    const label = document.createElement('label'); label.className = 'channel-option'; label.style.backgroundColor = c.color;
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selectedChannelIds.has(c.id);
    check.addEventListener('change', async () => { check.checked ? selectedChannelIds.add(c.id) : selectedChannelIds.delete(c.id); await loadMonitorSpots(); });
    const name = document.createElement('span'); name.textContent = c.nombre; label.append(check, name); $('channelList').append(label);
  });
}
async function loadMonitorSpots() {
  $('spotList').innerHTML = '';
  if (!selectedChannelIds.size) { $('spotHint').textContent = 'Seleccione uno o varios canales para consultar sus spots.'; return; }
  $('spotHint').textContent = 'Cargando spots…';
  const { data, error } = await db.from('spots').select('id,canal_id,codigo,nombre').in('canal_id', [...selectedChannelIds]).order('nombre');
  if (error) { $('spotHint').textContent = 'No se pudieron cargar los spots: ' + error.message; return; }
  spots = data || []; renderSpots();
}
function renderSpots() {
  const query = $('searchInput').value.trim().toLocaleLowerCase();
  const list = spots.filter(s => s.nombre.toLocaleLowerCase().includes(query) || s.codigo.toLocaleLowerCase().includes(query));
  $('spotList').innerHTML = '';
  $('spotHint').textContent = `${list.length} spot(s) encontrados`;
  if (!list.length) { $('spotList').innerHTML = '<p class="empty">No hay spots para mostrar.</p>'; return; }
  list.forEach(s => {
    const c = channels.find(x => x.id === s.canal_id); const row = document.createElement('div'); row.className = 'spot-row'; row.style.backgroundColor = c?.color || '#f9fafb'; row.title = 'Pulsar para copiar el ID';
    const info = document.createElement('div'); const name = document.createElement('div'); name.className = 'spot-name'; name.textContent = s.nombre; const code = document.createElement('div'); code.className = 'spot-code'; code.textContent = `ID: ${s.codigo}${c ? ' · ' + c.nombre : ''}`; info.append(name, code); const copy = document.createElement('button'); copy.className = 'btn btn-light'; copy.textContent = 'Copiar ID'; copy.addEventListener('click', e => { e.stopPropagation(); copyId(s.codigo); }); row.append(info, copy); row.addEventListener('click', () => copyId(s.codigo)); $('spotList').append(row);
  });
}
function fillChannelSelects() {
  for (const select of [$('adminChannelSelect'), $('spotChannel')]) {
    const previous = select.value; select.innerHTML = '';
    if (select === $('adminChannelSelect')) { const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Seleccione un canal'; select.append(opt); }
    channels.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.nombre; select.append(opt); });
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
  }
}
function renderAdminChannels() {
  $('adminChannelList').innerHTML = '';
  if (!channels.length) { $('adminChannelList').innerHTML = '<p class="empty">No hay canales registrados.</p>'; return; }
  channels.forEach(c => {
    const row = document.createElement('div'); row.className = 'admin-row'; const main = document.createElement('div'); main.className = 'admin-main'; const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = c.color; const name = document.createElement('strong'); name.textContent = c.nombre; main.append(swatch, name); const actions = document.createElement('div'); actions.className = 'actions'; actions.append(actionButton('Editar','btn btn-edit',()=>openEditChannel(c)), actionButton('Eliminar','btn btn-delete',()=>deleteChannel(c))); row.append(main,actions); $('adminChannelList').append(row);
  });
}
function actionButton(text, cls, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text; b.addEventListener('click', fn); return b; }
function openNewChannel() { editingChannelId = null; $('channelDialogTitle').textContent = 'Nuevo canal'; $('channelName').value = ''; $('channelColor').value = '#cfe2f3'; $('colorValue').textContent = '#CFE2F3'; $('channelMessage').textContent = ''; $('channelDialog').showModal(); }
function openEditChannel(c) { editingChannelId = c.id; $('channelDialogTitle').textContent = 'Editar canal'; $('channelName').value = c.nombre; $('channelColor').value = c.color || '#cfe2f3'; $('colorValue').textContent = $('channelColor').value.toUpperCase(); $('channelMessage').textContent = ''; $('channelDialog').showModal(); }
async function saveChannel(e) {
  e.preventDefault(); const payload = { nombre: $('channelName').value.trim(), color: $('channelColor').value };
  if (!payload.nombre) return;
  const result = editingChannelId === null ? await db.from('canales').insert(payload) : await db.from('canales').update(payload).eq('id', editingChannelId);
  if (result.error) { $('channelMessage').textContent = result.error.message; return; }
  $('channelDialog').close(); await loadChannels(); await loadMonitorSpots(); toast('Canal guardado.');
}
async function deleteChannel(c) {
  if (!confirm(`¿Eliminar el canal “${c.nombre}” y todos sus spots? Esta acción no se puede deshacer.`)) return;
  const { error } = await db.from('canales').delete().eq('id', c.id);
  if (error) return toast('No se pudo eliminar: ' + error.message);
  selectedChannelIds.delete(c.id); await loadChannels(); await loadMonitorSpots(); loadAdminSpots(); toast('Canal eliminado.');
}
function openNewSpot() { if (!$('adminChannelSelect').value) return toast('Primero seleccione un canal.'); editingSpotId = null; $('spotDialogTitle').textContent = 'Nuevo spot'; $('spotChannel').value = $('adminChannelSelect').value; $('spotCode').value = ''; $('spotName').value = ''; $('spotMessage').textContent = ''; $('spotDialog').showModal(); }
async function openEditSpot(s) { editingSpotId = s.id; $('spotDialogTitle').textContent = 'Editar spot'; $('spotChannel').value = s.canal_id; $('spotCode').value = s.codigo; $('spotName').value = s.nombre; $('spotMessage').textContent = ''; $('spotDialog').showModal(); }
async function saveSpot(e) {
  e.preventDefault(); const payload = { canal_id: Number($('spotChannel').value), codigo: $('spotCode').value.trim(), nombre: $('spotName').value.trim() };
  if (!payload.canal_id || !payload.codigo || !payload.nombre) return;
  const result = editingSpotId === null ? await db.from('spots').insert(payload) : await db.from('spots').update(payload).eq('id', editingSpotId);
  if (result.error) { $('spotMessage').textContent = result.error.message; return; }
  $('spotDialog').close(); await loadAdminSpots(); await loadMonitorSpots(); toast('Spot guardado.');
}
async function loadAdminSpots() {
  const channelId = $('adminChannelSelect').value; $('adminSpotList').innerHTML = '';
  if (!channelId) { $('adminSpotList').innerHTML = '<p class="empty">Seleccione un canal.</p>'; return; }
  const { data, error } = await db.from('spots').select('id,canal_id,codigo,nombre').eq('canal_id', channelId).order('nombre');
  if (error) { $('adminSpotList').textContent = error.message; return; }
  if (!data?.length) { $('adminSpotList').innerHTML = '<p class="empty">Este canal todavía no tiene spots.</p>'; return; }
  data.forEach(s => { const row = document.createElement('div'); row.className = 'admin-row'; const info = document.createElement('div'); info.innerHTML = ''; const name = document.createElement('strong'); name.textContent = s.nombre; const code = document.createElement('div'); code.className = 'spot-code'; code.textContent = `ID: ${s.codigo}`; info.append(name, code); const actions = document.createElement('div'); actions.className = 'actions'; actions.append(actionButton('Editar','btn btn-edit',()=>openEditSpot(s)), actionButton('Eliminar','btn btn-delete',()=>deleteSpot(s))); row.append(info,actions); $('adminSpotList').append(row); });
}
async function deleteSpot(s) { if (!confirm(`¿Eliminar el spot “${s.nombre}” (${s.codigo})?`)) return; const { error } = await db.from('spots').delete().eq('id',s.id); if (error) return toast('No se pudo eliminar: '+error.message); await loadAdminSpots(); await loadMonitorSpots(); toast('Spot eliminado.'); }
async function copyId(code) { try { await navigator.clipboard.writeText(code); toast(`ID ${code} copiado.`); } catch { toast('No se pudo copiar. Abra el sitio mediante HTTPS.'); } }
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.classList.remove('show'),2600); }
