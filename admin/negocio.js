// admin/negocio.js
// Panel de negocio: configuración, break, ingresos y exportaciones

const CONFIG_KEY = 'turnord_config_v1';
const BREAK_KEY = 'turnord_break_v1';
const HISTORY_KEY = 'turnord_history_v1';
const CHANNEL_NAME = 'turnord_channel_v1';

const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel(CHANNEL_NAME) : null;

function byId(id){ return document.getElementById(id); }
function setText(id, val){ const el = byId(id); if (el) el.textContent = String(val); }
function fmt2(n){ return String(n).padStart(2,'0'); }
function todayStr(){ const d = new Date(); return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`; }
function dateStr(d){ return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`; }
function startOfDayStr(deltaDays=0){ const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+deltaDays); return dateStr(d); }

function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
function writeJSON(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); localStorage.setItem(key+':ping', String(Date.now())); }catch(_){ /*noop*/ } }

function defaultConfig(){
  return {
    hours: { open: '08:00', close: '20:00' },
    limitPerDay: 30,
    openDays: [1,2,3,4,5,6], // 0=domingo
    version: 1
  };
}

function getConfig(){ return readJSON(CONFIG_KEY, defaultConfig()); }
function saveConfig(cfg){ cfg.version = (cfg.version||0)+1; writeJSON(CONFIG_KEY, cfg); bc && bc.postMessage({ type:'config:update', version:cfg.version }); }

function getBreakState(){ return readJSON(BREAK_KEY, { isOn:false, endAt:null, durationMin:30, message:'Estamos en break, regresamos pronto...' }); }
function saveBreakState(state){ writeJSON(BREAK_KEY, state); bc && bc.postMessage({ type:'break:update' }); }

function getHistory(){ return readJSON(HISTORY_KEY, { items:[], version:1 }); }
function saveHistory(hist){ hist.version = (hist.version||0)+1; writeJSON(HISTORY_KEY, hist); bc && bc.postMessage({ type:'history:update', version:hist.version }); }

function parseTimeToMinutes(hhmm){ const [h,m] = (hhmm||'0:0').split(':').map(x=>parseInt(x,10)||0); return h*60+m; }

// Sincroniza historial a partir del estado actual de TurnoRD (solo día de hoy)
function syncTodayHistoryFromState(){
  try{
    if (!window.TurnoRD) return;
    const st = TurnoRD.getState();
    const hist = getHistory();
    const today = todayStr();
    const servedToday = (st.queue||[]).filter(t => t.status==='served' && t.servedAt && new Date(t.servedAt).toISOString().slice(0,10) === today);
    let changed = false;
    servedToday.forEach(t => {
      const exists = hist.items.some(x => x.ticketId===t.id);
      const paid = typeof t.paidAmount==='number' ? t.paidAmount : 0;
      const method = t.paymentMethod || 'N/D';
      const secs = typeof t.servedSeconds==='number' ? t.servedSeconds : 0;
      if (!exists){
        hist.items.push({
          date: today,
          servedAt: t.servedAt,
          ticketId: t.id,
          code: t.code,
          name: t.name||'',
          type: t.type||'',
          paidAmount: paid,
          paymentMethod: method,
          servedSeconds: secs
        });
        changed = true;
      } else {
        // actualizar por si llegó el pago luego
        hist.items = hist.items.map(x => x.ticketId===t.id ? { ...x, paidAmount: paid, paymentMethod: method, servedSeconds: secs, servedAt: t.servedAt } : x);
        changed = true;
      }
    });
    if (changed) saveHistory(hist);
  }catch(e){ console.warn('syncTodayHistoryFromState error', e); }
}

function sumBy(items, key='paidAmount'){ return items.reduce((acc,x)=> acc + (Number(x[key])||0), 0); }
function filterByDate(items, ymd){ return items.filter(x => (x.date || (x.servedAt? x.servedAt.slice(0,10):'')) === ymd); }

function buildLastNDaysLabels(n){ const out=[]; const d=new Date(); d.setHours(0,0,0,0); for (let i=n-1;i>=0;i--){ const dd=new Date(d); dd.setDate(d.getDate()-i); out.push(dateStr(dd)); } return out; }

