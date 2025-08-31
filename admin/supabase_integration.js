// admin/supabase_integration.js
// Integración de Supabase para sincronizar turnos (tickets) en tiempo real

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CONFIGURACIÓN: Reemplaza con tus credenciales de Supabase
const SUPABASE_URL = 'https://fyiildgdepukxhzxfadz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aWlsZGdkZXB1a3hoenhmYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3Mzc1MTQsImV4cCI6MjA2OTMxMzUxNH0.XmLnBvO0RXdBUGwtzx1zTn0GQYSAsD0FFDm7ibo85YQ';

// --- Multi-tenancy Support (URL-based) ---
// The router script sets window.currentBusiness globally.
const getBusinessId = () => window.currentBusiness?.id;

// The turn queue state is still stored in localStorage but is now keyed by the business ID.
const STORAGE_KEY_BASE = 'turnord_state_v1';
function getStorageKey() {
    const businessId = getBusinessId();
    if (!businessId) return null; // Return null if no business is set
    return `${businessId}_${STORAGE_KEY_BASE}`;
}

const PREFIX = 'A'; // Prefijo para el código de turno

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Utilidades ---
function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

// --- Local State for Turn Queue ---
function readLocalState() {
  try {
    const storageKey = getStorageKey();
    if (!storageKey) return { date: todayStr(), queue: [], currentIndex: null, lastNumber: 0, servedCount: 0, version: 0 };
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { date: todayStr(), queue: [], currentIndex: null, lastNumber: 0, servedCount: 0, version: 0 };
    const st = JSON.parse(raw);
    if (!st || st.date !== todayStr()) {
      return { date: todayStr(), queue: [], currentIndex: null, lastNumber: 0, servedCount: 0, version: 0 };
    }
    return st;
  } catch (_) {
    return { date: todayStr(), queue: [], currentIndex: null, lastNumber: 0, servedCount: 0, version: 0 };
  }
}

let suppressLocalSync = false;
function writeLocalState(st) {
  try {
    const storageKey = getStorageKey();
    if (!storageKey) return;
    suppressLocalSync = true;
    localStorage.setItem(storageKey, JSON.stringify(st));
    localStorage.setItem(storageKey + ':ping', String(Date.now()));
  } finally {
    setTimeout(() => { suppressLocalSync = false; }, 50);
  }
}

// --- Data Mapping ---
function rowFromTicket(t) {
  return {
    id: t.id,
    tenant_id: getBusinessId(), // Use the dynamic business ID
    business_date: todayStr(),
    code: t.code || null,
    name: t.name || null,
    phone: t.phone || null,
    type: t.type || null,
    description: t.description || null,
    status: t.status || 'waiting',
    created_at: t.createdAt || null,
    called_at: t.calledAt || null,
    started_at: t.startedAt || null,
    served_at: t.servedAt || null,
    canceled_at: t.canceledAt || null,
    paid_amount: typeof t.paidAmount === 'number' ? t.paidAmount : null,
    payment_method: t.paymentMethod || null,
    served_seconds: typeof t.servedSeconds === 'number' ? t.servedSeconds : null,
    version: typeof t.version === 'number' ? t.version : null
  };
}

function ticketFromRow(r) {
  return {
    id: r.id,
    code: r.code || null,
    name: r.name || '',
    phone: r.phone || '',
    type: r.type || '',
    description: r.description || '',
    status: r.status || 'waiting',
    createdAt: r.created_at || null,
    calledAt: r.called_at || null,
    startedAt: r.started_at || null,
    servedAt: r.served_at || null,
    canceledAt: r.canceled_at || null,
    paidAmount: typeof r.paid_amount === 'number' ? r.paid_amount : undefined,
    paymentMethod: r.payment_method || undefined,
    servedSeconds: typeof r.served_seconds === 'number' ? r.served_seconds : undefined,
    version: typeof r.version === 'number' ? r.version : undefined
  };
}

// --- Queue Logic ---
function computeCurrentIndex(queue) {
  const idx = queue.findIndex(t => t.status === 'serving');
  return idx >= 0 ? idx : null;
}

function computeLastNumber(queue) {
  let maxNum = 0;
  for (const t of queue) {
    if (t && typeof t.code === 'string' && t.code.startsWith(PREFIX)) {
      const n = parseInt(t.code.slice(PREFIX.length), 10);
      if (!isNaN(n)) maxNum = Math.max(maxNum, n);
    }
  }
  return maxNum;
}

