import { NextResponse } from 'next/server';
import {
  deleteAuthUser,
  getAuthUser,
  hashPassword,
  updateAuthUser,
} from '@/lib/auth';
import { isAdminSession } from '@/lib/admin-auth';
import { deleteOrder, updateOrderStatus, StoreOrder } from '@/lib/orders';
import { deleteProduct, updateProduct, Product } from '@/lib/products';

export const runtime = 'nodejs';

async function authorized() {
  try {
    return await isAdminSession();
  } catch (error) {
    console.error('Unable to verify admin access:', error);
    return false;
  }
}

function parseProduct(value: unknown): Product | null {
  if (typeof value !== 'object' || value === null) return null;
  const product = value as Record<string, unknown>;
  if (
    typeof product.name !== 'string' ||
    product.name.trim().length < 2 ||
    product.name.trim().length > 100 ||
    typeof product.detail !== 'string' ||
    product.detail.trim().length > 160 ||
    typeof product.price !== 'number' ||
    !Number.isFinite(product.price) ||
    product.price <= 0 ||
    product.price > 100000 ||
    typeof product.image !== 'string' ||
    product.image.trim().length < 1 ||
    product.image.trim().length > 1000 ||
    typeof product.color !== 'string' ||
    !/^#[\da-f]{6}$/i.test(product.color) ||
    typeof product.label !== 'string' ||
    product.label.length > 30
  ) {
    return null;
  }
  return {
    name: product.name.trim(),
    detail: product.detail.trim(),
    price: `$${product.price.toFixed(2)}`,
    label: product.label.trim(),
    image: product.image.trim(),
    color: product.color,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  if (!(await authorized())) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const { resource, id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter valid details.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Enter valid details.' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  if (resource === 'users') {
    const user = await getAuthUser(id);
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    if (
      typeof input.name !== 'string' ||
      input.name.trim().length < 2 ||
      input.name.trim().length > 80 ||
      typeof input.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
    ) {
      return NextResponse.json({ error: 'Enter a valid name and email.' }, { status: 400 });
    }
    const email = input.email.trim().toLowerCase();
    if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
      return NextResponse.json({ error: 'That email is reserved for the admin account.' }, { status: 409 });
    }
    const existing = await getAuthUser(email);
    if (existing && existing.email !== user.email) {
      return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 });
    }
    const updates: {
      name: string;
      email: string;
      passwordSalt?: string;
      passwordHash?: string;
    } = { name: input.name.trim(), email };
    if (input.password !== undefined && input.password !== '') {
      if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
        return NextResponse.json({ error: 'A new password must be 8 to 128 characters.' }, { status: 400 });
      }
      const { salt, hash } = await hashPassword(input.password);
      updates.passwordSalt = salt;
      updates.passwordHash = hash;
    }
    await updateAuthUser(user.email, updates);
    return NextResponse.json({ name: updates.name, email: updates.email, createdAt: user.createdAt });
  }

  if (resource === 'products') {
    const product = parseProduct(body);
    if (!product) return NextResponse.json({ error: 'Enter valid product details.' }, { status: 400 });
    const updated = await updateProduct(id, product);
    if (!updated) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    return NextResponse.json(product);
  }

  if (resource === 'orders') {
    const statuses: StoreOrder['status'][] = [
      'pending_verification',
      'paid',
      'fulfilled',
      'cancelled',
    ];
    if (typeof input.status !== 'string' || !statuses.includes(input.status as StoreOrder['status'])) {
      return NextResponse.json({ error: 'Choose a valid order status.' }, { status: 400 });
    }
    const order = await updateOrderStatus(id, input.status as StoreOrder['status']);
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json(order);
  }

  return NextResponse.json({ error: 'Unknown admin resource.' }, { status: 404 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  if (!(await authorized())) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }
  const { resource, id } = await params;

  if (resource === 'users') {
    if (id === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
      return NextResponse.json({ error: 'The admin account cannot be deleted here.' }, { status: 403 });
    }
    if (!(await deleteAuthUser(id))) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    return NextResponse.json({ message: 'User deleted.' });
  }

  if (resource === 'products') {
    if (!(await deleteProduct(id))) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Product deleted.' });
  }

  if (resource === 'orders') {
    const deleted = await deleteOrder(id);
    if (!deleted) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json({ message: 'Order deleted.' });
  }

  return NextResponse.json({ error: 'Unknown admin resource.' }, { status: 404 });
}