// UI: fecha/hora y tema
function initShell(){
  function tick(){
    try{
      const now = new Date();
      setText('fecha-actual', now.toLocaleDateString('es-DO', { weekday:'long', year:'numeric', month:'long', day:'numeric' }));
      setText('hora-actual', now.toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' }));
    }catch(_){ }
  }
  tick(); setInterval(tick, 30000);

  const btnMobile = byId('mobile-menu-button');
  const sidebar = byId('sidebar');
  const overlay = byId('sidebar-overlay');
  btnMobile && btnMobile.addEventListener('click', ()=>{
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('opacity-0');
    overlay.classList.toggle('pointer-events-none');
  });
  overlay && overlay.addEventListener('click', ()=>{
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('opacity-0');
    overlay.classList.add('pointer-events-none');
  });

  const themeBtn = byId('theme-toggle');
  themeBtn && themeBtn.addEventListener('click', ()=>{
    document.documentElement.classList.toggle('dark');
  });
}

// UI: Configuración negocio
function initConfig(){
  const cfg = getConfig();
  const inpOpen = byId('hora-apertura'); const inpClose = byId('hora-cierre'); const inpLimit = byId('limite-turnos');
  inpOpen && (inpOpen.value = cfg.hours.open);
  inpClose && (inpClose.value = cfg.hours.close);
  inpLimit && (inpLimit.value = cfg.limitPerDay);
  document.querySelectorAll('.day-btn').forEach(btn => {
    const d = Number(btn.dataset.day);
    const active = cfg.openDays.includes(d);
    if (d===0 && !active) { btn.classList.add('bg-gray-100','dark:bg-gray-700','text-gray-400'); btn.classList.remove('bg-blue-100','dark:bg-blue-900','text-blue-800','dark:text-blue-200'); }
    if (active && d!==0){ btn.classList.add('bg-blue-100','dark:bg-blue-900','text-blue-800','dark:text-blue-200'); btn.classList.remove('bg-gray-100','dark:bg-gray-700','text-gray-400'); }
    btn.addEventListener('click', ()=>{
      const arr = new Set(getConfig().openDays);
      if (arr.has(d)) arr.delete(d); else arr.add(d);
      const newCfg = getConfig(); newCfg.openDays = Array.from(arr).sort(); saveConfig(newCfg);
      initConfig();
    });
  });
  const form = byId('config-form');
  form && form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const newCfg = getConfig();
    newCfg.hours.open = inpOpen.value;
    newCfg.hours.close = inpClose.value;
    newCfg.limitPerDay = Math.max(1, Number(inpLimit.value)||1);
    saveConfig(newCfg);
    if (window.Swal) Swal.fire({ icon:'success', title:'Configuración guardada', timer:1500, showConfirmButton:false });
  });
}

// UI: Break control
let breakTimer = null;
function renderBreak(){
  const st = getBreakState();
  const indicator = byId('break-indicator');
  const text = byId('break-text');
  const boxTime = byId('break-time-remaining');
  const remText = byId('remaining-time');
  const btnText = byId('break-button-text');
  if (!indicator || !text || !btnText) return;
  const now = Date.now();
  let remaining = 0;
  if (st.isOn && st.endAt){ remaining = Math.max(0, Math.round((new Date(st.endAt).getTime() - now)/1000)); }
  if (st.isOn && remaining>0){
    indicator.className = 'w-3 h-3 rounded-full bg-orange-500';
    text.textContent = 'En Break';
    btnText.textContent = 'Finalizar Break';
    boxTime && boxTime.classList.remove('hidden');
    if (remText){ const m = Math.floor(remaining/60); const s = remaining%60; remText.textContent = `${m}:${fmt2(s)}`; }
  } else {
    indicator.className = 'w-3 h-3 rounded-full bg-green-500';
    text.textContent = 'Negocio Abierto';
    btnText.textContent = 'Iniciar Break';
    boxTime && boxTime.classList.add('hidden');
    // autocorrección de estado
    if (st.isOn){ st.isOn=false; st.endAt=null; saveBreakState(st); }
  }
}

function tickBreak(){
  renderBreak();
}

function initBreak(){
  const toggle = byId('toggle-break');
  const inpDur = byId('break-duration');
  const inpMsg = byId('break-message');
  const st = getBreakState();
  inpDur && (inpDur.value = String(st.durationMin||30));
  inpMsg && (inpMsg.value = st.message||'');
  toggle && toggle.addEventListener('click', ()=>{
    const cur = getBreakState();
    if (cur.isOn){
      cur.isOn = false; cur.endAt = null; saveBreakState(cur);
    } else {
      const mins = Math.min(180, Math.max(5, Number(inpDur.value)||30));
      const end = new Date(Date.now() + mins*60*1000).toISOString();
      const msg = (inpMsg.value||'').trim() || 'Estamos en break, regresamos pronto...';
      saveBreakState({ isOn:true, endAt:end, durationMin:mins, message:msg });
    }
    renderBreak();
  });
  if (breakTimer) clearInterval(breakTimer);
  breakTimer = setInterval(tickBreak, 1000);
  renderBreak();
}

