(function(){
  const STORAGE_KEY = 'turnord_state_v1';
  const SERVICE_DURATIONS = {
    'Corte de cabello': 30*60,
    'Cerquillo': 15*60,
    'Barba': 25*60,
    'Corte': 20*60
  };

  function fmt2(n){ return String(n).padStart(2,'0'); }
  function formatDuration(secs){ const m = Math.floor(secs/60); const s = secs%60; return `${m}:${fmt2(s)}`; }
  function diffSeconds(aIso, bIso){
    try { const a = new Date(aIso).getTime(); const b = new Date(bIso).getTime(); return Math.max(0, Math.round((b-a)/1000)); } catch(e){ return 0; }
  }
  function averageServiceSeconds(state){
    const list = state.queue.filter(t => t.status==='served' && t.servedAt && (t.startedAt || t.calledAt));
    if (!list.length) return 0;
    const sum = list.reduce((acc,t)=> acc + diffSeconds((t.startedAt || t.calledAt), t.servedAt), 0);
    return Math.round(sum / list.length);
  }
  function setText(id, val){ const el = document.getElementById(id); if (el) el.textContent = val; }
  function qs(sel){ return document.querySelector(sel); }
  function qsid(id){ return document.getElementById(id); }

  // Charts helpers
  let charts = { status: null, services: null };
  function ensureCharts(){
    const ctx1 = document.getElementById('estadisticasChart')?.getContext('2d');
    const ctx2 = document.getElementById('serviciosChart')?.getContext('2d');
    if (ctx1 && !charts.status){
      charts.status = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['En espera','Atendiendo','Atendidos','Cancelados'],
          datasets: [{ data: [0,0,0,0], backgroundColor: ['#93c5fd','#60a5fa','#34d399','#9ca3af'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
    if (ctx2 && !charts.services){
      charts.services = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['Corte de cabello','Cerquillo','Barba','Corte'],
          datasets: [{ label: 'Atendidos', data: [0,0,0,0], backgroundColor: '#60a5fa' }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }
  }
  function updateCharts(state){
    ensureCharts();
    const waiting = state.queue.filter(t=>t.status==='waiting').length;
    const serving = state.queue.filter(t=>t.status==='serving').length;
    const served = state.queue.filter(t=>t.status==='served').length;
    const canceled = state.queue.filter(t=>t.status==='canceled').length;
    if (charts.status){
      charts.status.data.datasets[0].data = [waiting, serving, served, canceled];
      charts.status.update('none');
    }
    const serviceLabels = ['Corte de cabello','Cerquillo','Barba','Corte'];
    const serviceCounts = serviceLabels.map(n => state.queue.filter(t=>t.status==='served' && t.type===n).length);
    if (charts.services){
      charts.services.data.labels = serviceLabels;
      charts.services.data.datasets[0].data = serviceCounts;
      charts.services.update('none');
    }
  }

  function render(state){
    // Fecha/hora
    try {
      const now = new Date();
      setText('fecha-actual', now.toLocaleDateString('es-DO', { weekday:'long', year:'numeric', month:'long', day:'numeric' }));
      setText('hora-actual', now.toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' }));
    } catch(e){}

    // Turno actual
    const cur = TurnoRD.getCurrentTicket();
    let displayCode = '--';
    let displayName = '-';
    if (cur) {
      displayCode = cur.code;
      displayName = cur.name || '-';
    } else {
      const servedList = [...state.queue].filter(t => t.status === 'served' && t.servedAt);
      if (servedList.length) {
        servedList.sort((a,b)=> new Date(b.servedAt).getTime() - new Date(a.servedAt).getTime());
        displayCode = servedList[0].code;
        displayName = servedList[0].name || '-';
      } else if (state.queue.length) {
        const last = [...state.queue].sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime())[0];
        displayCode = last.code;
        displayName = last.name || '-';
      }
    }
    setText('turnoActual', displayCode);
    setText('cliente-actual', displayName);

    // Estimación y progreso
    let estSecs = 0;
    if (cur && cur.type && SERVICE_DURATIONS[cur.type]) estSecs = SERVICE_DURATIONS[cur.type];
    const nowIso = new Date().toISOString();
    if (cur) {
      const startedIso = cur.startedAt || cur.calledAt || null;
      const elapsed = startedIso ? diffSeconds(startedIso, nowIso) : 0;
      const dispEst = estSecs ? `${Math.round(estSecs/60)} min` : '-';
      setText('tiempo-estimado', dispEst);
      setText('tiempo-transcurrido', startedIso ? formatDuration(elapsed) : '-');
      const pct = estSecs ? Math.min(100, Math.round((elapsed/estSecs)*100)) : 0;
      const prog = qsid('progreso-actual'); if (prog) prog.style.width = `${pct}%`;
    } else {
      setText('tiempo-estimado', '-');
      setText('tiempo-transcurrido', '-');
      const prog = qsid('progreso-actual'); if (prog) prog.style.width = '0%';
    }

    // Botón Atender
    const btnAt = qsid('btn-atender'); if (btnAt) {
      const anyWaiting = state.queue.some(t => t.status === 'waiting');
      const canStart = !!((cur && !cur.startedAt) || (!cur && anyWaiting));
      btnAt.disabled = !canStart;
    }

    // En espera
    const waiting = state.queue.filter(t => t.status==='waiting').length;
    setText('turnos-espera', String(waiting));
    const contador = qsid('contador-espera'); if (contador) contador.textContent = `${waiting} turno${waiting===1?'':'s'}`;
    const barBg = qs('#carga-espera'); if (barBg) barBg.style.width = `${Math.min(100, waiting*10)}%`;

    // Lista de espera
    const listEl = qsid('listaEspera'); const emptyEl = qsid('sin-turnos');
    if (listEl){ listEl.innerHTML = '';
      const waitingList = state.queue.map((t, idx)=>({t, idx})).filter(x=> x.t.status==='waiting');
      waitingList.forEach(({t})=>{
        const card = document.createElement('div');
        card.className = 'p-4 rounded-xl border border-blue-100 bg-white shadow-sm';
        card.innerHTML = `
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm text-gray-500">Código</div>
              <div class="text-xl font-bold text-blue-700">${t.code}</div>
            </div>
            <div class="text-right">
              <div class="text-sm text-gray-500">Cliente</div>
              <div class="font-semibold">${t.name || '-'}</div>
            </div>
          </div>
          <div class="mt-2 text-sm text-gray-600">Servicio: <span class="font-medium">${t.type || '-'}</span></div>
        `;
        listEl.appendChild(card);
      });
      if (emptyEl){ emptyEl.style.display = waitingList.length ? 'none' : 'block'; }
    }

    // Promedio e ingresos
    const avg = averageServiceSeconds(state);
    const avgStr = avg ? formatDuration(avg) : '-';
    setText('tiempo-promedio', avgStr);
    setText('avg-servicio', avgStr);
    const rev = (state.revenue && typeof state.revenue.total === 'number') ? state.revenue.total : 0;
    setText('total-revenue', `RD$ ${rev.toFixed(2)}`);

    updateCharts(state);
  }

  // Acciones UI
  window.abrirModal = function(){ const m = qsid('modal'); if (m){ m.classList.remove('hidden'); m.classList.add('flex'); }}
  window.cerrarModal = function(){ const m = qsid('modal'); if (m){ m.classList.add('hidden'); m.classList.remove('flex'); }}
  window.tomarTurno = function(e){ e && e.preventDefault();
    const nombre = qsid('nombre')?.value?.trim() || '';
    const telefono = qsid('telefono')?.value?.trim() || '';
    const servicio = qsid('servicio')?.value || '';
    if (!servicio){ return; }
    TurnoRD.addTicket({ name: nombre, phone: telefono, type: servicio, description: '' });
    cerrarModal();
  }

  window.atenderTurno = function(){
    // Inicia atención: si no hay turno actual, toma el primero en espera
    TurnoRD.startCurrent();
  }

  window.abrirModalCobro = function(){ const m = qsid('modalCobro'); if (m){ m.classList.remove('hidden'); m.classList.add('flex'); }}
  window.cerrarModalCobro = function(){ const m = qsid('modalCobro'); if (m){ m.classList.add('hidden'); m.classList.remove('flex'); qsid('montoCobrado') && (qsid('montoCobrado').value=''); }}
  window.guardarCobro = function(e){ e && e.preventDefault();
    const monto = parseFloat(qsid('montoCobrado')?.value || '0') || 0;
    const metodo = qsid('metodoPago')?.value || 'Efectivo';
    const cur = TurnoRD.getCurrentTicket();
    const servedId = cur?.id || null;
    const startIso = cur && (cur.startedAt || cur.calledAt) ? (cur.startedAt || cur.calledAt) : null;
    const endIso = new Date().toISOString();
    const secs = startIso ? diffSeconds(startIso, endIso) : 0;
    // Avanzar turno usando API existente (marca servido y pasa al siguiente)
    TurnoRD.nextTicket();
    // Persistir cobro y métricas en el ticket recién atendido
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && servedId) {
        const st = JSON.parse(raw);
        const t = st.queue.find(x => x.id === servedId);
        if (t) {
          t.paidAmount = monto;
          t.paymentMethod = metodo;
          t.servedSeconds = secs;
        }
        st.revenue = st.revenue || { total: 0, byMethod: {}, byService: {} };
        st.revenue.total = (st.revenue.total || 0) + monto;
        st.revenue.byMethod[metodo] = (st.revenue.byMethod[metodo] || 0) + monto;
        const svc = (t && t.type) ? t.type : 'Otro';
        st.revenue.byService[svc] = (st.revenue.byService[svc] || 0) + monto;
        st.version = (st.version || 0) + 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
        localStorage.setItem(STORAGE_KEY+':ping', String(Date.now()));
      }
    } catch(_) {}
    try { if (window.Swal){ Swal.fire({ icon:'success', title:'Turno atendido', html:`Tiempo de atención: <b>${formatDuration(secs)}</b>${monto?`<br/>Monto: <b>RD$ ${monto.toFixed(2)}</b> • ${metodo}`:''}`, timer:2500, showConfirmButton:false }); } } catch(e){}
    cerrarModalCobro();
  }

  // Devolver turno actual a espera (mover al final)
  window.devolverTurno = function(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const st = JSON.parse(raw);
      if (st.currentIndex===null) return;
      const now = new Date().toISOString();
      // extraer actual
      const cur = st.queue.splice(st.currentIndex, 1)[0];
      if (!cur) return;
      cur.status = 'waiting';
      delete cur.calledAt; delete cur.startedAt; delete cur.servedAt; delete cur.canceledAt;
      st.queue.push(cur);
      // elegir siguiente waiting
      let nextIdx = null;
      for (let i=0;i<st.queue.length;i++){ if (st.queue[i].status==='waiting'){ nextIdx = i; break; } }
      if (nextIdx===null){ st.currentIndex = null; }
      else { st.currentIndex = nextIdx; st.queue[nextIdx].status='serving'; st.queue[nextIdx].calledAt = now; }
      st.version = (st.version||0)+1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
      localStorage.setItem(STORAGE_KEY+':ping', String(Date.now()));
    }catch(e){ console.warn('devolverTurno error', e); }
  }

  // Suscripción a estado
  try { TurnoRD.subscribe(render); } catch(e) { console.error('TurnoRD no disponible', e); }
  // Render inicial
  try { render(TurnoRD.getState()); } catch(e) {}
  // Reloj
  setInterval(()=>{ try{ const st = TurnoRD.getState(); render(st);}catch(e){} }, 1000);

  // Validaciones simples en inputs del modal
  document.getElementById('telefono')?.addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); });
  document.getElementById('nombre')?.addEventListener('input', function() { this.value = this.value.replace(/[^A-Za-zÁÉÍÓÚá��íóúÑñ ]/g, ''); });

  // Resaltar link activo en sidebar si existe
  document.querySelectorAll('aside nav a').forEach(link => {
    if (window.location.pathname.endsWith(link.getAttribute('href'))) {
      link.classList.add('bg-white', 'text-blue-900', 'font-semibold', 'shadow');
    } else {
      link.classList.remove('bg-white', 'text-blue-900', 'font-semibold', 'shadow');
    }
  });
})();
