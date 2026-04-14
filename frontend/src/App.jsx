import React, { useState, useEffect, useMemo } from 'react';
import { db, requestPersistentStorage } from './db';
import { LayoutGrid, Package, History, Search, Plus, Minus, Printer, Trash2, BarChart3, Settings } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import './index.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const GST_OPTIONS = [0, 5, 12, 18, 28];

export default function App() {
  const [view, setView] = useState('pos');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '', stock: '', gst: 0 });
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
    // Request persistent storage so data survives app/device restarts
    requestPersistentStorage();

    loadProducts();
    loadOrders();

    // Only seed sample data ONCE (tracked via settings table)
    const initData = async () => {
      const alreadySeeded = await db.settings.get('seeded');
      if (!alreadySeeded) {
        const count = await db.products.count();
        if (count === 0) {
          await db.products.bulkAdd([
            { name: 'Espresso', price: 120, category: 'Drinks', stock: 100, gst: 5 },
            { name: 'Latte', price: 180, category: 'Drinks', stock: 100, gst: 5 },
            { name: 'Cappuccino', price: 160, category: 'Drinks', stock: 80, gst: 5 },
            { name: 'Green Tea', price: 100, category: 'Drinks', stock: 120, gst: 5 },
            { name: 'Croissant', price: 90, category: 'Food', stock: 50, gst: 12 },
            { name: 'Sandwich', price: 200, category: 'Food', stock: 30, gst: 12 },
            { name: 'Pasta', price: 280, category: 'Food', stock: 25, gst: 12 },
            { name: 'Burger', price: 250, category: 'Food', stock: 40, gst: 12 },
            { name: 'Brownie', price: 120, category: 'Desserts', stock: 60, gst: 5 },
            { name: 'Cheesecake', price: 220, category: 'Desserts', stock: 30, gst: 18 },
          ]);
          loadProducts();
        }
        // Mark as seeded so sample data never re-appears
        await db.settings.put({ key: 'seeded', value: true });
      }
    };
    initData();
  }, []);

  // Categories derived from products
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return ['All', ...cats.sort()];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    if (search) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    }
    return filtered;
  }, [products, selectedCategory, search]);

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

  // GST Calculations
  const subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const gstBreakdown = useMemo(() => {
    const breakdown = {};
    cart.forEach(item => {
      const rate = item.gst || 0;
      const itemTotal = item.price * item.qty;
      const gstAmt = (itemTotal * rate) / 100;
      if (!breakdown[rate]) breakdown[rate] = 0;
      breakdown[rate] += gstAmt;
    });
    return breakdown;
  }, [cart]);
  const totalGst = Object.values(gstBreakdown).reduce((s, v) => s + v, 0);
  const grandTotal = subTotal + totalGst;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const newOrder = {
      date: new Date().toISOString(),
      items: cart.map(item => ({ ...item })),
      subTotal: subTotal,
      gstAmount: totalGst,
      gstBreakdown: { ...gstBreakdown },
      total: grandTotal,
      status: 'completed'
    };

    const id = await db.orders.add(newOrder);
    setReceiptData({ id, ...newOrder });

    setTimeout(() => {
      window.print();
      setCart([]);
      setReceiptData(null);
      loadOrders();
    }, 500);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setNewProduct({ name: '', price: '', category: '', stock: '', gst: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      price: String(product.price),
      category: product.category || '',
      stock: String(product.stock || ''),
      gst: product.gst || 0
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const productData = {
      name: newProduct.name,
      price: parseFloat(newProduct.price),
      category: newProduct.category,
      stock: parseInt(newProduct.stock) || 0,
      gst: parseInt(newProduct.gst) || 0
    };

    if (editingProduct) {
      await db.products.update(editingProduct.id, productData);
    } else {
      await db.products.add(productData);
    }
    setNewProduct({ name: '', price: '', category: '', stock: '', gst: 0 });
    setEditingProduct(null);
    setIsModalOpen(false);
    loadProducts();
  };

  const handleDeleteProduct = async (id) => {
    await db.products.delete(id);
    loadProducts();
  };

  // ============ DASHBOARD DATA ============
  const dashboardData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const todaysOrders = orders.filter(o => o.date && o.date.slice(0, 10) === todayStr);
    const todayRevenue = todaysOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayGst = todaysOrders.reduce((s, o) => s + (o.gstAmount || 0), 0);
    const todayItemsSold = todaysOrders.reduce((s, o) => s + (o.items ? o.items.reduce((a, i) => a + i.qty, 0) : 0), 0);

    // Last 7 days revenue
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter(o => o.date && o.date.slice(0, 10) === ds);
      const dayRevenue = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
      last7.push({
        label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
        revenue: dayRevenue
      });
    }

    // Category breakdown (from all orders)
    const catRevenue = {};
    orders.forEach(o => {
      if (!o.items) return;
      o.items.forEach(item => {
        const cat = item.category || 'Uncategorized';
        if (!catRevenue[cat]) catRevenue[cat] = 0;
        catRevenue[cat] += item.price * item.qty;
      });
    });

    return {
      todayRevenue,
      todayGst,
      todayOrders: todaysOrders.length,
      todayItemsSold,
      last7,
      catRevenue,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((s, o) => s + (o.total || 0), 0),
    };
  }, [orders]);

  const barChartData = {
    labels: dashboardData.last7.map(d => d.label),
    datasets: [{
      label: 'Revenue (₹)',
      data: dashboardData.last7.map(d => d.revenue),
      backgroundColor: 'rgba(79, 70, 229, 0.7)',
      borderColor: '#4F46E5',
      borderWidth: 2,
      borderRadius: 8,
    }]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Last 7 Days Revenue', font: { size: 16, weight: '600' } }
    },
    scales: {
      y: { beginAtZero: true, ticks: { callback: v => '₹' + v.toLocaleString('en-IN') } },
      x: { grid: { display: false } }
    }
  };

  const catLabels = Object.keys(dashboardData.catRevenue);
  const catColors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  const doughnutData = {
    labels: catLabels,
    datasets: [{
      data: catLabels.map(c => dashboardData.catRevenue[c]),
      backgroundColor: catColors.slice(0, catLabels.length),
      borderWidth: 2,
      borderColor: '#fff',
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } },
      title: { display: true, text: 'Revenue by Category', font: { size: 16, weight: '600' } }
    }
  };

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
        <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')} title="Dashboard">
          <BarChart3 size={24} />
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
            <h2 style={{ fontSize: '1.2rem' }}>
              {view === 'products' ? 'Product Management' : view === 'history' ? 'Sales History' : 'Dashboard'}
            </h2>
          )}
          <div style={{ fontWeight: '600', color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </header>

        {/* =============== POS TERMINAL VIEW =============== */}
        {view === 'pos' && (
          <div className="pos-layout">
            <div className="products-area">
              {/* Category Filter Tabs */}
              <div className="category-tabs">
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="products-grid">
                {filteredProducts.map(p => (
                  <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                    <div className="product-image-placeholder">
                      {p.name.charAt(0)}
                    </div>
                    <div className="product-title">{p.name}</div>
                    <div className="product-meta">
                      <span className="product-price">₹{Number(p.price).toLocaleString('en-IN')}</span>
                      {p.gst > 0 && <span className="product-gst-badge">{p.gst}% GST</span>}
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>No products found...</div>
                )}
              </div>
            </div>

            {/* Cart Panel */}
            <div className="cart-panel">
              <div className="cart-header">
                <h2>Current Order</h2>
                {cart.length > 0 && (
                  <button className="btn" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => setCart([])}>
                    Clear
                  </button>
                )}
              </div>
              <div className="cart-items">
                {cart.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                    Cart is empty. Tap items to add.
                  </div>
                )}
                {cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div className="item-info">
                      <div className="item-name">{item.name}</div>
                      <div className="item-price">₹{Number(item.price).toLocaleString('en-IN')} / ea
                        {item.gst > 0 && <span className="item-gst-tag">+{item.gst}%</span>}
                      </div>
                    </div>
                    <div className="item-controls">
                      <button className="qty-btn" onClick={() => updateQty(item.id, -1)}><Minus size={14} /></button>
                      <span style={{ width: '20px', textAlign: 'center', fontWeight: '500' }}>{item.qty}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={14} /></button>
                    </div>
                    <div className="item-total">
                      ₹{(item.price * item.qty).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="checkout-section">
                <div className="totals-row">
                  <span>Subtotal</span>
                  <span>₹{subTotal.toLocaleString('en-IN')}</span>
                </div>
                {/* GST Breakdown */}
                {Object.entries(gstBreakdown).map(([rate, amount]) => (
                  <div className="totals-row gst-row" key={rate}>
                    <span>GST @ {rate}%</span>
                    <span>₹{Math.round(amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="totals-row grand-total">
                  <span>Total</span>
                  <span>₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
                </div>
                <button className="checkout-btn" onClick={handleCheckout} disabled={cart.length === 0}>
                  <Printer size={20} />
                  Print & Checkout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =============== PRODUCTS VIEW =============== */}
        {view === 'products' && (
          <div className="view-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>Inventory</h1>
              <button className="btn btn-primary" onClick={openAddModal}>+ Add Product</button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>GST</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>{p.category}</td>
                    <td>₹{Number(p.price).toLocaleString('en-IN')}</td>
                    <td><span className="gst-badge">{p.gst || 0}%</span></td>
                    <td>{p.stock}</td>
                    <td>
                      <button className="btn" style={{ padding: '0.2rem 0.5rem', marginRight: '0.5rem' }} onClick={() => openEditModal(p)}>
                        Edit
                      </button>
                      <button className="btn" style={{ color: 'var(--danger)', padding: '0.2rem 0.5rem' }} onClick={() => handleDeleteProduct(p.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =============== HISTORY VIEW =============== */}
        {view === 'history' && (
          <div className="view-section">
            <h1 className="page-title">Sales History</h1>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date & Time</th>
                  <th>Items</th>
                  <th>Subtotal</th>
                  <th>GST</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{new Date(o.date).toLocaleString('en-IN')}</td>
                    <td>{o.items ? o.items.reduce((s, it) => s + it.qty, 0) : 0} items</td>
                    <td>₹{Number(o.subTotal || 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--primary)' }}>₹{Number(o.gstAmount || 0).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>₹{Number(o.total).toLocaleString('en-IN')}</td>
                    <td style={{ textTransform: 'capitalize' }}>{o.status}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No past orders found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* =============== DASHBOARD VIEW =============== */}
        {view === 'dashboard' && (
          <div className="view-section">
            <h1 className="page-title">Dashboard</h1>

            {/* Stat Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Today's Revenue</div>
                <div className="stat-value">₹{Math.round(dashboardData.todayRevenue).toLocaleString('en-IN')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Today's GST Collected</div>
                <div className="stat-value stat-gst">₹{Math.round(dashboardData.todayGst).toLocaleString('en-IN')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Today's Orders</div>
                <div className="stat-value stat-orders">{dashboardData.todayOrders}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Items Sold Today</div>
                <div className="stat-value stat-items">{dashboardData.todayItemsSold}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">All-Time Revenue</div>
                <div className="stat-value">₹{Math.round(dashboardData.totalRevenue).toLocaleString('en-IN')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Orders</div>
                <div className="stat-value stat-orders">{dashboardData.totalOrders}</div>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
              <div className="chart-card">
                <div style={{ height: '320px' }}>
                  <Bar data={barChartData} options={barChartOptions} />
                </div>
              </div>
              <div className="chart-card">
                <div style={{ height: '320px' }}>
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =============== ADD/EDIT PRODUCT MODAL =============== */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSaveProduct}>
              <div className="form-group">
                <label>Product Name</label>
                <input type="text" required value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Price (₹)</label>
                  <input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>GST Rate</label>
                  <select value={newProduct.gst} onChange={e => setNewProduct({ ...newProduct, gst: parseInt(e.target.value) })}>
                    {GST_OPTIONS.map(rate => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Category</label>
                  <input type="text" value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Initial Stock</label>
                  <input type="number" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingProduct ? 'Update' : 'Save Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============== PRINT RECEIPT =============== */}
      <div className="print-receipt-wrapper">
        {receiptData && (
          <div style={{ padding: '10px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>PI POS SHOP</h3>
              <p style={{ margin: '2px 0 10px', fontSize: '10px' }}>Raspberry Pi Based Point of Sale</p>
              <div>Order #{receiptData.id}</div>
              <div>{new Date(receiptData.date).toLocaleString('en-IN')}</div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>

            <table style={{ width: '100%', fontSize: '12px' }}>
              <tbody>
                {receiptData.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '2px 0' }}>{item.qty}x {item.name}</td>
                    <td style={{ textAlign: 'right' }}>₹{(item.price * item.qty).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>

            <div style={{ fontSize: '11px', margin: '3px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span>₹{Math.round(receiptData.subTotal).toLocaleString('en-IN')}</span>
              </div>
              {receiptData.gstBreakdown && Object.entries(receiptData.gstBreakdown).map(([rate, amt]) => (
                <div key={rate} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>GST @{rate}%</span>
                  <span>₹{Math.round(amt).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', margin: '5px 0' }}>
              <span>TOTAL</span>
              <span>₹{Math.round(receiptData.total).toLocaleString('en-IN')}</span>
            </div>

            <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '10px' }}>
              <p>Thank you for your purchase!</p>
              <p>Please come again.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
