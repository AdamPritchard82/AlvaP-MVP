/**
 * Billing Provider Service
 * 
 * Stub implementation for future Stripe integration.
 * Currently logs operations without actual billing.
 */

const config = require('../config/config.cjs');

class BillingProvider {
  constructor() {
    this.provider = process.env.BILLING_PROVIDER || 'none';
    this.enabled = process.env.BILLING_ENABLED === 'true';
  }

  /**
   * Create a customer in the billing provider
   */
  async createCustomer(orgId, customerData) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Create customer for org ${orgId}:`, customerData);
      return { customerId: `stub_customer_${orgId}`, status: 'stub' };
    }

    // Future Stripe implementation would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Start a subscription
   */
  async startSubscription(customerId, planCode, quantity = 1) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Start subscription for customer ${customerId}, plan ${planCode}, quantity ${quantity}`);
      return { subscriptionId: `stub_sub_${customerId}`, status: 'stub' };
    }

    // Future Stripe implementation would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Update subscription quantity (seats)
   */
  async updateQuantity(subscriptionId, quantity) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Update subscription ${subscriptionId} quantity to ${quantity}`);
      return { status: 'stub' };
    }

    // Future Stripe implementation would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Apply promotion code
   */
  async applyPromotion(customerId, promoCode) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Apply promotion ${promoCode} to customer ${customerId}`);
      return { status: 'stub' };
    }

    // Future Stripe implementation would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Cancel subscription
   */
  async cancel(subscriptionId) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Cancel subscription ${subscriptionId}`);
      return { status: 'stub' };
    }

    // Future Stripe implementation would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Create invoice
   */
  async createInvoice(customerId, amount, description) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Create invoice for customer ${customerId}, amount ${amount}, description: ${description}`);
      return { invoiceId: `stub_invoice_${customerId}`, status: 'stub' };
    }

    // Future Stripe implementation would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(eventType, eventData) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Webhook received: ${eventType}`, eventData);
      return { status: 'stub' };
    }

    // Future Stripe webhook handling would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Get customer details
   */
  async getCustomer(customerId) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Get customer ${customerId}`);
      return { 
        id: customerId, 
        status: 'stub',
        email: 'stub@example.com',
        created: new Date().toISOString()
      };
    }

    // Future Stripe implementation would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId) {
    if (!this.enabled || this.provider === 'none') {
      console.log(`[BILLING] Get subscription ${subscriptionId}`);
      return { 
        id: subscriptionId, 
        status: 'stub',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    }

    // Future Stripe implementation would go here
    throw new Error('Stripe integration not implemented yet');
  }

  /**
   * Check if billing is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get provider name
   */
  getProvider() {
    return this.provider;
  }
}

module.exports = new BillingProvider();
