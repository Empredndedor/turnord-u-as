// admin/services.js
// Gestión de servicios para el negocio y sincronización entre formulariocliente.html y turnos.html

function getActiveBusinessId() {
  return sessionStorage.getItem('activeBusinessId') || 'default';
}

function getServicesKey() { return `turnord_services_v1_${getActiveBusinessId()}`; }
function getWaitingTimesKey() { return `turnord_waiting_times_v1_${getActiveBusinessId()}`; }
function getClientHistoryKey() { return `turnord_client_history_v1_${getActiveBusinessId()}`; }
function getChannelName() { return `turnord_channel_v1_${getActiveBusinessId()}`; }

let bc = null;
if (typeof BroadcastChannel !== 'undefined') {
  try {
    bc = new BroadcastChannel(getChannelName());
  } catch (e) {
    console.error("Error creating BroadcastChannel:", e);
  }
}

// Funciones de utilidad
function byId(id) { return document.getElementById(id); }
function readJSON(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(_) { return fallback; } }
function writeJSON(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); localStorage.setItem(key+':ping', String(Date.now())); } catch(_) { /*noop*/ } }

// Función para formatear duración en minutos y segundos
function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Función para calcular diferencia en segundos entre dos fechas ISO
function diffSeconds(isoStart, isoEnd) {
  if (!isoStart || !isoEnd) return 0;
  const start = new Date(isoStart).getTime();
  const end = new Date(isoEnd).getTime();
  return Math.max(0, (end - start) / 1000);
}

// Funciones para gestionar servicios
function getServices() {
  const services = readJSON(getServicesKey(), { items: [], version: 1 });
  
  // Si no hay servicios, inicializar con servicios predeterminados
  if (services.items.length === 0) {
    const defaultServices = [
      { id: 'service_1', name: 'Manicure clásico', duration: 30, price: 500 },
      { id: 'service_2', name: 'Manicure en gel', duration: 45, price: 800 },
      { id: 'service_3', name: 'Uñas acrílicas', duration: 60, price: 1200 },
      { id: 'service_4', name: 'Cambio de esmalte', duration: 15, price: 300 },
      { id: 'service_5', name: 'Decoración personalizada', duration: 30, price: 400 },
      { id: 'service_6', name: 'Retiro de acrílicas o gel', duration: 30, price: 500 },
      { id: 'service_7', name: 'Pedicure sencillo', duration: 45, price: 600 },
      { id: 'service_8', name: 'Pedicure con gel', duration: 60, price: 900 },
      { id: 'service_9', name: 'Eliminación de durezas y callos', duration: 30, price: 400 }
    ];
    
    services.items = defaultServices;
    saveServices(services);
  }
  
  return services;
}

function saveServices(services) {
  services.version = (services.version || 0) + 1;
  writeJSON(getServicesKey(), services);
  bc && bc.postMessage({ type: 'services:update', version: services.version });
}

