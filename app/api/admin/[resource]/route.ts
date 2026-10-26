import { NextResponse } from 'next/server';
import {
  createAuthUser,
  hashPassword,
  getAuthUser,
  listAuthUsers,
} from '@/lib/auth';
import { isAdminSession } from '@/lib/admin-auth';
import { createOrder, readOrders } from '@/lib/orders';
import { Product, readProducts, insertProduct, getProductPrice } from '@/lib/products';

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  if (!(await authorized())) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const { resource } = await params;
  if (!['users', 'products', 'orders'].includes(resource)) {
    return NextResponse.json({ error: 'Unknown admin resource.' }, { status: 404 });
  }

  if (resource === 'users') {
    return NextResponse.json(await listAuthUsers());
  }
  if (resource === 'products') return NextResponse.json(await readProducts());
  return NextResponse.json(await readOrders());
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  if (!(await authorized())) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const { resource } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter valid details.' }, { status: 400 });
  }

  if (resource === 'products') {
    const product = parseProduct(body);
    if (!product) {
      return NextResponse.json({ error: 'Enter valid product details.' }, { status: 400 });
    }
    await insertProduct(product);
    return NextResponse.json(product, { status: 201 });
  }

  if (resource === 'users') {
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Enter valid user details.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (
      typeof input.name !== 'string' ||
      input.name.trim().length < 2 ||
      input.name.trim().length > 80 ||
      typeof input.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      typeof input.password !== 'string' ||
      input.password.length < 8 ||
      input.password.length > 128
    ) {
      return NextResponse.json({ error: 'Enter a name, valid email, and password of 8+ characters.' }, { status: 400 });
    }

    const email = input.email.trim().toLowerCase();
    if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
      return NextResponse.json({ error: 'That email is reserved for the admin account.' }, { status: 409 });
    }
    if (await getAuthUser(email)) {
      return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 });
    }
    const { salt, hash } = await hashPassword(input.password);
    const user = {
      name: input.name.trim(),
      email,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };
    await createAuthUser(user);
    return NextResponse.json(
      { name: user.name, email: user.email, createdAt: user.createdAt },
      { status: 201 },
    );
  }

  if (resource === 'orders') {
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Enter valid order details.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (
      typeof input.customerName !== 'string' ||
      input.customerName.trim().length < 2 ||
      input.customerName.trim().length > 100 ||
      typeof input.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      typeof input.phone !== 'string' ||
      !/^[+()\d .-]{7,24}$/.test(input.phone.trim()) ||
      typeof input.address !== 'string' ||
      input.address.trim().length < 10 ||
      input.address.trim().length > 500 ||
      (input.paymentMethod !== 'gcash' && input.paymentMethod !== 'maya') ||
      !Array.isArray(input.items) ||
      input.items.length < 1 ||
      input.items.length > 30
    ) {
      return NextResponse.json({ error: 'Enter valid customer, payment, and item details.' }, { status: 400 });
    }

    const orderItems = [];
    for (const item of input.items) {
      if (
        typeof item !== 'object' ||
        item === null ||
        !('name' in item) ||
        typeof item.name !== 'string'
      ) {
        return NextResponse.json({ error: 'The order contains an invalid item.' }, { status: 400 });
      }
      const unitPrice = await getProductPrice(item.name);
      if (unitPrice === null) {
        return NextResponse.json({ error: 'The order contains an unknown product.' }, { status: 400 });
      }
      orderItems.push({ name: item.name, unitPrice });
    }

    const order = await createOrder({
      customerName: input.customerName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      paymentMethod: input.paymentMethod,
      paymentReference: typeof input.paymentReference === 'string'
        ? input.paymentReference.trim().slice(0, 100)
        : 'Created by admin',
      items: orderItems,
      total: Number(orderItems.reduce((sum, item) => sum + item.unitPrice, 0).toFixed(2)),
    });
    return NextResponse.json(order, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown admin resource.' }, { status: 404 });
}
