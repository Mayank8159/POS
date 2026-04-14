import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

db.version(1).stores({
  products: '++id, name, barcode, price, category, stock', // primary key and indexed props
  orders: '++id, date, total, status' // status: pending, completed
});
