// admin/negocio.js
// Panel de negocio: configuración, break, ingresos y exportaciones
// AHORA BASADO EN BASE DE DATOS

import { getBusinessConfig, saveBusinessConfig, getBreakState, saveBreakState, getServedTicketsForDateRange } from './db_schema.js';

// Se asume que el script de routing (a crear en el paso 3) ha definido 'window.currentBusiness'.
// Este objeto contiene { id, name, slug } del negocio actual.
const getBusinessId = () => window.currentBusiness?.id;

const CHANNEL_NAME = 'turnord_channel_v1';
const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel(CHANNEL_NAME) : null;

// --- Helpers ---
function byId(id){ return document.getElementById(id); }
function setText(id, val){ const el = byId(id); if (el) el.textContent = String(val); }
function fmt2(n){ return String(n).padStart(2,'0'); }
function dateStr(d){ return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`; }
function todayStr(){ return dateStr(new Date()); }

// --- UI Shell (sin cambios) ---
function initShell(){
  function tick(){
    try{
      const now = new Date();
      setText('fecha-actual', now.toLocaleDateString('es-DO', { weekday:'long', year:'numeric', month:'long', day:'numeric' }));
      setText('hora-actual', now.toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' }));
    }catch(_){ /*noop*/ }
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

// --- UI: Configuración (Ahora Async) ---
async function initConfig(){
  const businessId = getBusinessId();
  if (!businessId) return;

  const cfg = await getBusinessConfig(businessId);

  const inpOpen = byId('hora-apertura'); const inpClose = byId('hora-cierre'); const inpLimit = byId('limite-turnos');
  inpOpen && (inpOpen.value = cfg.hours.open);
  inpClose && (inpClose.value = cfg.hours.close);
  inpLimit && (inpLimit.value = cfg.limit_per_day);

  document.querySelectorAll('.day-btn').forEach(btn => {
    const d = Number(btn.dataset.day);
    const openDays = cfg.open_days || [];
    const active = openDays.includes(d);
    if (d===0 && !active) { btn.classList.add('bg-gray-100','dark:bg-gray-700','text-gray-400'); btn.classList.remove('bg-blue-100','dark:bg-blue-900','text-blue-800','dark:text-blue-200'); }
    if (active && d!==0){ btn.classList.add('bg-blue-100','dark:bg-blue-900','text-blue-800','dark:text-blue-200'); btn.classList.remove('bg-gray-100','dark:bg-gray-700','text-gray-400'); }

    btn.addEventListener('click', async () => {
      const currentCfg = await getBusinessConfig(businessId);
      const arr = new Set(currentCfg.open_days || []);
      if (arr.has(d)) arr.delete(d); else arr.add(d);
      currentCfg.openDays = Array.from(arr).sort();
      // Mapeo para saveBusinessConfig
      const newCfg = {
        hours: currentCfg.hours,
        limitPerDay: currentCfg.limit_per_day,
        openDays: currentCfg.openDays
      };
      await saveBusinessConfig(businessId, newCfg);
      await initConfig(); // Recargar para reflejar cambios
    });
  });

  const form = byId('config-form');
  form && form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const newCfg = {
        hours: { open: inpOpen.value, close: inpClose.value },
        limitPerDay: Math.max(1, Number(inpLimit.value)||1),
        openDays: (await getBusinessConfig(businessId)).open_days // mantener los días existentes
    };
    await saveBusinessConfig(businessId, newCfg);
    if (window.Swal) Swal.fire({ icon:'success', title:'Configuración guardada', timer:1500, showConfirmButton:false });
  });
}

// --- UI: Break control (Ahora Async) ---
let breakTimer = null;
async function renderBreak(){
  const businessId = getBusinessId();
  if (!businessId) return;

  const st = await getBreakState(businessId);
  const indicator = byId('break-indicator');
  const text = byId('break-text');
  const boxTime = byId('break-time-remaining');
  const remText = byId('remaining-time');
  const btnText = byId('break-button-text');
  if (!indicator || !text || !btnText) return;

  const now = Date.now();
  let remaining = 0;
  if (st.is_on && st.end_at){ remaining = Math.max(0, Math.round((new Date(st.end_at).getTime() - now)/1000)); }

  if (st.is_on && remaining > 0){
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
    if (st.is_on){
      st.isOn = false; st.endAt = null;
      await saveBreakState(businessId, st);
    }
  }
}

function tickBreak(){ renderBreak(); }

async function initBreak(){
    const businessId = getBusinessId();
    if(!businessId) return;

    const toggle = byId('toggle-break');
    const inpDur = byId('break-duration');
    const inpMsg = byId('break-message');

    const st = await getBreakState(businessId);
    inpDur && (inpDur.value = String(st.duration_min || 30));
    inpMsg && (inpMsg.value = st.message || '');

    toggle && toggle.addEventListener('click', async () => {
        const cur = await getBreakState(businessId);
        if (cur.is_on){
            cur.isOn = false; cur.endAt = null;
        } else {
            const mins = Math.min(180, Math.max(5, Number(inpDur.value)||30));
            cur.isOn = true;
            cur.endAt = new Date(Date.now() + mins*60*1000).toISOString();
            cur.durationMin = mins;
            cur.message = (inpMsg.value||'').trim() || 'Estamos en break, regresamos pronto...';
        }
        await saveBreakState(businessId, cur);
        await renderBreak();
    });

    if (breakTimer) clearInterval(breakTimer);
    breakTimer = setInterval(tickBreak, 1000);
    await renderBreak();
}

// --- Ingresos, barras y gráfico (Ahora desde DB) ---
let ingresosChart = null;
function sumBy(items, key='paid_amount'){ return items.reduce((acc,x)=> acc + (Number(x[key])||0), 0); }
function filterByDate(items, ymd){ return items.filter(x => (x.served_at ? x.served_at.slice(0,10) : '') === ymd); }
function buildLastNDaysLabels(n){ const out=[]; const d=new Date(); d.setHours(0,0,0,0); for (let i=n-1;i>=0;i--){ const dd=new Date(d); dd.setDate(d.getDate()-i); out.push(dateStr(dd)); } return out; }

async function renderIngresos(){
    const businessId = getBusinessId();
    if(!businessId) return;

    const today = todayStr();
    const thirtyDaysAgo = dateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const historyItems = await getServedTicketsForDateRange(businessId, thirtyDaysAgo, today);

    const todayItems = filterByDate(historyItems, today);
    const totalDia = sumBy(todayItems, 'paid_amount');
    setText('ganancia-dia', totalDia.toFixed(2));

    const goalDay = 10000;
    const dayPct = Math.min(100, Math.round((totalDia/goalDay)*100));
    const bd = byId('barra-dia'); bd && (bd.style.width = `${dayPct}%`);

    const labels7 = buildLastNDaysLabels(7);
    const series7 = labels7.map(ymd => sumBy(filterByDate(historyItems, ymd), 'paid_amount'));
    const sum7 = series7.reduce((a,b)=> a+b, 0);
    setText('ganancia-semana', sum7.toFixed(2));

    const labels30 = buildLastNDaysLabels(30);
    const sum30 = labels30.reduce((acc, ymd) => acc + sumBy(filterByDate(historyItems, ymd), 'paid_amount'), 0);
    setText('ganancia-mes', sum30.toFixed(2));

    const bs = byId('barra-semana'); bs && (bs.style.width = `${Math.min(100, Math.round((sum7/(goalDay*7))*100))}%`);
    const bm = byId('barra-mes'); bm && (bm.style.width = `${Math.min(100, Math.round((sum30/(goalDay*30))*100))}%`);

    const ctx = document.getElementById('ingresos-chart');
    if (!ctx) return;
    if (!ingresosChart){
        ingresosChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels7, datasets: [{ label:'Ingresos (7 días)', data: series7, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.15)', fill:true, tension:0.25 }] },
            options: { responsive:true, scales: { y: { beginAtZero:true } } }
        });
    } else {
        ingresosChart.data.labels = labels7;
        ingresosChart.data.datasets[0].data = series7;
        ingresosChart.update('none');
    }
}

// --- Exportar a Excel (Ahora desde DB) ---
async function initExport(){
  const btn = byId('exportExcel');
  btn && btn.addEventListener('click', async ()=>{
    const businessId = getBusinessId();
    if(!businessId) return alert('No se ha seleccionado un negocio.');

    try{
      const today = todayStr();
      const items = (await getServedTicketsForDateRange(businessId, today, today)).map(x => ({
        Fecha: x.served_at ? x.served_at.slice(0,10) : '',
        Codigo: x.code,
        Cliente: x.name,
        Servicio: x.type,
        Monto: x.paid_amount,
        Metodo: x.payment_method,
        'Segundos Atención': x.served_seconds
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(items);
      XLSX.utils.book_append_sheet(wb, ws, 'IngresosDia');
      const fname = `Ingresos_${today}.xlsx`;
      XLSX.writeFile(wb, fname);
    }catch(e){ console.error(e); alert('No se pudo exportar.'); }
  });
}

// --- Suscripciones ---
function initSubscriptions(){
  // El broadcast channel puede seguir siendo útil para forzar un refresh en otras pestañas
  if (bc){
    bc.onmessage = (ev)=>{
      if (!ev || !ev.data) return;
      if (ev.data.type === 'config:update') { initConfig(); }
      if (ev.data.type === 'break:update') { renderBreak(); }
      // Para los ingresos, dependemos del estado de TurnoRD que ya tiene su propio listener de Supabase
    };
  }
  // El listener de TurnoRD (que escucha la tabla tickets) ahora también puede refrescar los ingresos
  if (window.TurnoRD) {
      try { TurnoRD.subscribe(() => { renderIngresos(); }); } catch(_) {}
  }
}

// --- Init Async ---
async function main() {
    // Se asume que el router ya ha puesto 'window.currentBusiness'
    if (!getBusinessId()) {
        console.log("Esperando a que el router defina el negocio...");
        // Podríamos tener un evento custom o un simple timeout para reintentar
        setTimeout(main, 100);
        return;
    }
    console.log(`Inicializando panel para el negocio: ${window.currentBusiness.name}`);
    initShell();
    await initConfig();
    await initBreak();
    initExport();
    await renderIngresos();
    initSubscriptions();
}

main();
