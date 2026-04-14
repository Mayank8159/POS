import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

db.version(1).stores({
  products: '++id, name, barcode, price, category, stock, gst',
  orders: '++id, date, total, subTotal, gstAmount, status'
});

db.version(2).stores({
  products: '++id, name, barcode, price, category, stock, gst',
  orders: '++id, date, total, subTotal, gstAmount, status',
  settings: 'key'  // key-value settings store
}).upgrade(tx => {
  return tx.table('products').toCollection().modify(product => {
    if (product.gst === undefined) product.gst = 0;
  });
});

// Request persistent storage so the browser never evicts our IndexedDB data.
// This is critical for Raspberry Pi deployment where data must survive reboots.
export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    if (granted) {
      console.log('[POS] Persistent storage granted — data will survive reboots.');
    } else {
      console.warn('[POS] Persistent storage denied — data may be evicted under pressure.');
    }
  }
}

export async function getStoragePersistenceStatus() {
  const status = {
    supported: false,
    persisted: false,
  };

  if (!navigator.storage) {
    return status;
  }

  if (navigator.storage.persisted) {
    status.supported = true;
    status.persisted = await navigator.storage.persisted();
  }

  return status;
}

// Check current storage usage
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    return {
      usage: est.usage,
      quota: est.quota,
      usagePercentage: ((est.usage / est.quota) * 100).toFixed(2) + '%'
    };
  }
  return null;
}
