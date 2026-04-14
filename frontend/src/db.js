import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

db.version(1).stores({
  products: '++id, name, barcode, price, category, stock, gst',
  orders: '++id, date, total, subTotal, gstAmount, status'
});

db.version(2).stores({
  products: '++id, name, barcode, price, category, stock, gst',
  orders: '++id, date, total, subTotal, gstAmount, status'
}).upgrade(tx => {
  return tx.table('products').toCollection().modify(product => {
    if (product.gst === undefined) product.gst = 0;
  });
});
