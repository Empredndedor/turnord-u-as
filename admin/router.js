// admin/router.js
// Handles URL-based routing to determine the current business.

import { getBusinessBySlug } from './db_schema.js';
import { supabase } from './supabase_integration.js'; // We might need supabase client here directly

async function initialize() {
  // Extract slug from URL path (e.g., /salon-esmeralda -> salon-esmeralda)
  const path = window.location.pathname;
  const slug = path.split('/').filter(Boolean)[0];

  if (!slug) {
    document.title = 'Bienvenido';
    document.body.innerHTML = `<div style="font-family: sans-serif; text-align: center; padding: 4rem;">
        <h1>Bienvenido al Sistema de Turnos</h1>
        <p>Por favor, accede a través de la URL específica de tu negocio.</p>
        <p>Por ejemplo: <strong>${window.location.origin}/nombre-de-tu-negocio</strong></p>
      </div>`;
    return;
  }

  const business = await getBusinessBySlug(slug);

  if (business) {
    // Set the business object globally for other scripts to use
    window.currentBusiness = business;
    console.log(`Router: Negocio actual establecido como '${business.name}' (ID: ${business.id})`);

    // Dispatch a custom event to notify other scripts that the business is ready
    document.dispatchEvent(new CustomEvent('businessReady', { detail: business }));
  } else {
    document.title = 'Error: Negocio No Encontrado';
    document.body.innerHTML = `<div style="font-family: sans-serif; text-align: center; padding: 4rem;">
        <h1>Error 404: Negocio No Encontrado</h1>
        <p>No se pudo encontrar un negocio con la URL slug: <strong>${slug}</strong></p>
        <p><a href="/">Volver al inicio</a></p>
      </div>`;
    // Stop further execution
    throw new Error(`Business with slug '${slug}' not found.`);
  }
}

// Execute the routing logic
initialize().catch(error => {
  console.error("Error durante la inicialización del router:", error);
});
