import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuthUser, readSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { createOrder } from '@/lib/orders';
import { getProductPrice } from '@/lib/products';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const email = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!email) {
    return NextResponse.json({ error: 'Please sign in before placing an order.' }, { status: 401 });
  }

  if (!(await getAuthUser(email))) {
    return NextResponse.json({ error: 'Your account could not be found.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter valid order details.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Enter valid order details.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.customerName !== 'string' ||
    input.customerName.trim().length < 2 ||
    input.customerName.trim().length > 100 ||
    typeof input.phone !== 'string' ||
    !/^[+()\d .-]{7,24}$/.test(input.phone.trim()) ||
    typeof input.address !== 'string' ||
    input.address.trim().length < 10 ||
    input.address.trim().length > 500 ||
    typeof input.paymentReference !== 'string' ||
    input.paymentReference.trim().length < 4 ||
    input.paymentReference.trim().length > 100 ||
    (input.paymentMethod !== 'gcash' && input.paymentMethod !== 'maya') ||
    input.paymentSent !== true ||
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 30
  ) {
    return NextResponse.json(
      {
        error:
          'Enter your delivery details, a valid payment reference, select GCash or Maya, and confirm that you sent payment.',
      },
      { status: 400 },
    );
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
      return NextResponse.json(
        { error: 'The order contains a product that is no longer available.' },
        { status: 400 },
      );
    }
    orderItems.push({ name: item.name, unitPrice });
  }

  const total = Number(orderItems.reduce((sum, item) => sum + item.unitPrice, 0).toFixed(2));

  try {
    const order = await createOrder({
      customerName: input.customerName.trim(),
      email,
      phone: input.phone.trim(),
      address: input.address.trim(),
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference.trim(),
      items: orderItems,
      total,
    });
    return NextResponse.json(
      {
        orderId: order.id,
        status: 'pending_verification',
        message: 'Your order was received and is waiting for payment verification.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Unable to save the customer order:', error);
    return NextResponse.json(
      { error: 'We could not save your order. Please try again or contact support.' },
      { status: 500 },
    );
  }
}
