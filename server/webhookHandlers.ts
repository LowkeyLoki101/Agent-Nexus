import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function syncSubscriptionToUser(customerId: string) {
  try {
    const stripe = await getUncachableStripeClient();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    });

    let status = "none";
    let subId: string | null = null;
    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      subId = sub.id;
      if (sub.status === "active" || sub.status === "trialing") {
        status = "active";
      } else if (sub.status === "past_due") {
        status = "past_due";
      } else if (sub.status === "canceled" || sub.status === "unpaid") {
        status = "cancelled";
      } else {
        status = sub.status;
      }
    }

    await db.update(users)
      .set({ subscriptionStatus: status, stripeSubscriptionId: subId })
      .where(eq(users.stripeCustomerId, customerId));

    console.log(`Synced subscription for customer ${customerId}: status=${status}`);
  } catch (err) {
    console.error('Error syncing subscription to user:', err);
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const stripe = await getUncachableStripeClient();
      const endpointSecret = sync.webhookSecret;
      let event;
      
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      } else {
        event = JSON.parse(payload.toString());
      }

      const subscriptionEvents = [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'checkout.session.completed',
        'invoice.paid',
        'invoice.payment_failed',
      ];

      if (subscriptionEvents.includes(event.type)) {
        let customerId: string | null = null;

        if (event.type === 'checkout.session.completed') {
          customerId = event.data.object.customer as string;
        } else if (event.data.object?.customer) {
          customerId = event.data.object.customer as string;
        }

        if (customerId) {
          await syncSubscriptionToUser(customerId);
        }
      }
    } catch (err) {
      console.error('Error processing webhook for user sync:', err);
    }
  }
}
