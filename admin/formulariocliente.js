(function(){
  const PREFIX = 'A';

  // --- Multi-Business Data Segregation ---
  function getActiveBusinessId() {
    // Fallback to a default ID if none is set (e.g., for the client form page)
    return sessionStorage.getItem('activeBusinessId') || 'default';
  }

  function getStorageKey() {
    const businessId = getActiveBusinessId();
    return `turnord_state_v1_${businessId}`;
  }

  function getChannelName() {
    const businessId = getActiveBusinessId();
    return `turnord_channel_v1_${businessId}`;
  }

  let bc = null;
  if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(getChannelName());
      } catch (e) {
        console.error("Error creating BroadcastChannel:", e);
      }
  }
  // --- End of Data Segregation ---

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
      queue: [], // {id, code, name, phone, type, description, status, createdAt, calledAt?, startedAt?, servedAt?, canceledAt?}
      lastNumber: 0,
      servedCount: 0,
      version: 0,
      businessId: getActiveBusinessId() // Store which business this state belongs to
    };
  }

  function readState() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (!raw) return defaultState();
      const st = JSON.parse(raw);
      // If state is from another business or another day, reset.
      if (!st || st.date !== todayStr() || st.businessId !== getActiveBusinessId()) {
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
    const storageKey = getStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(state));
    if (!silent) {
      if (bc) {
        bc.postMessage({ type: 'state:update', version: state.version });
      } else {
        localStorage.setItem(storageKey + ':ping', String(Date.now()));
      }
    }
  }

  function ensureInit() {
    const st = readState();
    writeState(st, true);
    return st;
  }

  function getState(){
    return readState();
  }

  function getWaitingCount(){
    const st = readState();
    return st.queue.filter(t => t.status === 'waiting').length;
  }

  function getServingTickets() {
    const st = readState();
    return st.queue.filter(t => t.status === 'serving');
  }

  function getCurrentTicket(){
    // For client page compatibility, return the one that was called first
    const serving = getServingTickets();
    if (!serving.length) return null;
    return serving.sort((a,b) => new Date(a.calledAt) - new Date(b.calledAt))[0];
  }

  function makeCode(n){
    const num = String(n).padStart(2,'0');
    return PREFIX + num;
  }

  function addTicket({name, phone, type, description}){
    const st = readState();
    const nextNum = st.lastNumber + 1;
    const code = makeCode(nextNum);
    const now = new Date().toISOString();

    const isFirstTicket = st.queue.length === 0;

    const ticket = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      code,
      name: name?.trim() || '',
      phone: phone?.trim() || '',
      type: type || '',
      description: description || '',
      status: 'waiting', // Always start as waiting
      createdAt: now
    };

    st.queue.push(ticket);
    st.lastNumber = nextNum;

    writeState(st);

    const ahead = st.queue.filter(t => t.status === 'waiting' && t.id !== ticket.id).length;
    return { ticket, ahead };
  }

  function attendTicket(ticketId) {
    const st = readState();
    const ticket = st.queue.find(t => t.id === ticketId);
    if (ticket && ticket.status === 'waiting') {
        ticket.status = 'serving';
        ticket.calledAt = new Date().toISOString();
        ticket.startedAt = ticket.startedAt || ticket.calledAt;
        writeState(st);
        return ticket;
    }
    return null;
  }

  function returnToQueue(ticketId) {
    const st = readState();
    const ticket = st.queue.find(t => t.id === ticketId);
    if (ticket && ticket.status === 'serving') {
        ticket.status = 'waiting';
        delete ticket.calledAt;
        delete ticket.startedAt;
        writeState(st);
        return ticket;
    }
    return null;
  }

  function markAsServed(ticketId) {
      const st = readState();
      const ticket = st.queue.find(t => t.id === ticketId);
      if (ticket && ticket.status === 'serving') {
          ticket.status = 'served';
          ticket.servedAt = new Date().toISOString();
          st.servedCount = (st.servedCount || 0) + 1;
          writeState(st);
          return ticket;
      }
      return null;
  }

  function cancelTicket(ticketId) {
    const st = readState();
    const ticket = st.queue.find(t => t.id === ticketId);
    if (ticket) {
        ticket.status = 'canceled';
        ticket.canceledAt = new Date().toISOString();
        writeState(st);
        return ticket;
    }
    return null;
  }

  function resetAll(){
    const st = defaultState();
    writeState(st);
    return st;
  }

  function moveTurn(ticketId, direction) {
      const st = readState();
      const waitingQueue = st.queue.filter(t => t.status === 'waiting');
      const ticketIndex = waitingQueue.findIndex(t => t.id === ticketId);

      if (ticketIndex === -1) return;

      if (direction === 'up' && ticketIndex > 0) {
          const originalIndex = st.queue.findIndex(t => t.id === ticketId);
          const targetId = waitingQueue[ticketIndex - 1].id;
          const targetIndex = st.queue.findIndex(t => t.id === targetId);

          [st.queue[originalIndex], st.queue[targetIndex]] = [st.queue[targetIndex], st.queue[originalIndex]];
          writeState(st);
      } else if (direction === 'down' && ticketIndex < waitingQueue.length - 1) {
          const originalIndex = st.queue.findIndex(t => t.id === ticketId);
          const targetId = waitingQueue[ticketIndex + 1].id;
          const targetIndex = st.queue.findIndex(t => t.id === targetId);

          [st.queue[originalIndex], st.queue[targetIndex]] = [st.queue[targetIndex], st.queue[originalIndex]];
          writeState(st);
      }
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
    const storageKey = getStorageKey();
    if (e.key === storageKey || e.key === storageKey + ':ping') {
      emit();
    }
  });

  function subscribe(cb){
    if (typeof cb !== 'function') return () => {};
    listeners.add(cb);
    cb(readState());
    return () => listeners.delete(cb);
  }

  function initState(){
    ensureInit();
  }

  // Expose NEW and OLD API
  window.TurnoRD = {
    initState,
    getState,
    getServingTickets,
    getWaitingCount,
    addTicket,
    attendTicket,
    markAsServed,
    cancelTicket,
    returnToQueue,
    resetAll,
    moveTurn,
    subscribe,
    // For backward compatibility
    getCurrentTicket,
    nextTicket: () => { // Deprecated but shouldn't break old pages
        const st = readState();
        const firstWaiting = st.queue.find(t => t.status === 'waiting');
        if(firstWaiting) attendTicket(firstWaiting.id);
    },
    startCurrent: () => { /* No-op, handled by attendTicket */ },
    attendCurrent: () => { /* No-op, handled by markAsServed */ },
    cancelCurrent: () => {
        const firstServing = getCurrentTicket();
        if(firstServing) cancelTicket(firstServing.id);
    },
    recallCurrent: () => { /* No-op */ }
  };

  // Initialize at load
  initState();
})();