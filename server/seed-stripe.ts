import { getUncachableStripeClient } from './stripeClient';

async function seedStripeProducts() {
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({ query: "name:'Creative Intelligence Pro'" });
  if (existingProducts.data.length > 0) {
    console.log('Product already exists:', existingProducts.data[0].id);
    const prices = await stripe.prices.list({ product: existingProducts.data[0].id, active: true });
    console.log('Price:', prices.data[0]?.id);

    const coupons = await stripe.coupons.list({ limit: 10 });
    const existingCoupon = coupons.data.find(c => c.name === 'FOUNDING_MEMBER');
    if (existingCoupon) {
      console.log('Coupon already exists:', existingCoupon.id);
      const promoCodes = await stripe.promotionCodes.list({ coupon: existingCoupon.id, limit: 5 });
      console.log('Promo codes:', promoCodes.data.map(p => p.code));
    }
    return;
  }

  console.log('Creating Creative Intelligence Pro product...');
  const product = await stripe.products.create({
    name: 'Creative Intelligence Pro',
    description: 'Full access to the Creative Intelligence platform - Agent Factory, Assembly Lines, Newsroom, and more.',
    metadata: {
      plan: 'pro',
      app: 'creative-intelligence',
    },
  });
  console.log('Product created:', product.id);

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 4900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'pro_monthly' },
  });
  console.log('Price created:', price.id, '($49/month)');

  const coupon = await stripe.coupons.create({
    name: 'FOUNDING_MEMBER',
    percent_off: 100,
    duration: 'forever',
    metadata: { type: 'founding_member' },
  });
  console.log('Coupon created:', coupon.id);

  const promoCode = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: 'FOUNDING2026',
    max_redemptions: 50,
    metadata: { type: 'founding_member' },
  });
  console.log('Promo code created:', promoCode.code);

  console.log('\n=== SETUP COMPLETE ===');
  console.log('Product:', product.id);
  console.log('Price:', price.id);
  console.log('Coupon Code: FOUNDING2026 (100% off forever)');
}

seedStripeProducts().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
