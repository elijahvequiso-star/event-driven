"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState, useSyncExternalStore } from 'react';
import { defaultProducts } from '@/lib/default-products';
import type { CustomerOrder } from '@/lib/orders';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  LogOut,
  X,
  Heart,
  Menu,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

const shopNotes = [
  {
    number: '01',
    title: 'Made to live in',
    text: 'Easy silhouettes and thoughtful details for wherever the day takes you.',
    icon: Sparkles,
  },
  {
    number: '02',
    title: 'Better by nature',
    text: 'Natural fibers, considered sourcing, and pieces designed to last.',
    icon: PackageCheck,
  },
  {
    number: '03',
    title: 'A fit that feels right',
    text: 'Simple sizing and easy returns make finding your fit feel effortless.',
    icon: RefreshCw,
  },
];

type BagItem = {
  id: number;
  name: string;
  price: string;
};

type AccountUser = {
  name: string;
  email: string;
};

type PaymentMethod = 'gcash' | 'maya';

type OrderConfirmation = {
  orderId: string;
};

const orderStatusLabels: Record<CustomerOrder['status'], string> = {
  pending_verification: 'Payment pending verification',
  paid: 'Payment verified',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const BAG_STORAGE_KEY = 'morrow-studio-bag';
const EMPTY_BAG: BagItem[] = [];
let cachedBagRaw: string | null = null;
let cachedBagItems: BagItem[] = EMPTY_BAG;
const bagListeners = new Set<() => void>();

function isBagItem(value: unknown): value is BagItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'number' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'price' in value &&
    typeof value.price === 'string'
  );
}

function getBagSnapshot(): BagItem[] {
  const raw = window.localStorage.getItem(BAG_STORAGE_KEY);
  if (raw === cachedBagRaw) return cachedBagItems;

  cachedBagRaw = raw;
  if (!raw) {
    cachedBagItems = EMPTY_BAG;
    return cachedBagItems;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    cachedBagItems = Array.isArray(parsed) ? parsed.filter(isBagItem) : EMPTY_BAG;
  } catch {
    cachedBagItems = EMPTY_BAG;
    window.localStorage.removeItem(BAG_STORAGE_KEY);
    cachedBagRaw = null;
  }
  return cachedBagItems;
}

