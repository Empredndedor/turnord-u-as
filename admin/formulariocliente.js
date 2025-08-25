(function(){
  const STORAGE_KEY = 'turnord_state_v1';
  const CHANNEL_NAME = 'turnord_channel_v1';
  const PREFIX = 'A';

  const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel(CHANNEL_NAME) : null;

  function todayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function defaultState() {
    return {
      date: todayStr(),
      queue: [], // {id, code, name, phone, type, description, status, createdAt, calledAt?, servedAt?, canceledAt?}
      currentIndex: null,
      lastNumber: 0,
      servedCount: 0,
      version: 0
    };
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const st = JSON.parse(raw);
      if (!st || st.date !== todayStr()) {
        return defaultState();
      }
      return st;
    } catch (e) {
      console.warn('TurnoRD: error reading state, resetting', e);
      return defaultState();
    }
  }

  function writeState(state, silent=false) {
    state.version = (state.version || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!silent) {
      if (bc) {
        bc.postMessage({ type: 'state:update', version: state.version });
      } else {
        // Fallback: bump a ping key to trigger storage events
        localStorage.setItem(STORAGE_KEY+':ping', String(Date.now()));
      }
    }
  }

  function ensureInit() {
    const st = readState();
    // If outdated date, defaultState() already handled via readState
    writeState(st, true); // ensure it exists without broadcasting
    return st;
  }

  function getState(){
    return readState();
  }

  function getWaitingCount(){
    const st = readState();
    return st.queue.filter(t => t.status === 'waiting').length + (st.currentIndex===null?0:0);
  }

  function getCurrentTicket(){
    const st = readState();
    if (st.currentIndex === null) return null;
    return st.queue[st.currentIndex] || null;
  }

  function makeCode(n){
    // 2-digit padding up to 99, then grows naturally
    const num = String(n).padStart(2,'0');
    return PREFIX + num;
  }

  function addTicket({name, phone, type, description}){
    const st = readState();
    const nextNum = st.lastNumber + 1;
    const code = makeCode(nextNum);
    const now = new Date().toISOString();
    const ticket = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      code,
      name: name?.trim() || '',
      phone: phone?.trim() || '',
      type: type || '',
      description: description || '',
      status: st.currentIndex === null && st.queue.length === 0 ? 'serving' : 'waiting',
      createdAt: now
    };

    st.queue.push(ticket);
    st.lastNumber = nextNum;

    if (st.currentIndex === null && st.queue.length === 1) {
      st.currentIndex = 0;
      st.queue[0].calledAt = now;
    }

    writeState(st);

    const ahead = st.currentIndex === null ? 0 : st.queue.filter((t,i)=> i>=(st.currentIndex||0) && t.status==='waiting').length;
    return { ticket, ahead };
  }

  function findNextWaitingIndex(st){
    for (let i = (st.currentIndex==null?0:st.currentIndex+1); i < st.queue.length; i++){
      if (st.queue[i].status === 'waiting') return i;
    }
    // If none after current, try from start
    for (let i = 0; i < (st.currentIndex==null?0:st.currentIndex); i++){
      if (st.queue[i].status === 'waiting') return i;
    }
    return null;
  }

  function nextTicket(){
    const st = readState();
    const now = new Date().toISOString();

    if (st.currentIndex !== null) {
      const cur = st.queue[st.currentIndex];
      if (cur && cur.status === 'serving') {
        cur.status = 'served';
        cur.servedAt = now;
        st.servedCount += 1;
      }
    }

    const nextIdx = findNextWaitingIndex(st);
    if (nextIdx === null) {
      st.currentIndex = null;
    } else {
      st.currentIndex = nextIdx;
      st.queue[nextIdx].status = 'serving';
      st.queue[nextIdx].calledAt = now;
    }

    writeState(st);
    return getCurrentTicket();
  }

  function recallCurrent(){
    const st = readState();
    if (st.currentIndex === null) return null;
    const cur = st.queue[st.currentIndex];
    if (!cur) return null;
    cur.calledAt = new Date().toISOString();
    writeState(st);
    return cur;
  }

  function startCurrent(){
    const st = readState();
    const now = new Date().toISOString();
    // Si no hay turno actual, tomar el primero en espera y asignarlo
    if (st.currentIndex === null) {
      let nextIdx = null;
      for (let i = 0; i < st.queue.length; i++) {
        if (st.queue[i].status === 'waiting') { nextIdx = i; break; }
      }
      if (nextIdx === null) return null;
      st.currentIndex = nextIdx;
      st.queue[nextIdx].status = 'serving';
      st.queue[nextIdx].calledAt = st.queue[nextIdx].calledAt || now;
    }
    const cur = st.queue[st.currentIndex];
    if (!cur) return null;
    if (!cur.calledAt) cur.calledAt = now;
    cur.startedAt = now;
    writeState(st);
    return cur;
  }

  function attendCurrent(){
    // alias to nextTicket (mark served then advance)
    return nextTicket();
  }

  function cancelCurrent(){
    const st = readState();
    const now = new Date().toISOString();
    if (st.currentIndex === null) return null;
    const cur = st.queue[st.currentIndex];
    if (cur) {
      cur.status = 'canceled';
      cur.canceledAt = now;
    }
    const next = findNextWaitingIndex(st);
    if (next === null) st.currentIndex = null; else {
      st.currentIndex = next;
      st.queue[next].status = 'serving';
      st.queue[next].calledAt = now;
    }
    writeState(st);
    return getCurrentTicket();
  }

  function resetAll(){
    const st = defaultState();
    writeState(st);
    return st;
  }

  // Subscription mechanism
  const listeners = new Set();
  function emit(){
    const st = readState();
    listeners.forEach(cb => {
      try { cb(st); } catch(e){ console.error(e); }
    });
  }

  if (bc) {
    bc.onmessage = (ev) => {
      if (ev && ev.data && ev.data.type === 'state:update') {
        emit();
      }
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === STORAGE_KEY+':ping') {
      emit();
    }
  });

  function subscribe(cb){
    if (typeof cb !== 'function') return () => {};
    listeners.add(cb);
    // immediate push
    cb(readState());
    return () => listeners.delete(cb);
  }

  function initState(){
    ensureInit();
  }

  // Expose API
  window.TurnoRD = {
    initState,
    getState,
    getCurrentTicket,
    getWaitingCount,
    addTicket,
    nextTicket,
    recallCurrent,
    startCurrent,
    attendCurrent,
    cancelCurrent,
    resetAll,
    subscribe
  };

  // Initialize at load
  initState();
})();