function addService(name, duration, price) {
  const services = getServices();
  const id = `service_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  services.items.push({
    id,
    name: name.trim(),
    duration: parseInt(duration, 10) || 30,
    price: parseFloat(price) || 0,
    createdAt: new Date().toISOString()
  });
  
  saveServices(services);
  return id;
}

function updateService(id, name, duration, price) {
  const services = getServices();
  const index = services.items.findIndex(s => s.id === id);
  
  if (index !== -1) {
    services.items[index] = {
      ...services.items[index],
      name: name.trim(),
      duration: parseInt(duration, 10) || 30,
      price: parseFloat(price) || 0,
      updatedAt: new Date().toISOString()
    };
    
    saveServices(services);
    return true;
  }
  
  return false;
}

function deleteService(id) {
  const services = getServices();
  const initialLength = services.items.length;
  
  services.items = services.items.filter(s => s.id !== id);
  
  if (services.items.length !== initialLength) {
    saveServices(services);
    return true;
  }
  
  return false;
}

// Inicialización y renderizado de UI
function renderServices() {
  const services = getServices();
  const tbody = byId('services-body');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  services.items.forEach(service => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
    tr.innerHTML = `
      <td class="py-3 px-4 text-gray-800 dark:text-gray-200">${service.name}</td>
      <td class="py-3 px-4 text-gray-800 dark:text-gray-200">${service.duration}</td>
      <td class="py-3 px-4 text-gray-800 dark:text-gray-200">RD$ ${service.price.toFixed(2)}</td>
      <td class="py-3 px-4">
        <div class="flex space-x-2">
          <button class="edit-service text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors" data-id="${service.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="delete-service text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors" data-id="${service.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Agregar event listeners para editar y eliminar
  document.querySelectorAll('.edit-service').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.getAttribute('data-id');
      const service = services.items.find(s => s.id === id);
      
      if (service) {
        // Llenar el formulario con los datos del servicio
        byId('service-name').value = service.name;
        byId('service-duration').value = service.duration;
        byId('service-price').value = service.price;
        
        // Cambiar el botón de agregar a actualizar
        const addBtn = byId('add-service');
        addBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Actualizar servicio
        `;
        addBtn.setAttribute('data-mode', 'update');
        addBtn.setAttribute('data-id', id);
      }
    });
  });
  
  document.querySelectorAll('.delete-service').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.getAttribute('data-id');
      const service = services.items.find(s => s.id === id);
      
      if (service && window.confirm(`¿Estás seguro de eliminar el servicio "${service.name}"?`)) {
        deleteService(id);
        renderServices();
      }
    });
  });
}

function initServiceForm() {
  const form = byId('service-form');
  const addBtn = byId('add-service');
  
  if (!form || !addBtn) return;
  
  form.addEventListener('submit', function(e) {
    e.preventDefault();
  });
  
  addBtn.addEventListener('click', function() {
    const name = byId('service-name').value.trim();
    const duration = byId('service-duration').value;
    const price = byId('service-price').value;
    
    if (!name) {
      alert('Por favor ingresa el nombre del servicio');
      return;
    }
    
    const mode = this.getAttribute('data-mode') || 'add';
    
    if (mode === 'update') {
      const id = this.getAttribute('data-id');
      updateService(id, name, duration, price);
      
      // Restaurar el botón a modo agregar
      this.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6" />
        </svg>
        Agregar servicio
      `;
      this.removeAttribute('data-mode');
      this.removeAttribute('data-id');
    } else {
      addService(name, duration, price);
    }
    
    // Limpiar el formulario
    form.reset();
    
    // Actualizar la lista de servicios
    renderServices();
  });
}

// Sincronizar servicios con los formularios de cliente y turnos
function syncServicesToForms() {
  const services = getServices();
  
  // Seleccionar todos los dropdowns de servicios en todas las páginas
  const selects = document.querySelectorAll('select[name="tipo"], select#servicio');
  
  selects.forEach(select => {
    // Guardar la opción seleccionada actualmente
    const currentValue = select.value;
    
    // Limpiar todas las opciones excepto la primera (placeholder)
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    // Agregar los servicios como opciones
    services.items.forEach(service => {
      const option = document.createElement('option');
      option.value = service.name;
      option.textContent = service.name;
      select.appendChild(option);
    });
    
    // Restaurar la selección si existe
    if (currentValue) {
      select.value = currentValue;
    }
  });
  
  // Actualizar SERVICE_DURATIONS en turnos.js si está disponible
  if (window.TurnoRD && typeof window.updateServiceDurations === 'function') {
    const durationMap = {};
    services.items.forEach(service => {
      durationMap[service.name] = service.duration * 60; // Convertir minutos a segundos
    });
    window.updateServiceDurations(durationMap);
  }
}

// Gestión de tiempos de espera
function getWaitingTimes() {
  return readJSON(getWaitingTimesKey(), { services: {}, average: {}, version: 1 });
}

