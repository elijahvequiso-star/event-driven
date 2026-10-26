import { InfoPage } from '@/components/info-page';

export default function SizeGuidePage() {
  return (
    <InfoPage
      eyebrow="FIND YOUR FIT"
      title="Size guide."
      sections={[
        {
          heading: 'A comfortable fit',
          text: 'Our pieces are designed for everyday ease. Check the product details for fit notes, and choose your usual size for a relaxed fit.',
        },
        {
          heading: 'Between sizes?',
          text: 'Choose the smaller size for a closer fit or size up for more room. For the best recommendation on a specific item, write to hello@morrows.studio.',
        },
        {
          heading: 'Still not quite right?',
          text: 'Unused items can be returned within 30 days. Visit our shipping and returns page for details.',
        },
      ]}
    />
  );
}
