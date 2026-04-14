import React, { useState, useEffect, useRef } from 'react';
import { db } from './db';
import { LayoutGrid, Package, History, Search, Plus, Minus, Printer, Trash2 } from 'lucide-react';
import './index.css';

export default function App() {
  const [view, setView] = useState('pos');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '', stock: '' });

  // Receipt data ref for printing
  const [receiptData, setReceiptData] = useState(null);

  // Load Data
  const loadProducts = async () => {
    const all = await db.products.toArray();
    setProducts(all);
  };
  const loadOrders = async () => {
    const all = await db.orders.orderBy('id').reverse().toArray();
    setOrders(all);
  };

  useEffect(() => {
    loadProducts();
    loadOrders();
    // Preload some data if DB is empty
    const initData = async () => {
      const count = await db.products.count();
      if (count === 0) {
        await db.products.bulkAdd([
          { name: 'Espresso', price: 2.50, category: 'Drinks', stock: 100 },
          { name: 'Latte', price: 3.50, category: 'Drinks', stock: 100 },
          { name: 'Croissant', price: 2.00, category: 'Food', stock: 50 },
          { name: 'Sandwich', price: 5.00, category: 'Food', stock: 30 }
        ]);
        loadProducts();
      }
    };
    initData();
  }, []);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    const newOrder = {
      date: new Date().toISOString(),
      items: cart,
      total: grandTotal,
      status: 'completed'
    };

    // Save to DB
    const id = await db.orders.add(newOrder);
    
    // Set Receipt Data so it renders in the hidden block
    setReceiptData({ id, ...newOrder });
    
    // Trigger Print
    setTimeout(() => {
      window.print();
      setCart([]); // clear cart
      setReceiptData(null);
      loadOrders();
    }, 500);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    await db.products.add({
      name: newProduct.name,
      price: parseFloat(newProduct.price),
      category: newProduct.category,
      stock: parseInt(newProduct.stock) || 0
    });
    setNewProduct({ name: '', price: '', category: '', stock: '' });
    setIsModalOpen(false);
    loadProducts();
  };

  const handleDeleteProduct = async (id) => {
    await db.products.delete(id);
    loadProducts();
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="sidebar-logo">Pi</div>
        <div className={`nav-item ${view === 'pos' ? 'active' : ''}`} onClick={() => setView('pos')} title="Terminal">
          <LayoutGrid size={24} />
        </div>
        <div className={`nav-item ${view === 'products' ? 'active' : ''}`} onClick={() => setView('products')} title="Products">
          <Package size={24} />
        </div>
        <div className={`nav-item ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')} title="History">
          <History size={24} />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-header">
          {view === 'pos' ? (
            <div className="search-bar">
              <Search size={20} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          ) : (
             <h2 style={{fontSize: '1.2rem'}}>{view === 'products' ? 'Product Management' : 'Sales History'}</h2>
          )}
          <div style={{fontWeight: '600', color: 'var(--text-muted)'}}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric'})}
          </div>
        </header>

        {/* POS Termial View */}
        {view === 'pos' && (
          <div className="pos-layout">
            <div className="products-area">
              <div className="products-grid">
                {filteredProducts.map(p => (
                  <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                    <div className="product-image-placeholder">
                      {p.name.charAt(0)}
                    </div>
                    <div className="product-title">{p.name}</div>
                    <div className="product-price">${Number(p.price).toFixed(2)}</div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div style={{color: 'var(--text-muted)'}}>No products found...</div>
                )}
              </div>
            </div>

            <div className="cart-panel">
              <div className="cart-header">
                <h2>Current Order</h2>
              </div>
              <div className="cart-items">
                {cart.length === 0 && (
                  <div style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem'}}>
                    Cart is empty. Select items to add.
                  </div>
                )}
                {cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div className="item-info">
                      <div className="item-name">{item.name}</div>
                      <div className="item-price">${Number(item.price).toFixed(2)} / ea</div>
                    </div>
                    <div className="item-controls">
                      <button className="qty-btn" onClick={() => updateQty(item.id, -1)}><Minus size={14}/></button>
                      <span style={{width: '20px', textAlign: 'center', fontWeight: '500'}}>{item.qty}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={14}/></button>
                    </div>
                    <div className="item-total">
                      ${(item.price * item.qty).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="checkout-section">
                <div className="totals-row">
                  <span>Subtotal</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
                <div className="totals-row">
                  <span>Tax (0%)</span>
                  <span>$0.00</span>
                </div>
                <div className="totals-row grand-total">
                  <span>Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
                <button className="checkout-btn" onClick={handleCheckout} disabled={cart.length === 0}>
                  <Printer size={20} />
                  Print & Checkout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products Management View */}
        {view === 'products' && (
          <div className="view-section">
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2rem'}}>
              <h1 className="page-title" style={{marginBottom: 0}}>Inventory</h1>
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Add Product</button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td style={{fontWeight: 500}}>{p.name}</td>
                    <td>{p.category}</td>
                    <td>${Number(p.price).toFixed(2)}</td>
                    <td>{p.stock}</td>
                    <td>
                      <button className="btn" style={{color: 'var(--danger)', padding: '0.2rem 0.5rem'}} onClick={() => handleDeleteProduct(p.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* History View */}
        {view === 'history' && (
          <div className="view-section">
            <h1 className="page-title">Sales History</h1>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date & Time</th>
                  <th>Items Total</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                   <tr key={o.id}>
                     <td>#{o.id}</td>
                     <td>{new Date(o.date).toLocaleString()}</td>
                     <td>{o.items.reduce((s, it) => s + it.qty, 0)} items</td>
                     <td style={{fontWeight: 600, color: 'var(--success)'}}>${Number(o.total).toFixed(2)}</td>
                     <td style={{textTransform: 'capitalize'}}>{o.status}</td>
                   </tr>
                ))}
                {orders.length === 0 && (
                   <tr><td colSpan="5" style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>No past orders found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
             <h2 style={{marginBottom: '1.5rem'}}>Add New Product</h2>
             <form onSubmit={handleAddProduct}>
                <div className="form-group">
                  <label>Product Name</label>
                  <input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                </div>
                <div className="form-group" style={{display: 'flex', gap: '1rem'}}>
                  <div style={{flex: 1}}>
                    <label>Price ($)</label>
                    <input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})}/>
                  </div>
                  <div style={{flex: 1}}>
                    <label>Initial Stock</label>
                    <input type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})}/>
                  </div>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input type="text" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Product</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Print Overlay for Thermal Printer */}
      <div className="print-receipt-wrapper">
         {receiptData && (
            <div style={{padding: '10px 0'}}>
              <div style={{textAlign: 'center', marginBottom: '10px'}}>
                <h3 style={{margin: 0, fontSize: '18px'}}>PI POS SHOP</h3>
                <p style={{margin: '2px 0 10px', fontSize: '10px'}}>Raspberry Pi Based Point of Sale</p>
                <div>Order #{receiptData.id}</div>
                <div>{new Date(receiptData.date).toLocaleString()}</div>
              </div>
              
              <div style={{borderBottom: '1px dashed #000', margin: '5px 0'}}></div>

              <table style={{width: '100%', fontSize: '12px'}}>
                <tbody>
                  {receiptData.items.map((item, i) => (
                    <tr key={i}>
                      <td style={{padding: '2px 0'}}>{item.qty}x {item.name}</td>
                      <td style={{textAlign: 'right'}}>${(item.price * item.qty).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{borderBottom: '1px dashed #000', margin: '5px 0'}}></div>
              
              <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', margin: '5px 0'}}>
                <span>TOTAL</span>
                <span>${receiptData.total.toFixed(2)}</span>
              </div>
              
              <div style={{textAlign: 'center', marginTop: '15px', fontSize: '10px'}}>
                <p>Thank you for your purchase!</p>
                <p>Please come again.</p>
              </div>
            </div>
         )}
      </div>
    </div>
  );
}