function updateWaitingTime(serviceName, seconds) {
  const waitingTimes = getWaitingTimes();
  
  // Actualizar tiempo para el servicio específico
  if (!waitingTimes.services[serviceName]) {
    waitingTimes.services[serviceName] = {
      count: 0,
      totalSeconds: 0,
      average: 0
    };
  }
  
  const serviceData = waitingTimes.services[serviceName];
  serviceData.count++;
  serviceData.totalSeconds += seconds;
  serviceData.average = Math.round(serviceData.totalSeconds / serviceData.count);
  
  // Actualizar promedio general
  if (!waitingTimes.average.count) {
    waitingTimes.average = { count: 0, totalSeconds: 0, average: 0 };
  }
  waitingTimes.average.count++;
  waitingTimes.average.totalSeconds += seconds;
  waitingTimes.average.average = Math.round(waitingTimes.average.totalSeconds / waitingTimes.average.count);
  
  // Guardar cambios
  waitingTimes.version = (waitingTimes.version || 0) + 1;
  writeJSON(getWaitingTimesKey(), waitingTimes);
  bc && bc.postMessage({ type: 'waiting_times:update', version: waitingTimes.version });
  
  return waitingTimes;
}

// Gestión de historial de clientes
function getClientHistory() {
  return readJSON(getClientHistoryKey(), { clients: {}, version: 1 });
}

function updateClientHistory(phone, name, service, duration, amount) {
  if (!phone) return null;
  
  const history = getClientHistory();
  
  if (!history.clients[phone]) {
    history.clients[phone] = {
      name: name,
      visits: [],
      totalSpent: 0,
      lastVisit: null
    };
  }
  
  const client = history.clients[phone];
  // Actualizar nombre si es diferente
  if (name && name !== client.name) {
    client.name = name;
  }
  
  // Agregar nueva visita
  const visit = {
    date: new Date().toISOString(),
    service: service,
    duration: duration,
    amount: amount || 0
  };
  
  client.visits.unshift(visit); // Agregar al inicio para tener las más recientes primero
  client.totalSpent += (amount || 0);
  client.lastVisit = visit.date;
  
  // Limitar a las últimas 20 visitas para no sobrecargar localStorage
  if (client.visits.length > 20) {
    client.visits = client.visits.slice(0, 20);
  }
  
  // Guardar cambios
  history.version = (history.version || 0) + 1;
  writeJSON(getClientHistoryKey(), history);
  bc && bc.postMessage({ type: 'client_history:update', version: history.version });
  
  return client;
}

// Obtener historial de un cliente por teléfono
function getClientByPhone(phone) {
  if (!phone) return null;
  const history = getClientHistory();
  return history.clients[phone] || null;
}

// Inicialización y suscripciones
function initSubscriptions() {
  // Escuchar cambios en los servicios y otros datos
  if (bc) {
    bc.onmessage = (ev) => {
      if (!ev || !ev.data) return;
      
      if (ev.data.type === 'services:update') {
        renderServices();
        syncServicesToForms();
      }
      
      if (ev.data.type === 'waiting_times:update') {
        updateWaitingTimeDisplay();
      }
      
      if (ev.data.type === 'client_history:update') {
        updateClientHistoryDisplay();
      }
    };
  }
  
  window.addEventListener('storage', (e) => {
    if ([getServicesKey(), getServicesKey()+':ping'].includes(e.key)) {
      renderServices();
      syncServicesToForms();
    }
    
    if ([getWaitingTimesKey(), getWaitingTimesKey()+':ping'].includes(e.key)) {
      updateWaitingTimeDisplay();
    }
    
    if ([getClientHistoryKey(), getClientHistoryKey()+':ping'].includes(e.key)) {
      updateClientHistoryDisplay();
    }
  });
  
  // Integración con TurnoRD para actualizar tiempos de espera
  if (window.TurnoRD) {
    // Extender la función nextTicket para registrar tiempos de espera
    const originalNextTicket = window.TurnoRD.nextTicket;
    if (originalNextTicket) {
      window.TurnoRD.nextTicket = function() {
        const cur = window.TurnoRD.getCurrentTicket();
        const result = originalNextTicket.apply(this, arguments);
        
        // Registrar tiempo de espera si hay un ticket actual
        if (cur && cur.type) {
          const startIso = cur.startedAt || cur.calledAt;
          const endIso = new Date().toISOString();
          const seconds = diffSeconds(startIso, endIso);
          
          // Actualizar tiempo de espera para este servicio
          updateWaitingTime(cur.type, seconds);
          
          // Actualizar historial del cliente
          if (cur.phone) {
            const amount = cur.paidAmount || 0;
            updateClientHistory(cur.phone, cur.name, cur.type, seconds, amount);
          }
        }
        
        return result;
      };
    }
  }
}

