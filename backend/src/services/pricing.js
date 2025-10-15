/**
 * Pricing Engine Service
 * 
 * Provider-agnostic pricing calculations and plan management
 * for AlvaP Seat billing system.
 */

const knex = require('knex');
const config = require('../config/config');

const db = knex(config.database);

class PricingEngine {
  /**
   * Get active plan for an organization
   */
  async getActivePlan(orgId) {
    const billingOrg = await db('billing_orgs')
      .join('billing_plans', 'billing_orgs.plan_code', 'billing_plans.code')
      .where('billing_orgs.org_id', orgId)
      .select('billing_plans.*', 'billing_orgs.seat_quantity', 'billing_orgs.status')
      .first();

    if (!billingOrg) {
      throw new Error(`No billing plan found for org ${orgId}`);
    }

    return {
      plan: billingOrg,
      seats: billingOrg.seat_quantity,
      status: billingOrg.status
    };
  }

  /**
   * Get trial status for an organization
   */
  async getTrialStatus(orgId) {
    const billingOrg = await db('billing_orgs')
      .where('org_id', orgId)
      .select('trial_started_at', 'trial_ends_at', 'status')
      .first();

    if (!billingOrg || !billingOrg.trial_started_at) {
      return { trialing: false, daysRemaining: 0 };
    }

    const now = new Date();
    const trialEnds = new Date(billingOrg.trial_ends_at);
    const daysRemaining = Math.max(0, Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)));

    return {
      trialing: billingOrg.status === 'trialing' && now < trialEnds,
      daysRemaining,
      trialEndsAt: trialEnds,
      trialStartedAt: billingOrg.trial_started_at
    };
  }

  /**
   * Apply promo code to an organization
   */
  async applyPromo(orgId, code, actorUserId) {
    // Get the promo code
    const promoCode = await db('billing_promo_codes')
      .where('code', code)
      .where('is_active', true)
      .first();

    if (!promoCode) {
      throw new Error('Invalid promo code');
    }

    // Check if expired
    if (promoCode.expires_at && new Date() > new Date(promoCode.expires_at)) {
      throw new Error('Promo code has expired');
    }

    // Check max redemptions
    if (promoCode.max_redemptions && promoCode.redeemed_count >= promoCode.max_redemptions) {
      throw new Error('Promo code has reached maximum redemptions');
    }

    // Get organization billing info
    const billingOrg = await db('billing_orgs')
      .where('org_id', orgId)
      .first();

    if (!billingOrg) {
      throw new Error('Organization not found');
    }

    // Check email restriction if set
    if (promoCode.allowed_customer_email && 
        billingOrg.billing_email !== promoCode.allowed_customer_email) {
      throw new Error('Promo code not valid for this organization');
    }

    // Calculate promo expiry
    let promoExpiresAt = null;
    if (promoCode.duration === 'repeating' && promoCode.duration_in_months) {
      const now = new Date();
      promoExpiresAt = new Date(now.getTime() + (promoCode.duration_in_months * 30 * 24 * 60 * 60 * 1000));
    }

    // Update billing organization
    await db('billing_orgs')
      .where('org_id', orgId)
      .update({
        promo_code_applied: code,
        promo_expires_at: promoExpiresAt,
        updated_at: new Date()
      });

    // Increment redeemed count
    await db('billing_promo_codes')
      .where('code', code)
      .increment('redeemed_count', 1);

    return {
      code: promoCode.code,
      description: promoCode.description,
      percentOff: promoCode.percent_off,
      expiresAt: promoExpiresAt
    };
  }

  /**
   * Compute amount for seats and plan with optional promo
   */
  async computeAmount(orgId, seats, planCode, promoCode = null) {
    // Get plan details
    const plan = await db('billing_plans')
      .where('code', planCode)
      .where('is_active', true)
      .first();

    if (!plan) {
      throw new Error('Invalid plan code');
    }

    const subtotal = plan.amount_pence * seats;
    let discount = 0;

    // Apply promo if provided
    if (promoCode) {
      const promo = await db('billing_promo_codes')
        .where('code', promoCode)
        .where('is_active', true)
        .first();

      if (promo && (!promo.expires_at || new Date() < new Date(promo.expires_at))) {
        discount = Math.round(subtotal * (promo.percent_off / 100));
      }
    }

    const total = subtotal - discount;

    return {
      subtotal,
      discount,
      total,
      plan: {
        code: plan.code,
        name: plan.name,
        interval: plan.interval,
        amountPence: plan.amount_pence
      },
      seats,
      promoCode: promoCode || null
    };
  }

  /**
   * Switch plan for an organization
   */
  async switchPlan(orgId, planCode) {
    const plan = await db('billing_plans')
      .where('code', planCode)
      .where('is_active', true)
      .first();

    if (!plan) {
      throw new Error('Invalid plan code');
    }

    await db('billing_orgs')
      .where('org_id', orgId)
      .update({
        plan_code: planCode,
        updated_at: new Date()
      });

    return plan;
  }

  /**
   * Begin trial for an organization
   */
  async beginTrialForOrg(orgId) {
    const billingOrg = await db('billing_orgs')
      .where('org_id', orgId)
      .first();

    if (billingOrg && billingOrg.trial_started_at) {
      throw new Error('Trial already started for this organization');
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime() + (process.env.TRIAL_DAYS || 10) * 24 * 60 * 60 * 1000);

    await db('billing_orgs')
      .where('org_id', orgId)
      .update({
        trial_started_at: now,
        trial_ends_at: trialEnds,
        status: 'trialing',
        updated_at: now
      });

    return {
      trialStartedAt: now,
      trialEndsAt: trialEnds,
      daysRemaining: process.env.TRIAL_DAYS || 10
    };
  }

  /**
   * Get billing summary for an organization
   */
  async getBillingSummary(orgId) {
    const billingOrg = await db('billing_orgs')
      .join('billing_plans', 'billing_orgs.plan_code', 'billing_plans.code')
      .where('billing_orgs.org_id', orgId)
      .select('billing_orgs.*', 'billing_plans.*')
      .first();

    if (!billingOrg) {
      throw new Error('Organization not found');
    }

    const trialStatus = await this.getTrialStatus(orgId);
    const amount = await this.computeAmount(
      orgId, 
      billingOrg.seat_quantity, 
      billingOrg.plan_code, 
      billingOrg.promo_code_applied
    );

    return {
      orgId,
      plan: {
        code: billingOrg.code,
        name: billingOrg.name,
        interval: billingOrg.interval,
        amountPence: billingOrg.amount_pence
      },
      seats: billingOrg.seat_quantity,
      status: billingOrg.status,
      trial: trialStatus,
      promo: billingOrg.promo_code_applied ? {
        code: billingOrg.promo_code_applied,
        expiresAt: billingOrg.promo_expires_at
      } : null,
      amount
    };
  }

  /**
   * Update seat count for an organization
   */
  async updateSeatCount(orgId, seatCount) {
    await db('billing_orgs')
      .where('org_id', orgId)
      .update({
        seat_quantity: seatCount,
        updated_at: new Date()
      });
  }

  /**
   * Check if trial has ended and update status
   */
  async checkTrialStatus(orgId) {
    const trialStatus = await this.getTrialStatus(orgId);
    
    if (trialStatus.trialing && trialStatus.daysRemaining <= 0) {
      await db('billing_orgs')
        .where('org_id', orgId)
        .update({
          status: 'active',
          updated_at: new Date()
        });
      
      return { trialEnded: true, status: 'active' };
    }
    
    return { trialEnded: false, status: trialStatus.trialing ? 'trialing' : 'active' };
  }
}

module.exports = new PricingEngine();
