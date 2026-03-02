import Stripe from 'stripe';

let cachedCredentials: { publishableKey: string; secretKey: string } | null = null;

async function getCredentials() {
  if (cachedCredentials) return cachedCredentials;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new Error('Stripe connector hostname not configured');
  }

  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('Stripe auth token not found');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const environments = isProduction ? ['production', 'development'] : ['development', 'production'];

  for (const env of environments) {
    try {
      const url = new URL(`https://${hostname}/api/v2/connection`);
      url.searchParams.set('include_secrets', 'true');
      url.searchParams.set('connector_names', connectorName);
      url.searchParams.set('environment', env);

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'X-Replit-Token': xReplitToken
        }
      });

      if (!response.ok) continue;

      const data = await response.json();
      const connection = data.items?.[0];

      if (connection?.settings?.publishable && connection?.settings?.secret) {
        cachedCredentials = {
          publishableKey: connection.settings.publishable,
          secretKey: connection.settings.secret,
        };
        console.log(`[stripe] Credentials loaded from ${env} environment`);
        return cachedCredentials;
      }
    } catch {
      continue;
    }
  }

  throw new Error('No Stripe connection found in any environment');
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