// Ingresos, barras y gráfico
let ingresosChart = null;
function renderIngresos(){
  syncTodayHistoryFromState();
  const hist = getHistory();
  const today = todayStr();
  const todayItems = filterByDate(hist.items, today);
  const totalDia = sumBy(todayItems, 'paidAmount');
  setText('ganancia-dia', totalDia.toFixed(2));
  // barras (simples: porcentaje sobre un objetivo hipotético, p.e. 10k)
  const goalDay = 10000; // RD$ 10,000 meta base
  const dayPct = Math.min(100, Math.round((totalDia/goalDay)*100));
  const bd = byId('barra-dia'); bd && (bd.style.width = `${dayPct}%`);

  // Últimos 7 días
  const labels = buildLastNDaysLabels(7);
  const series = labels.map(ymd => sumBy(filterByDate(hist.items, ymd), 'paidAmount'));
  // Semanal = suma 7 días, Mensual = suma 30 días (si hay)
  const labels30 = buildLastNDaysLabels(30);
  const sum30 = labels30.reduce((acc, ymd)=> acc + sumBy(filterByDate(hist.items, ymd), 'paidAmount'), 0);
  const sum7 = series.reduce((a,b)=> a+b, 0);
  setText('ganancia-semana', sum7.toFixed(2));
  setText('ganancia-mes', sum30.toFixed(2));
  const bs = byId('barra-semana'); bs && (bs.style.width = `${Math.min(100, Math.round((sum7/(goalDay*7))*100))}%`);
  const bm = byId('barra-mes'); bm && (bm.style.width = `${Math.min(100, Math.round((sum30/(goalDay*30))*100))}%`);

  // Gráfico
  const ctx = document.getElementById('ingresos-chart');
  if (!ctx) return;
  if (!ingresosChart){
    ingresosChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label:'Ingresos', data: series, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.15)', fill:true, tension:0.25 }] },
      options: { responsive:true, scales: { y: { beginAtZero:true } } }
    });
  } else {
    ingresosChart.data.labels = labels;
    ingresosChart.data.datasets[0].data = series;
    ingresosChart.update('none');
  }
}

// Exportar a Excel (día actual)
function initExport(){
  const btn = byId('exportExcel');
  btn && btn.addEventListener('click', ()=>{
    try{
      syncTodayHistoryFromState();
      const hist = getHistory();
      const today = todayStr();
      const items = filterByDate(hist.items, today).map(x => ({
        Fecha: x.date,
        Codigo: x.code,
        Cliente: x.name,
        Servicio: x.type,
        Monto: x.paidAmount,
        Metodo: x.paymentMethod,
        'Segundos Atención': x.servedSeconds
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(items);
      XLSX.utils.book_append_sheet(wb, ws, 'IngresosDia');
      const fname = `Ingresos_${today}.xlsx`;
      XLSX.writeFile(wb, fname);
    }catch(e){ console.error(e); alert('No se pudo exportar.'); }
  });
}

function initSubscriptions(){
  if (window.TurnoRD){
    try { TurnoRD.subscribe(()=>{ renderIngresos(); }); } catch(_){ }
  }
  if (bc){
    bc.onmessage = (ev)=>{
      if (!ev || !ev.data) return;
      if (ev.data.type === 'state:update') { renderIngresos(); }
      if (ev.data.type === 'config:update') { initConfig(); }
      if (ev.data.type === 'break:update') { renderBreak(); }
      if (ev.data.type === 'history:update') { renderIngresos(); }
    };
  }
  window.addEventListener('storage', (e)=>{
    if ([HISTORY_KEY, HISTORY_KEY+':ping'].includes(e.key)) renderIngresos();
    if ([CONFIG_KEY, CONFIG_KEY+':ping'].includes(e.key)) initConfig();
    if ([BREAK_KEY, BREAK_KEY+':ping'].includes(e.key)) renderBreak();
  });
}

// Init
initShell();
initConfig();
initBreak();
initExport();
renderIngresos();
initSubscriptions();
