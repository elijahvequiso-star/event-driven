import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { readCustomerOrders, type CustomerOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';

const orderStatusLabels = {
  pending_verification: 'Payment pending verification',
  paid: 'Payment verified',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
} as const;

export default async function AccountPage() {
  const cookieStore = await cookies();
  const email = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) redirect(`/login?next=${encodeURIComponent('/account')}`);

  let orders: CustomerOrder[] = [];
  let loadError = false;
  try {
    orders = await readCustomerOrders(email);
  } catch (error) {
    console.error('Unable to load customer order history:', error);
    loadError = true;
  }

  return (
    <main className="order-history-page">
      <Link aria-label="Morrow Studio home" className="wordmark auth-wordmark" href="/">
        MORROW <span>STUDIO</span>
      </Link>
      <section aria-labelledby="order-history-title" className="order-history-shell">
        <div className="order-history-heading">
          <div>
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h1 id="order-history-title">Your orders.</h1>
            <p className="auth-description">Order history for {email}.</p>
          </div>
          <Link className="button button-dark" href="/#new-in">
            CONTINUE SHOPPING
          </Link>
        </div>

        {loadError ? (
          <div aria-live="polite" className="order-history-empty" role="status">
            <h2>We couldn&apos;t load your orders.</h2>
            <p>Please try again in a moment.</p>
            <Link href="/account">TRY AGAIN</Link>
          </div>
        ) : orders.length === 0 ? (
          <div className="order-history-empty">
            <h2>No orders yet.</h2>
            <p>Your orders will appear here after you place one.</p>
            <Link href="/#new-in">EXPLORE THE COLLECTION</Link>
          </div>
        ) : (
          <div aria-label="Your orders" className="customer-order-list">
            {orders.map((order) => (
              <article className="customer-order-card" key={order.id}>
                <header className="customer-order-heading">
                  <div>
                    <p className="customer-order-number">ORDER {order.id}</p>
                    <p className="customer-order-date">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`customer-order-status status-${order.status}`}>
                    {orderStatusLabels[order.status]}
                  </span>
                </header>
                <ul className="customer-order-items">
                  {order.items.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      <span>{item.name}</span>
                      <span>${item.unitPrice.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <footer className="customer-order-footer">
                  <span>Paid with {order.paymentMethod === 'gcash' ? 'GCash' : 'Maya'}</span>
                  <strong>Total ${order.total.toFixed(2)}</strong>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
