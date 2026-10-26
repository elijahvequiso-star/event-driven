import { Product } from '@/lib/default-products';
import { getSupabaseAdmin } from '@/lib/supabase';

export { defaultProducts } from '@/lib/default-products';
export type { Product } from '@/lib/default-products';

export async function readProducts(): Promise<Product[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .select('name,detail,price,label,image,color')
    .eq('active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((product) => ({
    name: product.name,
    detail: product.detail,
    price: `$${Number(product.price).toFixed(2)}`,
    label: product.label,
    image: product.image,
    color: product.color,
  }));
}

export async function getProductPrice(name: string): Promise<number | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .select('price')
    .eq('name', name)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.price) : null;
}

function toDatabaseProduct(product: Product) {
  return {
    name: product.name,
    detail: product.detail,
    price: Number(product.price.replace('$', '')),
    label: product.label,
    image: product.image,
    color: product.color,
    active: true,
  };
}

export async function insertProduct(product: Product): Promise<void> {
  const { error } = await getSupabaseAdmin().from('products').insert(toDatabaseProduct(product));
  if (error) throw error;
}

export async function updateProduct(previousName: string, product: Product): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .update(toDatabaseProduct(product))
    .eq('name', previousName)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function deleteProduct(name: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .delete()
    .eq('name', name)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
