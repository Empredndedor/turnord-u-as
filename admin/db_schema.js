// admin/db_schema.js
// This file defines the database schema for multi-tenancy and provides helper functions
// for interacting with the database.

// --- SQL SCHEMA DEFINITIONS ---
// You will need to run these SQL commands in your Supabase SQL Editor to create the necessary tables.

/*
-- 1. Table to store the businesses
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
-- Allow public read access
CREATE POLICY "Allow public read access" ON businesses FOR SELECT USING (true);


-- 2. Table for business-specific configurations
CREATE TABLE business_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  hours JSONB DEFAULT '{"open": "08:00", "close": "20:00"}',
  limit_per_day INT DEFAULT 30,
  open_days INT[] DEFAULT '{1,2,3,4,5,6}', -- Array of integers, 0=Sunday
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id)
);
-- Enable RLS
ALTER TABLE business_configs ENABLE ROW LEVEL SECURITY;
-- Allow public read access
CREATE POLICY "Allow public read access" ON business_configs FOR SELECT USING (true);
-- Allow authorized users to update (you might need to adjust this based on your auth rules)
CREATE POLICY "Allow update for users" ON business_configs FOR UPDATE USING (auth.role() = 'authenticated');


-- 3. Table for business-specific break status
CREATE TABLE business_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  is_on BOOLEAN DEFAULT false,
  end_at TIMESTAMPTZ,
  duration_min INT DEFAULT 30,
  message TEXT DEFAULT 'Estamos en break, regresamos pronto...',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id)
);
-- Enable RLS
ALTER TABLE business_breaks ENABLE ROW LEVEL SECURITY;
-- Allow public read access
CREATE POLICY "Allow public read access" ON business_breaks FOR SELECT USING (true);
-- Allow authorized users to update
CREATE POLICY "Allow update for users" ON business_breaks FOR UPDATE USING (auth.role() = 'authenticated');

*/


// --- JAVASCRIPT HELPER FUNCTIONS ---

import { supabase } from './supabase_integration.js';

// --- Business Functions ---

/**
 * Gets a business's details by its URL slug.
 * @param {string} slug The URL slug of the business.
 * @returns {Promise<object|null>} The business object or null if not found.
 */
export async function getBusinessBySlug(slug) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching business by slug:', error);
    return null;
  }
  return data;
}


// --- Config Functions ---

/**
 * Gets the configuration for a specific business.
 * @param {string} business_id The UUID of the business.
 * @returns {Promise<object>} The config object.
 */
export async function getBusinessConfig(business_id) {
  const { data, error } = await supabase
    .from('business_configs')
    .select('*')
    .eq('business_id', business_id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Error fetching business config:', error);
  }
  // Return default config if none found in DB
  return data || {
    hours: { open: '08:00', close: '20:00' },
    limit_per_day: 30,
    open_days: [1,2,3,4,5,6]
  };
}

/**
 * Saves the configuration for a business.
 * @param {string} business_id The UUID of the business.
 * @param {object} config The configuration object to save.
 */
export async function saveBusinessConfig(business_id, config) {
  const { error } = await supabase
    .from('business_configs')
    .upsert({
      business_id: business_id,
      hours: config.hours,
      limit_per_day: config.limitPerDay,
      open_days: config.openDays,
      updated_at: new Date().toISOString()
    }, { onConflict: 'business_id' });

  if (error) {
    console.error('Error saving business config:', error);
  }
}


// --- Break Functions ---

/**
 * Gets the break state for a specific business.
 * @param {string} business_id The UUID of the business.
 * @returns {Promise<object>} The break state object.
 */
export async function getBreakState(business_id) {
    const { data, error } = await supabase
    .from('business_breaks')
    .select('*')
    .eq('business_id', business_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching break state:', error);
  }
  return data || {
    is_on: false,
    end_at: null,
    duration_min: 30,
    message: 'Estamos en break, regresamos pronto...'
  };
}

/**
 * Saves the break state for a business.
 * @param {string} business_id The UUID of the business.
 * @param {object} state The break state object.
 */
export async function saveBreakState(business_id, state) {
    const { error } = await supabase
    .from('business_breaks')
    .upsert({
      business_id: business_id,
      is_on: state.isOn,
      end_at: state.endAt,
      duration_min: state.durationMin,
      message: state.message,
      updated_at: new Date().toISOString()
    }, { onConflict: 'business_id' });

  if (error) {
    console.error('Error saving break state:', error);
  }
}

// --- Reporting / History Functions ---
// These functions will query the existing 'tickets' table for reporting data.

/**
 * Fetches served tickets for a given business and date range.
 * @param {string} business_id The UUID of the business.
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<Array>} A list of served tickets.
 */
export async function getServedTicketsForDateRange(business_id, startDate, endDate) {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('tenant_id', business_id)
        .eq('status', 'served')
        .gte('served_at', new Date(startDate).toISOString())
        .lte('served_at', new Date(endDate + 'T23:59:59Z').toISOString());

    if (error) {
        console.error('Error fetching tickets for reporting:', error);
        return [];
    }
    return data;
}
