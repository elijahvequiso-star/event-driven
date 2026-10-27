'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowRight, Box, ClipboardList, LogOut, Users } from 'lucide-react';
import type { StoreOrder } from '@/lib/orders';
import type { Product } from '@/lib/default-products';

type AdminUser = {
  name: string;
  email: string;
  createdAt: string;
};

type Section = 'dashboard' | 'orders' | 'products' | 'users';
type OrderStatus = StoreOrder['status'];
type PaymentMethod = 'gcash' | 'maya';

type ProductForm = {
  name: string;
  detail: string;
  price: string;
  label: string;
  image: string;
  color: string;
};

const emptyProduct: ProductForm = {
  name: '',
  detail: '',
  price: '',
  label: '',
  image: '',
  color: '#c8b9a7',
};

const sections: { id: Section; title: string; icon: typeof Box }[] = [
  { id: 'dashboard', title: 'Overview', icon: ClipboardList },
  { id: 'orders', title: 'Orders', icon: Box },
  { id: 'products', title: 'Products', icon: Box },
  { id: 'users', title: 'Customers', icon: Users },
];

async function readJson<T>(response: Response): Promise<T> {
  const value: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof value === 'object' && value !== null && 'error' in value &&
      typeof value.error === 'string'
        ? value.error
        : 'The request could not be completed.';
    throw new Error(message);
  }
  return value as T;
}

