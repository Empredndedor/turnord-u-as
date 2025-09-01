// Central store for business information
// You can edit this list to add, remove, or modify businesses.
// The 'id' must be unique and should not contain spaces or special characters.

const businesses = [
  {
    id: 'sheila_nails',
    name: 'Centro de Uñas Sheila',
    email: 'sheila_nails@gmail.com',
    password: '12345'
  },
  {
    id: 'donjuan_barber',
    name: 'Barbería Don Juan',
    email: 'donjuan_barber@gmail.com',
    password: '12345'
  },
  {
    id: 'divas_salon',
    name: 'Salón de Belleza Divas',
    email: 'divas_salon@gmail.com',
    password: '12345'
  },
  {
    id: 'manosdeseda_spa',
    name: 'Spa Manos de Seda',
    email: 'manosdeseda_spa@gmail.com',
    password: '12345'
  },
  {
    id: 'elcortefinal_hair',
    name: 'Peluquería El Corte Final',
    email: 'elcortefinal_hair@gmail.com',
    password: '12345'
  }
];

// To make this data accessible in other scripts, we attach it to the window object.
window.APP_BUSINESSES = businesses;
