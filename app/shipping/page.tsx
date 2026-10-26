import { InfoPage } from '@/components/info-page';

export default function ShippingPage() {
  return (
    <InfoPage
      eyebrow="HERE TO HELP"
      title="Shipping & returns."
      sections={[
        {
          heading: 'Shipping',
          text: 'Standard shipping is complimentary on orders over $150. Orders are prepared within 1–3 business days; delivery timing depends on your location.',
        },
        {
          heading: 'Easy 30-day returns',
          text: 'Unused items in their original condition can be returned within 30 days of delivery. Contact hello@morrows.studio with your order details to get started.',
        },
        {
          heading: 'Need a hand?',
          text: 'Our team can help with an order or return at hello@morrows.studio.',
        },
      ]}
    />
  );
}