export function AdminDashboard() {
  const router = useRouter();
  const [section, setSection] = useState<Section>('dashboard');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' });
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: '',
    paymentMethod: 'gcash' as PaymentMethod,
    paymentReference: '',
  });
  const [orderProducts, setOrderProducts] = useState<string[]>([]);

  const refreshData = useCallback(async () => {
    const [nextUsers, nextProducts, nextOrders] = await Promise.all([
      fetch('/api/admin/users', { cache: 'no-store' }).then(readJson<AdminUser[]>),
      fetch('/api/admin/products', { cache: 'no-store' }).then(readJson<Product[]>),
      fetch('/api/admin/orders', { cache: 'no-store' }).then(readJson<StoreOrder[]>),
    ]);
    setUsers(nextUsers);
    setProducts(nextProducts);
    setOrders(nextOrders);
  }, []);

  useEffect(() => {
    refreshData().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Unable to load admin data.');
    });
  }, [refreshData]);

  const mutate = async (url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await readJson<{ message?: string }>(response);
      await refreshData();
      setNotice(result.message || 'Changes saved.');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The change could not be saved.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to sign out.');
      router.push('/login?next=%2Fadmin');
      router.refresh();
    } catch {
      setError('We could not sign out. Please try again.');
    }
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = { ...productForm, price: Number(productForm.price) };
    const url = editingProduct
      ? `/api/admin/products/${encodeURIComponent(editingProduct)}`
      : '/api/admin/products';
    const saved = await mutate(url, editingProduct ? 'PUT' : 'POST', body);
    if (saved) {
      setProductForm(emptyProduct);
      setEditingProduct(null);
    }
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = editingUser
      ? `/api/admin/users/${encodeURIComponent(editingUser)}`
      : '/api/admin/users';
    const body = editingUser
      ? {
          name: userForm.name,
          email: userForm.email,
          ...(userForm.password ? { password: userForm.password } : {}),
        }
      : userForm;
    const saved = await mutate(url, editingUser ? 'PUT' : 'POST', body);
    if (saved) {
      setUserForm({ name: '', email: '', password: '' });
      setEditingUser(null);
    }
  };

  const createManualOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await mutate('/api/admin/orders', 'POST', {
      ...orderForm,
      items: orderProducts.map((name) => ({ name })),
    });
    if (created) {
      setOrderForm({
        customerName: '',
        email: '',
        phone: '',
        address: '',
        paymentMethod: 'gcash',
        paymentReference: '',
      });
      setOrderProducts([]);
    }
  };

  const deleteRecord = async (resource: 'users' | 'products' | 'orders', id: string) => {
    if (!window.confirm(`Delete this ${resource.slice(0, -1)}? This cannot be undone.`)) return;
    await mutate(`/api/admin/${resource}/${encodeURIComponent(id)}`, 'DELETE');
  };

  const totalSales = orders
    .filter((order) => order.status === 'paid' || order.status === 'fulfilled')
    .reduce((total, order) => total + order.total, 0);
  const pendingOrders = orders.filter((order) => order.status === 'pending_verification').length;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link className="wordmark admin-wordmark" href="/">
          MORROW <span>STUDIO</span>
        </Link>
        <div className="admin-topbar-actions">
          <span>STORE ADMIN</span>
          <button onClick={logout} type="button">
            <LogOut aria-hidden="true" size={15} /> SIGN OUT
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <aside aria-label="Admin navigation" className="admin-sidebar">
          <p className="admin-sidebar-label">MANAGE STORE</p>
          {sections.map(({ id, title, icon: Icon }) => (
            <button
              aria-current={section === id ? 'page' : undefined}
              className={section === id ? 'active' : ''}
              key={id}
              onClick={() => {
                setSection(id);
                setError('');
                setNotice('');
              }}
              type="button"
            >
              <Icon aria-hidden="true" size={16} /> {title}
            </button>
          ))}
        </aside>

        <section className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="eyebrow">MORROW STUDIO / ADMIN</p>
              <h1>
                {section === 'dashboard'
                  ? 'Store overview'
                  : section === 'orders'
                    ? 'Orders'
                    : section === 'products'
                      ? 'Products'
                      : 'Customers'}
              </h1>
            </div>
            <Link className="admin-store-link" href="/">
              VIEW STORE <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>

          {error ? <p aria-live="polite" className="admin-alert error" role="alert">{error}</p> : null}
          {notice ? <p aria-live="polite" className="admin-alert success" role="status">{notice}</p> : null}

          {section === 'dashboard' ? (
            <>
              <div className="admin-stat-grid">
                <article className="admin-stat-card">
                  <span>Customers</span><strong>{users.length}</strong><small>Registered accounts</small>
                </article>
                <article className="admin-stat-card">
                  <span>Products</span><strong>{products.length}</strong><small>In your catalog</small>
                </article>
                <article className="admin-stat-card">
                  <span>Total orders</span><strong>{orders.length}</strong><small>{pendingOrders} pending verification</small>
                </article>
                <article className="admin-stat-card">
                  <span>Verified sales</span><strong>${totalSales.toFixed(2)}</strong><small>Paid and fulfilled orders</small>
                </article>
              </div>
              <section className="admin-card">
                <div className="admin-card-heading"><div><p className="eyebrow">NEEDS ATTENTION</p><h2>Payment verification</h2></div></div>
                {pendingOrders ? (
                  <p>{pendingOrders} order{pendingOrders === 1 ? '' : 's'} awaiting manual payment verification.</p>
                ) : (
                  <p>No orders are waiting for payment verification.</p>
                )}
                <button className="admin-text-button" onClick={() => setSection('orders')} type="button">
                  REVIEW ORDERS <ArrowRight aria-hidden="true" size={14} />
                </button>
              </section>
            </>
          ) : null}

          {section === 'products' ? (
            <div className="admin-work-grid">
              <section className="admin-card admin-editor">
                <p className="eyebrow">{editingProduct ? 'EDIT CATALOG ITEM' : 'ADD TO THE STORE'}</p>
                <h2>{editingProduct ? 'Update product' : 'New product'}</h2>
                <form className="admin-form" onSubmit={saveProduct}>
                  <label>Product name<input required maxLength={100} value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
                  <label>Details<input maxLength={160} value={productForm.detail} onChange={(event) => setProductForm({ ...productForm, detail: event.target.value })} /></label>
                  <label>Price (USD)<input required min="0.01" max="100000" step="0.01" type="number" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
                  <label>Image URL<input maxLength={1000} value={productForm.image} onChange={(event) => setProductForm({ ...productForm, image: event.target.value })} /></label>
                  <label>Label<input maxLength={30} value={productForm.label} onChange={(event) => setProductForm({ ...productForm, label: event.target.value })} /></label>
                  <label>Swatch color<input type="color" value={productForm.color} onChange={(event) => setProductForm({ ...productForm, color: event.target.value })} /></label>
                  <button className="admin-primary-button" disabled={busy} type="submit">{editingProduct ? 'SAVE PRODUCT' : 'ADD PRODUCT'}</button>
                  {editingProduct ? <button className="admin-secondary-button" onClick={() => { setEditingProduct(null); setProductForm(emptyProduct); }} type="button">CANCEL EDIT</button> : null}
                </form>
              </section>
              <section className="admin-card admin-table-card">
                <div className="admin-card-heading"><div><p className="eyebrow">LIVE CATALOG</p><h2>{products.length} products</h2></div></div>
                <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Product</th><th>Price</th><th>Actions</th></tr></thead>
                  <tbody>{products.map((product) => <tr key={product.name}>
                    <td><strong>{product.name}</strong><small>{product.detail}</small></td><td>{product.price}</td>
                    <td><div className="admin-row-actions"><button onClick={() => { setEditingProduct(product.name); setProductForm({ ...product, price: product.price.replace('$', '') }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} type="button">Edit</button><button className="danger" onClick={() => deleteRecord('products', product.name)} type="button">Delete</button></div></td>
                  </tr>)}</tbody></table></div>
              </section>
            </div>
          ) : null}

          {section === 'users' ? (
            <div className="admin-work-grid">
              <section className="admin-card admin-editor">
                <p className="eyebrow">{editingUser ? 'EDIT ACCOUNT' : 'CREATE ACCOUNT'}</p>
                <h2>{editingUser ? 'Update customer' : 'New customer'}</h2>
                <form className="admin-form" onSubmit={saveUser}>
                  <label>Full name<input required minLength={2} maxLength={80} value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></label>
                  <label>Email address<input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
                  <label>{editingUser ? 'New password (optional)' : 'Temporary password'}<input required={!editingUser} minLength={8} maxLength={128} type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label>
                  <button className="admin-primary-button" disabled={busy} type="submit">{editingUser ? 'SAVE CUSTOMER' : 'CREATE CUSTOMER'}</button>
                  {editingUser ? <button className="admin-secondary-button" onClick={() => { setEditingUser(null); setUserForm({ name: '', email: '', password: '' }); }} type="button">CANCEL EDIT</button> : null}
                </form>
              </section>
              <section className="admin-card admin-table-card">
                <div className="admin-card-heading"><div><p className="eyebrow">REGISTERED ACCOUNTS</p><h2>{users.length} customers</h2></div></div>
                <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
                  {users.map((user) => <tr key={user.email}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td><div className="admin-row-actions"><button onClick={() => { setEditingUser(user.email); setUserForm({ name: user.name, email: user.email, password: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} type="button">Edit</button><button className="danger" onClick={() => deleteRecord('users', user.email)} type="button">Delete</button></div></td></tr>)}
                </tbody></table></div>
              </section>
            </div>
          ) : null}

          {section === 'orders' ? (
            <>
              <section className="admin-card admin-editor admin-order-editor">
                <p className="eyebrow">CREATE AN ORDER</p>
                <h2>New customer order</h2>
                <form className="admin-form admin-order-form" onSubmit={createManualOrder}>
                  <label>Customer name<input required minLength={2} maxLength={100} value={orderForm.customerName} onChange={(event) => setOrderForm({ ...orderForm, customerName: event.target.value })} /></label>
                  <label>Email address<input required type="email" value={orderForm.email} onChange={(event) => setOrderForm({ ...orderForm, email: event.target.value })} /></label>
                  <label>Mobile number<input required pattern="[+()0-9 .-]{7,24}" value={orderForm.phone} onChange={(event) => setOrderForm({ ...orderForm, phone: event.target.value })} /></label>
                  <label>Delivery address<input required minLength={10} maxLength={500} value={orderForm.address} onChange={(event) => setOrderForm({ ...orderForm, address: event.target.value })} /></label>
                  <label>Payment method<select value={orderForm.paymentMethod} onChange={(event) => setOrderForm({ ...orderForm, paymentMethod: event.target.value as PaymentMethod })}><option value="gcash">GCash</option><option value="maya">Maya</option></select></label>
                  <label>Payment reference (optional)<input maxLength={100} value={orderForm.paymentReference} onChange={(event) => setOrderForm({ ...orderForm, paymentReference: event.target.value })} /></label>
                  <fieldset className="admin-product-picker"><legend>Order items</legend>{products.map((product) => <label key={product.name}><input checked={orderProducts.includes(product.name)} onChange={(event) => setOrderProducts((current) => event.target.checked ? [...current, product.name] : current.filter((name) => name !== product.name))} type="checkbox" />{product.name} <span>{product.price}</span></label>)}</fieldset>
                  <button className="admin-primary-button" disabled={busy || orderProducts.length === 0} type="submit">CREATE PENDING ORDER</button>
                </form>
              </section>
              <section className="admin-card admin-table-card admin-orders-table">
              <div className="admin-card-heading"><div><p className="eyebrow">CUSTOMER CHECKOUTS</p><h2>{orders.length} orders</h2></div></div>
              <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {orders.map((order) => <tr key={order.id}>
                  <td><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></td>
                  <td><strong>{order.customerName}</strong><small>{order.email}<br />{order.phone}<br />{order.address}</small></td>
                  <td>${order.total.toFixed(2)}<small>{order.items.map((item) => item.name).join(', ')}</small></td>
                  <td>{order.paymentMethod.toUpperCase()}<small>Ref: {order.paymentReference}</small></td>
                  <td><select aria-label={`Status for order ${order.id}`} className="admin-status-select" value={order.status} onChange={(event) => mutate(`/api/admin/orders/${encodeURIComponent(order.id)}`, 'PUT', { status: event.target.value as OrderStatus })}>
                    <option value="pending_verification">Pending verification</option><option value="paid">Paid</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option>
                  </select></td>
                  <td><div className="admin-row-actions"><button className="danger" onClick={() => deleteRecord('orders', order.id)} type="button">Delete</button></div></td>
                </tr>)}
              </tbody></table></div>
              {!orders.length ? <p className="admin-empty">Customer orders will appear here.</p> : null}
              </section>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