// Actualizar visualización de tiempos de espera
function updateWaitingTimeDisplay() {
  const waitingTimes = getWaitingTimes();
  const waitingTimeElements = document.querySelectorAll('[data-waiting-time]');
  
  waitingTimeElements.forEach(el => {
    const serviceName = el.getAttribute('data-waiting-time');
    if (serviceName === 'average') {
      // Mostrar tiempo promedio general
      const avg = waitingTimes.average && waitingTimes.average.average;
      el.textContent = avg ? formatDuration(avg) : '-';
    } else if (serviceName && waitingTimes.services[serviceName]) {
      // Mostrar tiempo para un servicio específico
      const avg = waitingTimes.services[serviceName].average;
      el.textContent = formatDuration(avg);
    } else {
      el.textContent = '-';
    }
  });
}

// Actualizar visualización de historial de clientes
function updateClientHistoryDisplay() {
  // Implementar si hay elementos en la UI para mostrar historial de clientes
  const phoneInput = document.querySelector('#telefono');
  if (phoneInput) {
    phoneInput.addEventListener('blur', function() {
      const phone = this.value.trim();
      if (phone) {
        const client = getClientByPhone(phone);
        if (client) {
          // Autocompletar nombre si existe
          const nameInput = document.querySelector('#nombre');
          if (nameInput && !nameInput.value.trim() && client.name) {
            nameInput.value = client.name;
          }
          
          // Mostrar historial si hay un elemento para ello
          const historyElement = document.querySelector('#client-history');
          if (historyElement) {
            let html = '<h3 class="text-lg font-semibold mb-2">Historial del Cliente</h3>';
            html += `<p>Visitas: ${client.visits.length}, Total gastado: RD$ ${client.totalSpent.toFixed(2)}</p>`;
            html += '<ul class="mt-2 space-y-1">';
            
            client.visits.slice(0, 5).forEach(visit => {
              const date = new Date(visit.date).toLocaleDateString();
              html += `<li>${date} - ${visit.service} - RD$ ${visit.amount.toFixed(2)}</li>`;
            });
            
            html += '</ul>';
            historyElement.innerHTML = html;
            historyElement.classList.remove('hidden');
          }
        }
      }
    });
  }
}

// Inicializar
function init() {
  renderServices();
  initServiceForm();
  syncServicesToForms();
  updateWaitingTimeDisplay();
  updateClientHistoryDisplay();
  initSubscriptions();
  
  // Exponer funciones para uso en otras páginas
  window.ServicesManager = {
    getServices,
    getWaitingTimes,
    getClientHistory,
    getClientByPhone,
    updateWaitingTime,
    updateClientHistory,
    syncServicesToForms
  };
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);

// Función para actualizar SERVICE_DURATIONS en turnos.js
window.updateServiceDurations = function(durationMap) {
  if (window.SERVICE_DURATIONS) {
    // Actualizar duración de servicios existentes y agregar nuevos
    Object.keys(durationMap).forEach(service => {
      window.SERVICE_DURATIONS[service] = durationMap[service];
    });
    console.log('Duraciones de servicios actualizadas:', window.SERVICE_DURATIONS);
  }
};

// Función para buscar cliente por teléfono (para uso externo)
window.findClientByPhone = function(phone) {
  return getClientByPhone(phone);
};