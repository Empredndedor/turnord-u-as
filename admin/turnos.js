(function(){
  const STORAGE_KEY = 'turnord_state_v1';

  let SERVICE_DURATIONS = {
    'Corte de cabello': 30*60,
    'Cerquillo': 15*60,
    'Barba': 25*60,
    'Corte': 20*60
  };

  window.updateServiceDurations = function(durationMap) {
      SERVICE_DURATIONS = durationMap;
  };

  function fmt2(n){ return String(n).padStart(2,'0'); }
  function formatDuration(secs){ if(secs === null || secs === undefined) return '--'; const m = Math.floor(secs/60); const s = Math.floor(secs%60); return `${m}:${fmt2(s)}`; }
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

  let charts = { status: null, services: null };
  function ensureCharts(){
    const ctx1 = document.getElementById('estadisticasChart')?.getContext('2d');
    const ctx2 = document.getElementById('serviciosChart')?.getContext('2d');
    if (ctx1 && !charts.status){
      charts.status = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['En espera','Atendiendo','Atendidos','Cancelados'],
          datasets: [{ data: [0,0,0,0], backgroundColor: ['#93c5fd','#34d399','#2563eb','#9ca3af'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
    if (ctx2 && !charts.services){
        const services = window.ServicesManager ? window.ServicesManager.getServices().items.map(s => s.name) : Object.keys(SERVICE_DURATIONS);
        charts.services = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: services,
          datasets: [{ label: 'Atendidos', data: Array(services.length).fill(0), backgroundColor: '#60a5fa' }]
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
    if (charts.services){
      const serviceLabels = charts.services.data.labels;
      const serviceCounts = serviceLabels.map(n => state.queue.filter(t=>t.status==='served' && t.type===n).length);
      charts.services.data.datasets[0].data = serviceCounts;
      charts.services.update('none');
    }
  }

  function render(state){
    try {
      const now = new Date();
      setText('fecha-actual', now.toLocaleDateString('es-DO', { weekday:'long', year:'numeric', month:'long', day:'numeric' }));
      setText('hora-actual', now.toLocaleTimeString('es-DO', { hour:'2-digit', minute:'2-digit' }));
    } catch(e){}

    const oldTurnoActualCard = qsid('turnoActual')?.closest('.bg-white');
    if (oldTurnoActualCard) oldTurnoActualCard.style.display = 'none';

    const servingList = TurnoRD.getServingTickets();
    const waitingList = state.queue.filter(t => t.status==='waiting');

    setText('turnos-espera', String(waitingList.length));
    const contador = qsid('contador-espera');
    if (contador) contador.textContent = `${waitingList.length} turno${waitingList.length===1?'':'s'}`;

    renderServingList(servingList);
    renderWaitingList(waitingList);

    const avg = averageServiceSeconds(state);
    const avgStr = avg ? formatDuration(avg) : '-';
    setText('tiempo-promedio', avgStr);
    setText('avg-servicio', avgStr);
    const rev = (state.revenue && typeof state.revenue.total === 'number') ? state.revenue.total : 0;
    setText('total-revenue', `RD$ ${rev.toFixed(2)}`);

    updateCharts(state);
  }

  function renderServingList(servingList) {
    const listEl = qsid('listaAtencion');
    const emptyEl = qsid('sin-atencion');
    if (!listEl || !emptyEl) return;

    listEl.innerHTML = '';
    if (servingList.length === 0) {
      if (emptyEl.parentNode !== listEl) listEl.appendChild(emptyEl);
      emptyEl.style.display = 'block';
      return;
    }

    if (listEl.contains(emptyEl)) emptyEl.style.display = 'none';

    servingList.sort((a,b) => new Date(a.calledAt) - new Date(b.calledAt)).forEach(t => {
      const card = document.createElement('div');
      card.className = 'p-4 rounded-xl border border-green-200 bg-green-50 shadow-sm cursor-pointer hover:bg-green-100 hover:shadow-md transition-all';
      card.setAttribute('data-ticket-id', t.id);
      card.onclick = () => abrirModalCobro(t.id);

      const now = new Date().toISOString();
      const elapsed = diffSeconds(t.startedAt || t.calledAt, now);

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="text-2xl font-bold text-green-700">${t.code}</div>
          <div class="font-semibold text-green-800">${t.name || '-'}</div>
        </div>
        <div class="mt-2 text-sm text-gray-600">Servicio: <span class="font-medium">${t.type || '-'}</span></div>
        <div class="mt-2 text-sm text-gray-600">Tiempo: <span class="font-medium">${formatDuration(elapsed)}</span></div>
      `;
      listEl.appendChild(card);
    });
  }

  function renderWaitingList(waitingList) {
    const listEl = qsid('listaEspera');
    const emptyEl = qsid('sin-turnos');
    if (!listEl || !emptyEl) return;

    listEl.innerHTML = '';
    if (waitingList.length === 0) {
        if (emptyEl.parentNode !== listEl) listEl.appendChild(emptyEl);
        emptyEl.style.display = 'block';
        return;
    }
    if (listEl.contains(emptyEl)) emptyEl.style.display = 'none';

    waitingList.forEach((t, index) => {
        const card = document.createElement('div');
        card.className = 'p-3 rounded-xl border border-blue-100 bg-white shadow-sm flex flex-col justify-between';

        card.innerHTML = `
          <div>
            <div class="flex items-start justify-between">
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
          </div>
          <div class="mt-3 flex items-center justify-between gap-2">
            <button onclick="TurnoRD.attendTicket('${t.id}')" class="w-full bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition">Atender</button>
            <div class="flex">
              <button onclick="TurnoRD.moveTurn('${t.id}', 'up')" class="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-30" ${index === 0 ? 'disabled' : ''}>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
              </button>
              <button onclick="TurnoRD.moveTurn('${t.id}', 'down')" class="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-30" ${index === waitingList.length - 1 ? 'disabled' : ''}>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7 7"></path></svg>
              </button>
            </div>
          </div>
        `;
        listEl.appendChild(card);
    });
  }

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

  window.abrirModalCobro = function(ticketId){
    const m = qsid('modalCobro');
    if (m){
      m.setAttribute('data-ticket-id', ticketId);
      m.classList.remove('hidden');
      m.classList.add('flex');
    }
  }
  window.cerrarModalCobro = function(){
    const m = qsid('modalCobro');
    if (m){
      m.classList.add('hidden');
      m.classList.remove('flex');
      m.removeAttribute('data-ticket-id');
      const montoInput = qsid('montoCobrado');
      if(montoInput) montoInput.value = '';
    }
  }
  window.guardarCobro = function(e){ e && e.preventDefault();
    const modal = qsid('modalCobro');
    const ticketId = modal?.getAttribute('data-ticket-id');
    if (!ticketId) {
        cerrarModalCobro();
        return;
    }

    const monto = parseFloat(qsid('montoCobrado')?.value || '0') || 0;
    const metodo = qsid('metodoPago')?.value || 'Efectivo';

    const state = TurnoRD.getState();
    const ticket = state.queue.find(t => t.id === ticketId);
    if (!ticket) {
        cerrarModalCobro();
        return;
    }

    const startIso = ticket.startedAt || ticket.calledAt;
    const endIso = new Date().toISOString();
    const secs = startIso ? diffSeconds(startIso, endIso) : 0;

    TurnoRD.markAsServed(ticketId);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const st = JSON.parse(raw);
        const t = st.queue.find(x => x.id === ticketId);
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

        localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
        localStorage.setItem(STORAGE_KEY+':ping', String(Date.now()));
      }
    } catch(e) {
      console.error("Failed to save payment details", e);
    }

    try {
      if (window.Swal){
        Swal.fire({
          icon:'success',
          title:'Turno Atendido',
          html:`Tiempo de atención: <b>${formatDuration(secs)}</b>${monto?`<br/>Monto: <b>RD$ ${monto.toFixed(2)}</b> • ${metodo}`:''}`,
          timer:2500,
          showConfirmButton:false
        });
      }
    } catch(e){}

    cerrarModalCobro();
  }

  try { TurnoRD.subscribe(render); } catch(e) { console.error('TurnoRD no disponible', e); }
  try { render(TurnoRD.getState()); } catch(e) {}
  setInterval(()=>{ try{ const st = TurnoRD.getState(); render(st);}catch(e){} }, 1000);

  document.getElementById('telefono')?.addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); });
  document.getElementById('nombre')?.addEventListener('input', function() { this.value = this.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]/g, ''); });
  document.querySelectorAll('aside nav a').forEach(link => {
    if (window.location.pathname.endsWith(link.getAttribute('href'))) {
      link.classList.add('bg-indigo-700', 'text-white', 'font-semibold', 'shadow');
    } else {
      link.classList.remove('bg-indigo-700', 'text-white', 'font-semibold', 'shadow');
    }
  });
})();