// --- Supabase Functions ---
async function fetchRemoteTickets() {
  const businessId = getBusinessId();
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('tenant_id', businessId)
    .eq('business_date', todayStr())
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function upsertTickets(rows) {
  if (!rows || !rows.length) return;
  const { error } = await supabase.from('tickets').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

async function updateTicket(id, patch) {
  const { error } = await supabase.from('tickets').update(patch).eq('id', id);
  if (error) throw error;
}

// --- Sync Logic ---
async function initialMerge() {
  try {
    const remote = await fetchRemoteTickets();
    const local = readLocalState();

    if (remote && remote.length) {
      const queue = remote.map(ticketFromRow);
      const st = {
        date: todayStr(),
        queue,
        currentIndex: computeCurrentIndex(queue),
        lastNumber: computeLastNumber(queue),
        servedCount: queue.filter(t => t.status === 'served').length,
        version: (local.version || 0) + 1
      };
      writeLocalState(st);
    } else if (local.queue && local.queue.length) {
      const rows = local.queue.map(rowFromTicket);
      await upsertTickets(rows);
    }
  } catch (e) {
    console.warn('Supabase initial merge warning:', e.message || e);
  }
}

async function pushLocalToRemote() {
  try {
    const st = readLocalState();
    const rows = (st.queue || []).map(rowFromTicket);
    if (rows.length) {
      await upsertTickets(rows);
    }
  } catch (e) {
    console.warn('Supabase push warning:', e.message || e);
  }
}

function applyRemoteChangeToLocal(row, eventType) {
  const st = readLocalState();
  const q = Array.isArray(st.queue) ? [...st.queue] : [];

  if (eventType === 'DELETE') {
    const id = row?.id;
    const idx = q.findIndex(t => t.id === id);
    if (idx >= 0) q.splice(idx, 1);
  } else {
    const t = ticketFromRow(row);
    const idx = q.findIndex(x => x.id === t.id);
    if (idx >= 0) q[idx] = { ...q[idx], ...t };
    else q.push(t);
  }

  const stNew = {
    date: todayStr(),
    queue: q,
    currentIndex: computeCurrentIndex(q),
    lastNumber: computeLastNumber(q),
    servedCount: q.filter(t => t.status === 'served').length,
    version: (st.version || 0) + 1
  };
  writeLocalState(stNew);
}

function subscribeRealtime() {
  const businessId = getBusinessId();
  if (!businessId) return null;

  const channel = supabase.channel(`realtime-tickets-${businessId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `tenant_id=eq.${businessId}` }, (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      if (row.business_date !== todayStr()) return;
      applyRemoteChangeToLocal(row, payload.eventType);
    })
    .subscribe((status) => {
      // console.log(`Realtime status for ${businessId}:`, status);
    });
  return channel;
}

function setupLocalListeners() {
  window.addEventListener('storage', (e) => {
    if (suppressLocalSync) return;
    const storageKey = getStorageKey();
    if (!storageKey) return;
    if (e.key === storageKey || e.key === storageKey + ':ping') {
      pushLocalToRemote();
    }
  });
}

async function onPaymentUpdate(id, payload) {
  if (!id) return;
  const patch = {};
  if (typeof payload?.paid_amount === 'number') patch.paid_amount = payload.paid_amount;
  if (typeof payload?.served_seconds === 'number') patch.served_seconds = payload.served_seconds;
  if (payload?.payment_method) patch.payment_method = payload.payment_method;
  if (payload?.served_at) patch.served_at = payload.served_at;
  try { await updateTicket(id, patch); } catch (e) { console.warn('Supabase payment update warning:', e.message || e); }
}

async function init() {
    if (!getBusinessId()) {
        console.log("Supabase Sync: Waiting for business to be defined by router...");
        document.addEventListener('businessReady', init, { once: true });
        return;
    }
    console.log("Supabase Sync: Initializing...");
    await initialMerge();
    subscribeRealtime();
    setupLocalListeners();
    await pushLocalToRemote();
}

// --- Global API ---
window.SupaSync = {
  init,
  pushLocalToRemote,
  onPaymentUpdate,
  supabase
};

init();
