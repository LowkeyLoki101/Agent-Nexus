import Stripe from "stripe";

let cachedStripeKey: string | null = null;
let stripeInstance: Stripe | null = null;

async function getStripeKey(): Promise<string> {
  if (cachedStripeKey) return cachedStripeKey;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new Error("Stripe connector hostname not configured");
  }

  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("Stripe auth token not found");
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const environments = isProduction ? ['production', 'development'] : ['development', 'production'];

  for (const env of environments) {
    try {
      const url = new URL(`https://${hostname}/api/v2/connection`);
      url.searchParams.set('include_secrets', 'true');
      url.searchParams.set('connector_names', 'stripe');
      url.searchParams.set('environment', env);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const connection = data.items?.[0];

      if (connection?.settings?.secret) {
        cachedStripeKey = connection.settings.secret;
        console.log(`[stripe] Credentials loaded from ${env} environment`);
        return cachedStripeKey!;
      }
    } catch {
      continue;
    }
  }

  throw new Error("No Stripe connection found in any environment");
}

export async function getStripe(): Promise<Stripe> {
  if (stripeInstance) return stripeInstance;
  const key = await getStripeKey();
  stripeInstance = new Stripe(key);
  return stripeInstance;
}

export async function checkStripeConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const stripe = await getStripe();
    await stripe.balance.retrieve();
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

export async function createCheckoutSession(params: {
  listingTitle: string;
  listingSlug: string;
  priceInCents: number;
  currency: string;
  buyerEmail: string;
  listingId: string;
  factoryOwnerId: string;
  stripeAccountId?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = await getStripe();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer_email: params.buyerEmail,
    line_items: [
      {
        price_data: {
          currency: params.currency,
          product_data: {
            name: params.listingTitle,
          },
          unit_amount: params.priceInCents,
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      listingId: params.listingId,
      listingSlug: params.listingSlug,
      factoryOwnerId: params.factoryOwnerId,
    },
  };

  if (params.stripeAccountId) {
    sessionParams.payment_intent_data = {
      application_fee_amount: Math.round(params.priceInCents * 0.1),
      transfer_data: {
        destination: params.stripeAccountId,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session.url!;
}

export async function createConnectAccount(email: string): Promise<{ accountId: string; onboardingUrl: string }> {
  const stripe = await getStripe();

  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : ''}/storefront-manage?stripe=refresh`,
    return_url: `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : ''}/storefront-manage?stripe=return`,
    type: "account_onboarding",
  });

  return { accountId: account.id, onboardingUrl: accountLink.url };
}

export async function getConnectAccountStatus(accountId: string): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }> {
  const stripe = await getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

export async function constructWebhookEvent(body: string | Buffer, signature: string, secret: string): Promise<Stripe.Event> {
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(body, signature, secret);
}
