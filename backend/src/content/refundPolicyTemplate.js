const DEFAULT_WINDOW_HOURS = 48;

function formatHoursLabel(hours) {
  if (hours === 1) return '1 hour';
  return `${hours} hours`;
}

function buildRefundPolicyContent({ windowHours = DEFAULT_WINDOW_HOURS, lastUpdated } = {}) {
  const hoursLabel = formatHoursLabel(windowHours);
  const updated =
    lastUpdated ||
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  return {
    title: 'Refund Policy',
    lastUpdated: updated,
    windowHours,
    sections: [
      {
        heading: '1. Overview',
        body: 'Joymed sells virtual currency (Gold), energy packs, and optional VIP subscriptions. This policy explains when refunds are available for Gold purchases.',
      },
      {
        heading: '2. Eligibility Window',
        body: `You may request a refund within ${hoursLabel} of purchase if: (a) the Gold from that purchase has not been spent in-game, and (b) the transaction status is "Succeeded".`,
      },
      {
        heading: '3. How to Request',
        body: 'Go to Billing History, find the eligible transaction, and click "Request Refund". Select a reason and submit. Eligible requests are reviewed by an admin before processing.',
      },
      {
        heading: '4. Gold Deduction',
        body: 'Upon refund approval, the Gold credited from that purchase will be removed from your account. If you have insufficient Gold (because you spent some), the refund may be partially denied.',
      },
      {
        heading: '5. Processing Time',
        body: 'Approved refunds are submitted to Stripe immediately. Funds typically return to your payment method within 5–10 business days, depending on your bank or card issuer.',
      },
      {
        heading: '6. Non-Refundable Items',
        body: `Gold that has been spent, purchases older than ${hoursLabel}, and subscription periods already consumed are not eligible for refund under this policy.`,
      },
      {
        heading: '7. Chargebacks',
        body: 'Please contact us before initiating a chargeback. Fraudulent chargebacks may result in permanent account suspension.',
      },
      {
        heading: '8. Contact',
        body: 'Refund questions: support@joymed.example.com',
      },
    ],
  };
}

module.exports = {
  DEFAULT_WINDOW_HOURS,
  buildRefundPolicyContent,
  formatHoursLabel,
};
