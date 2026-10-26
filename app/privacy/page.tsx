import { InfoPage } from '@/components/info-page';

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="THE IMPORTANT DETAILS"
      title="Privacy & terms."
      sections={[
        {
          heading: 'Your information',
          text: 'Account details are used to provide sign-in and email verification. Passwords are stored as salted hashes, and verification codes expire after 10 minutes.',
        },
        {
          heading: 'Your choices',
          text: 'You can sign out from your account at any time. For questions about your account data, contact hello@morrows.studio.',
        },
        {
          heading: 'Store information',
          text: 'Product prices and store policies shown on this demonstration storefront are informational. Contact us before relying on an order, return, or delivery estimate.',
        },
      ]}
    />
  );
}