function subscribeToBag(listener: () => void) {
  bagListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    bagListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function updateBagItems(update: (items: BagItem[]) => BagItem[]) {
  cachedBagItems = update(getBagSnapshot());
  cachedBagRaw = JSON.stringify(cachedBagItems);
  window.localStorage.setItem(BAG_STORAGE_KEY, cachedBagRaw);
  bagListeners.forEach((listener) => listener());
}

export default function Home() {
  const router = useRouter();
  const bagItems = useSyncExternalStore(subscribeToBag, getBagSnapshot, () => EMPTY_BAG);
  const [products, setProducts] = useState(defaultProducts);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [bagView, setBagView] = useState<'bag' | 'orders'>('bag');
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersMessage, setOrdersMessage] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentQrUnavailable, setPaymentQrUnavailable] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentSent, setPaymentSent] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null);
  const [lastAdded, setLastAdded] = useState('');
  const [checkingAccount, setCheckingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/auth/me', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error('Unable to load account details.');
        const user: unknown = await response.json();
        if (
          typeof user === 'object' &&
          user !== null &&
          'name' in user &&
          typeof user.name === 'string' &&
          'email' in user &&
          typeof user.email === 'string'
        ) {
          return { name: user.name, email: user.email };
        }
        throw new Error('The account response was invalid.');
      })
      .then((user) => {
        setAccountUser(user);
        if (user) setCustomerName(user.name);
        setAccountLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAuthMessage('Account details could not be loaded.');
          setAccountLoaded(true);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/products', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load the product catalog.');
        const catalog: unknown = await response.json();
        if (!Array.isArray(catalog)) throw new Error('The product catalog response was invalid.');
        setProducts(catalog);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAccountMessage('The latest product catalog could not be loaded.');
        }
      });
    return () => controller.abort();
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    setAuthMessage('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to sign out.');
      setAccountUser(null);
      setAuthMessage('');
      router.refresh();
    } catch {
      setAuthMessage('We could not sign you out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const requireAccount = async (returnTo: string): Promise<boolean> => {
    setAccountMessage('');
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(returnTo)}`);
        return false;
      }
      if (!response.ok) {
        throw new Error('Unable to verify your account.');
      }
      return true;
    } catch {
      setAccountMessage('We could not verify your sign-in. Please try again.');
      return false;
    }
  };

  const addToBag = async (name: string) => {
    const product = products.find((item) => item.name === name);
    if (!product) return;

    setCheckingAccount(true);
    try {
      if (!(await requireAccount('/#new-in'))) return;

      updateBagItems((items) => [
        ...items,
        { id: Date.now() + Math.random(), name, price: product.price },
      ]);
      setLastAdded(name);
    } catch {
      setAccountMessage('We could not update your shopping bag. Please try again.');
    } finally {
      setCheckingAccount(false);
    }
  };

  const openBag = async () => {
    setCheckingAccount(true);
    try {
      if (await requireAccount('/#new-in')) {
        setBagView('bag');
        setBagOpen(true);
      }
    } finally {
      setCheckingAccount(false);
    }
  };

  const showCustomerOrders = async () => {
    setBagView('orders');
    setOrdersLoading(true);
    setOrdersMessage('');
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'We could not load your orders. Please try again.';
        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent('/#new-in')}`);
          return;
        }
        throw new Error(message);
      }
      if (!Array.isArray(result)) throw new Error('The orders response was invalid.');
      setCustomerOrders(result as CustomerOrder[]);
    } catch (error) {
      setOrdersMessage(
        error instanceof Error ? error.message : 'We could not load your orders. Please try again.',
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentMethod) return;

    setSubmittingOrder(true);
    setPaymentMessage('');
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phone: customerPhone,
          address: deliveryAddress,
          paymentMethod,
          paymentReference,
          paymentSent,
          items: bagItems.map((item) => ({ name: item.name })),
        }),
      });
      const result: { orderId?: string; error?: string } = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent('/#new-in')}`);
          return;
        }
        setPaymentMessage(result.error || 'We could not place your order. Please try again.');
        return;
      }
      if (!result.orderId) {
        throw new Error('The order response did not include an order number.');
      }

      setOrderConfirmation({ orderId: result.orderId });
      updateBagItems(() => []);
    } catch {
      setPaymentMessage('We could not submit your order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const bagTotal = bagItems.reduce(
    (total, item) => total + Number(item.price.replace('$', '')),
    0,
  );

  return (
    <main className="storefront">
      <div className="announcement">
        <Sparkles aria-hidden="true" size={12} />
        <span>Complimentary shipping on orders over $150</span>
        <Sparkles aria-hidden="true" size={12} />
      </div>

      <header className="site-header">
        <Link aria-label="Morrow Studio home" className="wordmark" href="/">
          MORROW <span>STUDIO</span>
        </Link>

        <nav aria-label="Main navigation" className="desktop-nav">
          <a href="#new-in">NEW IN</a>
          <a href="#shop">CLOTHING</a>
          <a href="#story">OUR STORY</a>
          <a href="#footer">CONTACT</a>
        </nav>

        <div className="header-actions">
          {accountLoaded ? (
            accountUser ? (
              <div className="signed-in-actions">
                <button
                  className="logout-link"
                  disabled={signingOut}
                  onClick={signOut}
                  type="button"
                >
                  <LogOut aria-hidden="true" size={14} />
                  {signingOut ? 'SIGNING OUT' : 'LOG OUT'}
                </button>
              </div>
            ) : (
              <>
                <Link aria-label="Log in" className="account-link" href="/login">
                  LOG IN
                </Link>
                <Link aria-label="Sign up" className="signup-link" href="/signup">
                  SIGN UP
                </Link>
              </>
            )
          ) : (
            <span aria-label="Loading account" className="account-loading" />
          )}
          {authMessage ? (
            <span aria-live="polite" className="header-auth-message" role="status">
              {authMessage}
            </span>
          ) : null}
          <a aria-label="Jump to new arrivals" className="icon-link" href="#new-in">
            <Heart aria-hidden="true" size={19} strokeWidth={1.5} />
          </a>
          <button
            aria-label={`Shopping bag, ${bagItems.length} ${bagItems.length === 1 ? 'item' : 'items'}`}
            className="bag-link"
            disabled={checkingAccount}
            onClick={openBag}
            type="button"
          >
            <ShoppingBag aria-hidden="true" size={18} strokeWidth={1.5} />
            <span>BAG ({bagItems.length})</span>
          </button>
          <a aria-label="Jump to clothing" className="mobile-menu" href="#shop">
            <Menu aria-hidden="true" size={22} />
          </a>
        </div>
      </header>

      <section aria-labelledby="hero-title" className="hero">
        <div className="hero-image" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">THE NEW SEASON, MADE SIMPLE</p>
          <h1 id="hero-title">Wear what<br />moves you.</h1>
          <p className="hero-description">
            Considered pieces for a life in motion. Meet your new everyday.
          </p>
          <a className="button button-light" href="#new-in">
            SHOP NEW ARRIVALS <ArrowRight aria-hidden="true" size={15} />
          </a>
        </div>
        <p className="hero-caption">SPRING / SUMMER 2026 — THE EVERYDAY EDIT</p>
      </section>

      <section aria-label="Shop by category" className="service-ribbon">
        <a href="#new-in">
          <span className="ribbon-icon"><Sparkles aria-hidden="true" /></span>
          <span>NEW ARRIVALS</span>
        </a>
        <a href="#shop">
          <span className="ribbon-icon"><ShoppingBag aria-hidden="true" /></span>
          <span>CLOTHING</span>
        </a>
        <a href="#story">
          <span className="ribbon-icon"><Heart aria-hidden="true" /></span>
          <span>THE EVERYDAY EDIT</span>
        </a>
        <a href="/shipping">
          <span className="ribbon-icon"><PackageCheck aria-hidden="true" /></span>
          <span>SHIPPING &amp; RETURNS</span>
        </a>
      </section>

      <section aria-labelledby="shop-title" className="content-section services-section" id="shop">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GOOD THINGS, JUST IN</p>
            <h2 id="shop-title">The pieces you&apos;ll reach for.</h2>
          </div>
          <a className="text-link shop-all-link" href="#new-in">
            SHOP ALL NEW IN <ArrowUpRight aria-hidden="true" size={14} />
          </a>
        </div>

        <div className="product-grid" id="new-in">
          {products.map((product) => (
            <article className="product-card" key={product.name}>
              <div className="product-image-wrap">
                <Image
                  className="product-image"
                  src={product.image}
                  alt={`${product.name} — ${product.detail}`}
                  loading="lazy"
                  decoding="async"
                  fill
                  sizes="(max-width: 620px) 50vw, (max-width: 850px) 50vw, 25vw"
                  unoptimized
                />
                {product.label ? (
                  <span className="product-label">{product.label}</span>
                ) : null}
                <button
                  aria-label={`Add ${product.name} to bag`}
                  className="product-add"
                  disabled={checkingAccount}
                  onClick={() => addToBag(product.name)}
                  type="button"
                >
                  <ShoppingBag aria-hidden="true" size={16} />
                </button>
              </div>
              <div className="product-copy">
                <div className="product-title-row">
                  <h3>{product.name}</h3>
                  <span>{product.price}</span>
                </div>
                <div className="product-detail-row">
                  <p>{product.detail}</p>
                  <span aria-label={`Color ${product.detail.split('·').at(-1)?.trim()}`} className="product-swatch" style={{ backgroundColor: product.color }} />
                </div>
                {lastAdded === product.name ? (
                  <p aria-live="polite" className="product-feedback">Added to your bag</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {accountMessage ? (
          <p aria-live="polite" className="auth-message" role="status">
            {accountMessage}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="story-title" className="editorial-section" id="story">
        <div className="editorial-image">
          <div
            aria-label="A model wearing an effortless everyday outfit"
            className="editorial-photo"
            role="img"
            style={{
              backgroundImage:
                'url("https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85")',
            }}
          />
          <span className="image-note">GET DRESSED. GET ON WITH IT.</span>
        </div>
        <div className="editorial-copy">
          <p className="eyebrow">THOUGHTFUL BY DESIGN</p>
          <h2 id="story-title">A little less,<br />a lot more you.</h2>
          <p className="editorial-description">
            We make versatile, beautifully considered clothing for real days.
            The kind you wear on repeat, and love a little more each time.
          </p>
          <div className="highlight-list">
            {shopNotes.map(({ number, title, text, icon: Icon }) => (
              <div className="highlight" key={number}>
                <span className="highlight-number">{number}</span>
                <span className="highlight-icon"><Icon aria-hidden="true" size={17} /></span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <a className="text-link" href="#shop">
            FIND YOUR EVERYDAY <ArrowRight aria-hidden="true" size={14} />
          </a>
        </div>
      </section>

      <section aria-label="Shop the collection" className="closing-banner">
        <div>
          <p className="eyebrow">GOOD CLOTHES. NO COMPLICATED PLANS.</p>
          <h2>Get dressed for your days.</h2>
        </div>
        <a className="button button-dark" href="#shop">
          EXPLORE THE COLLECTION <ArrowRight aria-hidden="true" size={15} />
        </a>
      </section>

      <footer className="site-footer" id="footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link className="wordmark" href="/">MORROW <span>STUDIO</span></Link>
            <p>Everyday clothes,<br />made to feel like you.</p>
          </div>
          <div className="footer-column">
            <h2>SHOP</h2>
            <a href="#new-in">New arrivals</a>
            <a href="#shop">Clothing</a>
            <a href="#story">The everyday edit</a>
          </div>
          <div className="footer-column">
            <h2>HERE TO HELP</h2>
            <a href="mailto:hello@morrows.studio">Contact us</a>
            <Link href="/shipping">Shipping &amp; returns</Link>
            <Link href="/size-guide">Size guide</Link>
            <Link href="/login">Log in / Your account</Link>
          </div>
          <div className="footer-note">
            <PackageCheck aria-hidden="true" size={20} strokeWidth={1.4} />
            <p>Free shipping over $150<br />Easy 30-day returns</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 MORROW STUDIO. ALL RIGHTS RESERVED.</span>
          <Link href="/privacy">PRIVACY &amp; TERMS</Link>
        </div>
      </footer>

      {bagOpen ? (
        <div className="bag-overlay" onClick={() => setBagOpen(false)}>
          <section
            aria-label="Your shopping bag"
            aria-modal="true"
            className="bag-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="bag-panel-heading">
              <div>
                <p className="eyebrow">YOUR EVERYDAY EDIT</p>
                <h2>
                  {orderConfirmation
                    ? 'Order received'
                    : bagView === 'orders'
                      ? 'Your orders'
                      : `Your bag (${bagItems.length})`}
                </h2>
              </div>
              <button
                aria-label="Close shopping bag"
                className="bag-close"
                onClick={() => {
                  setBagOpen(false);
                  setCheckoutOpen(false);
                  setPaymentMessage('');
                }}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            {!orderConfirmation && !checkoutOpen ? (
              <div aria-label="Bag navigation" className="bag-view-switch" role="tablist">
                <button
                  aria-selected={bagView === 'bag'}
                  className={bagView === 'bag' ? 'active' : ''}
                  onClick={() => setBagView('bag')}
                  role="tab"
                  type="button"
                >
                  YOUR BAG ({bagItems.length})
                </button>
                <button
                  aria-selected={bagView === 'orders'}
                  className={bagView === 'orders' ? 'active' : ''}
                  onClick={showCustomerOrders}
                  role="tab"
                  type="button"
                >
                  MY ORDERS
                </button>
              </div>
            ) : null}
            {orderConfirmation ? (
              <div className="order-confirmation">
                <span aria-hidden="true" className="order-confirmation-mark">
                  <Check aria-hidden="true" size={25} />
                </span>
                <p className="checkout-eyebrow">THANK YOU</p>
                <h3>Your order is in.</h3>
                <p>
                  Order number <strong>{orderConfirmation.orderId}</strong>
                </p>
                <p className="order-pending">
                  Payment is pending manual verification. We have not verified the
                  transfer yet. Keep your payment receipt until we confirm it.
                </p>
                <p className="order-contact">
                  We&apos;ll use your account email, {accountUser?.email}, if we need to
                  contact you about delivery.
                </p>
                <Link className="button button-dark order-history-cta" href="/account">
                  VIEW YOUR ORDERS <ArrowRight aria-hidden="true" size={15} />
                </Link>
                <button
                  className="place-order-button"
                  onClick={() => {
                    setBagOpen(false);
                    setCheckoutOpen(false);
                    setPaymentMethod(null);
                    setPaymentReference('');
                    setPaymentSent(false);
                    setOrderConfirmation(null);
                  }}
                  type="button"
                >
                  BACK TO SHOP
                </button>
              </div>
            ) : bagView === 'orders' ? (
              <div aria-live="polite" className="bag-orders-view" role="tabpanel">
                {ordersLoading ? (
                  <p className="bag-orders-message">Loading your orders…</p>
                ) : ordersMessage ? (
                  <p className="bag-orders-message" role="alert">{ordersMessage}</p>
                ) : customerOrders.length === 0 ? (
                  <div className="bag-orders-empty">
                    <PackageCheck aria-hidden="true" size={26} />
                    <h3>No orders yet.</h3>
                    <p>Your orders will appear here after you place one.</p>
                    <button type="button" onClick={() => setBagView('bag')}>
                      BACK TO YOUR BAG
                    </button>
                  </div>
                ) : (
                  <div className="bag-order-list">
                    {customerOrders.map((order) => (
                      <article className="bag-order-card" key={order.id}>
                        <div className="bag-order-heading">
                          <div>
                            <strong>{order.id}</strong>
                            <span>
                              {new Date(order.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <span className={`customer-order-status status-${order.status}`}>
                            {orderStatusLabels[order.status]}
                          </span>
                        </div>
                        <ul>
                          {order.items.map((item, index) => (
                            <li key={`${order.id}-${item.name}-${index}`}>
                              <span>{item.name}</span>
                              <span>${item.unitPrice.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="bag-order-footer">
                          <span>Paid with {order.paymentMethod === 'gcash' ? 'GCash' : 'Maya'}</span>
                          <strong>${order.total.toFixed(2)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : bagItems.length && !checkoutOpen ? (
              <>
                <ul className="bag-items">
                  {bagItems.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.name}</strong>
                        <span>{item.price}</span>
                      </span>
                      <button
                        className="bag-remove"
                        onClick={() =>
                          updateBagItems((items) =>
                            items.filter((bagItem) => bagItem.id !== item.id),
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="bag-subtotal">
                  <span>Subtotal</span>
                  <strong>${bagTotal.toFixed(2)}</strong>
                </div>
                <p className="bag-shipping-note">
                  Shipping is complimentary on orders over $150.
                </p>
              </>
            ) : bagItems.length ? (
              <div className="checkout-content">
                <button
                  className="checkout-back"
                  onClick={() => {
                    setCheckoutOpen(false);
                    setPaymentMessage('');
                  }}
                  type="button"
                >
                  <ArrowRight aria-hidden="true" size={14} /> BACK TO YOUR BAG
                </button>
                <p className="checkout-eyebrow">SECURE CHECKOUT</p>
                <h3 className="checkout-title">Choose how to pay.</h3>
                <p className="checkout-description">
                  Select a mobile wallet for your order.
                </p>
                <div aria-label="Payment method" className="payment-methods">
                  {(['gcash', 'maya'] as const).map((method) => (
                    <button
                      aria-pressed={paymentMethod === method}
                      className={`payment-option${paymentMethod === method ? ' selected' : ''}`}
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method);
                        setPaymentMessage('');
                        setPaymentQrUnavailable(false);
                      }}
                      type="button"
                    >
                      <span className={`payment-logo ${method}`}>
                        <span>{method === 'gcash' ? 'GCash' : 'maya'}</span>
                      </span>
                      <span className="payment-option-copy">
                        <strong>{method === 'gcash' ? 'GCash' : 'Maya'}</strong>
                        <span>Mobile wallet</span>
                      </span>
                      <span aria-hidden="true" className="payment-radio" />
                    </button>
                  ))}
                </div>
                {paymentMethod ? (
                  <div className="payment-qr">
                    {paymentQrUnavailable ? (
                      <div aria-live="polite" className="payment-qr-missing" role="status">
                        <ShoppingBag aria-hidden="true" size={22} />
                        <strong>{paymentMethod === 'gcash' ? 'GCash QR not added yet' : 'Maya QR unavailable'}</strong>
                        <span>
                          {paymentMethod === 'gcash'
                            ? 'Add gcash.png to the public folder to show your GCash QR here.'
                            : 'Please check the Maya QR image in the public folder.'}
                        </span>
                      </div>
                    ) : (
                      <Image
                        alt={`${paymentMethod === 'gcash' ? 'GCash' : 'Maya'} payment QR code. Verify the recipient details shown before sending money.`}
                        className="payment-qr-image"
                        height={438}
                        onError={() => setPaymentQrUnavailable(true)}
                        src={`/${paymentMethod}.png`}
                        unoptimized
                        width={320}
                      />
                    )}
                    <p>
                      Scan with {paymentMethod === 'gcash' ? 'GCash' : 'Maya'} and verify
                      the recipient details before sending.
                    </p>
                  </div>
                ) : null}
                <div className="checkout-total">
                  <span>Order total</span>
                  <strong>${bagTotal.toFixed(2)}</strong>
                </div>
                <p className="payment-notice">
                  Scan the selected QR, verify the recipient and amount, then enter
                  your transfer reference below. Your order stays pending until the
                  payment is checked manually.
                </p>
                <form className="order-form" onSubmit={submitOrder}>
                  <label htmlFor="checkout-name">Full name</label>
                  <input
                    autoComplete="name"
                    id="checkout-name"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) => setCustomerName(event.target.value)}
                    required
                    value={customerName}
                  />
                  <label htmlFor="checkout-phone">Mobile number</label>
                  <input
                    autoComplete="tel"
                    id="checkout-phone"
                    inputMode="tel"
                    maxLength={24}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    pattern="[+()0-9 .-]{7,24}"
                    required
                    value={customerPhone}
                  />
                  <label htmlFor="checkout-address">Delivery address</label>
                  <textarea
                    autoComplete="street-address"
                    id="checkout-address"
                    maxLength={500}
                    minLength={10}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    required
                    rows={3}
                    value={deliveryAddress}
                  />
                  <label htmlFor="payment-reference">
                    {paymentMethod === 'gcash' ? 'GCash' : 'Maya'} transaction reference
                  </label>
                  <input
                    autoComplete="off"
                    id="payment-reference"
                    maxLength={100}
                    minLength={4}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    required
                    value={paymentReference}
                  />
                  <label className="payment-confirm-label">
                    <input
                      checked={paymentSent}
                      onChange={(event) => setPaymentSent(event.target.checked)}
                      required
                      type="checkbox"
                    />
                    I have sent the order total using the selected QR code.
                  </label>
                  {paymentMessage ? (
                    <p aria-live="polite" className="payment-message" role="status">
                      {paymentMessage}
                    </p>
                  ) : null}
                  <button
                    className="place-order-button"
                    disabled={submittingOrder || paymentQrUnavailable}
                    type="submit"
                  >
                    {submittingOrder ? 'SUBMITTING ORDER…' : 'PLACE ORDER'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bag-empty">
                <ShoppingBag aria-hidden="true" size={28} />
                <p>Your bag is waiting for something good.</p>
                <a href="#new-in" onClick={() => setBagOpen(false)}>
                  EXPLORE NEW ARRIVALS <ArrowRight aria-hidden="true" size={14} />
                </a>
              </div>
            )}
            {bagItems.length > 0 && !checkoutOpen ? (
              <button
                className="bag-continue bag-order-method"
                onClick={() => {
                  setCheckoutOpen(true);
                  setPaymentMessage('');
                }}
                type="button"
              >
                ORDER METHOD <ArrowRight aria-hidden="true" size={15} />
              </button>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
