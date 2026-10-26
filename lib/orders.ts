import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

export type OrderItem = {
  name: string;
  unitPrice: number;
};

export type StoreOrder = {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  paymentMethod: 'gcash' | 'maya';
  paymentReference: string;
  items: OrderItem[];
  total: number;
  status: 'pending_verification' | 'paid' | 'fulfilled' | 'cancelled';
  createdAt: string;
};

export async function readOrders(): Promise<StoreOrder[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('orders')
    .select('id,customer_name,email,phone,address,payment_method,payment_reference,items,total,status,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(fromDatabaseOrder);
}

export async function createOrder(
  input: Omit<StoreOrder, 'id' | 'status' | 'createdAt'>,
): Promise<StoreOrder> {
  const order: StoreOrder = {
    ...input,
    id: `MRW-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: 'pending_verification',
    createdAt: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdmin().from('orders').insert(toDatabaseOrder(order));
  if (error) throw error;

  return order;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('orders')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function updateOrderStatus(
  id: string,
  status: StoreOrder['status'],
): Promise<StoreOrder | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select('id,customer_name,email,phone,address,payment_method,payment_reference,items,total,status,created_at')
    .maybeSingle();
  if (error) throw error;
  return data ? fromDatabaseOrder(data) : null;
}

function toDatabaseOrder(order: StoreOrder) {
  return {
    id: order.id,
    customer_name: order.customerName,
    email: order.email,
    phone: order.phone,
    address: order.address,
    payment_method: order.paymentMethod,
    payment_reference: order.paymentReference,
    items: order.items,
    total: order.total,
    status: order.status,
    created_at: order.createdAt,
  };
}

function fromDatabaseOrder(row: {
  id: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  payment_method: 'gcash' | 'maya';
  payment_reference: string;
  items: OrderItem[];
  total: number;
  status: StoreOrder['status'];
  created_at: string;
}): StoreOrder {
  return {
    id: row.id,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    items: row.items,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
}
