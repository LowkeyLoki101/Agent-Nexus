import { getUncachableStripeClient } from './stripeClient';

async function seedStripeProducts() {
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({ query: "name:'Creative Intelligence Pro'" });
  if (existingProducts.data.length > 0) {
    console.log('Product already exists:', existingProducts.data[0].id);
    const prices = await stripe.prices.list({ product: existingProducts.data[0].id, active: true });
    console.log('Price:', prices.data[0]?.id);

    const coupons = await stripe.coupons.list({ limit: 20 });
    const existingCoupon = coupons.data.find(c => c.name === 'FOUNDING_MEMBER');
    if (existingCoupon) {
      console.log('Coupon already exists:', existingCoupon.id);
      const promoCodes = await stripe.promotionCodes.list({ coupon: existingCoupon.id, limit: 5 });
      console.log('Promo codes:', promoCodes.data.map(p => p.code));
    }

    const firstMonthCoupon = coupons.data.find(c => c.name === 'FIRST_MONTH_FREE');
    if (firstMonthCoupon) {
      console.log('First month free coupon already exists:', firstMonthCoupon.id);
      const promoCodes = await stripe.promotionCodes.list({ coupon: firstMonthCoupon.id, limit: 5 });
      console.log('Promo codes:', promoCodes.data.map(p => p.code));
    } else {
      console.log('Creating first month free coupon...');
      const newCoupon = await stripe.coupons.create({
        name: 'FIRST_MONTH_FREE',
        percent_off: 100,
        duration: 'once',
        metadata: { type: 'first_month_free' },
      });
      console.log('Coupon created:', newCoupon.id);

      const promoCode = await stripe.promotionCodes.create({
        coupon: newCoupon.id,
        code: 'TRYFREE',
        max_redemptions: 500,
        metadata: { type: 'first_month_free' },
      });
      console.log('Promo code created:', promoCode.code, '(100% off first month, then auto-charges $49/month)');
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

  const firstMonthCoupon = await stripe.coupons.create({
    name: 'FIRST_MONTH_FREE',
    percent_off: 100,
    duration: 'once',
    metadata: { type: 'first_month_free' },
  });
  console.log('First month free coupon created:', firstMonthCoupon.id);

  const firstMonthPromo = await stripe.promotionCodes.create({
    coupon: firstMonthCoupon.id,
    code: 'TRYFREE',
    max_redemptions: 500,
    metadata: { type: 'first_month_free' },
  });
  console.log('Promo code created:', firstMonthPromo.code, '(100% off first month, then auto-charges $49/month)');

  console.log('\n=== SETUP COMPLETE ===');
  console.log('Product:', product.id);
  console.log('Price:', price.id);
  console.log('Coupon Code: FOUNDING2026 (100% off forever)');
  console.log('Coupon Code: TRYFREE (first month free, then $49/month)');
}

seedStripeProducts().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
