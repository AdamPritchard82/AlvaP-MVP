import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

// Get all available plans
router.get('/plans', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY price_monthly ASC').all();
    const plans = Array.isArray(result) ? result : [];
    
    // Parse JSON fields
    const parsedPlans = plans.map(plan => ({
      ...plan,
      features: JSON.parse(plan.features || '[]'),
      limits: JSON.parse(plan.limits || '{}')
    }));
    
    res.json(parsedPlans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get user's current subscription
router.get('/subscription', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const subscription = db.prepare(`
      SELECT s.*, p.name as plan_name, p.description as plan_description, p.features, p.limits
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = ? AND s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1
    `).get(userId);
    
    if (!subscription) {
      // Return free plan as default
      const freePlan = db.prepare('SELECT * FROM plans WHERE id = ?').get('free');
      return res.json({
        plan: {
          ...freePlan,
          features: JSON.parse(freePlan.features || '[]'),
          limits: JSON.parse(freePlan.limits || '{}')
        },
        subscription: null
      });
    }
    
    res.json({
      plan: {
        id: subscription.plan_id,
        name: subscription.plan_name,
        description: subscription.plan_description,
        features: JSON.parse(subscription.features || '[]'),
        limits: JSON.parse(subscription.limits || '{}')
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end
      }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Create Stripe checkout session (placeholder - would integrate with Stripe)
router.post('/checkout', (req, res) => {
  try {
    const { planId, billingCycle } = req.body;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const db = getDb();
    const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(planId);
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });
    
    // For MVP, we'll create a mock checkout session
    // In production, this would integrate with Stripe
    const sessionId = `cs_mock_${nanoid()}`;
    
    res.json({
      sessionId,
      url: `/checkout/success?session_id=${sessionId}&plan_id=${planId}`,
      // In production, this would be the Stripe checkout URL
      checkoutUrl: `https://checkout.stripe.com/pay/${sessionId}`
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Handle successful payment (webhook from Stripe)
router.post('/webhook', (req, res) => {
  try {
    // In production, this would verify the Stripe webhook signature
    const { type, data } = req.body;
    
    if (type === 'checkout.session.completed') {
      const session = data.object;
      const db = getDb();
      
      // Create or update subscription
      const subscriptionId = nanoid();
      const now = new Date().toISOString();
      
      // For MVP, we'll create a mock subscription
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end, created_at, updated_at)
        VALUES (@id, @user_id, @plan_id, @status, @stripe_subscription_id, @stripe_customer_id, @current_period_start, @current_period_end, @created_at, @updated_at)
      `).run({
        id: subscriptionId,
        user_id: session.metadata?.user_id || 'unknown',
        plan_id: session.metadata?.plan_id || 'professional',
        status: 'active',
        stripe_subscription_id: session.subscription || session.id,
        stripe_customer_id: session.customer,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        created_at: now,
        updated_at: now
      });
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Cancel subscription
router.post('/cancel', (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const db = getDb();
    const now = new Date().toISOString();
    
    // Update subscription status to cancelled
    db.prepare(`
      UPDATE subscriptions 
      SET status = 'cancelled', updated_at = @updated_at
      WHERE user_id = ? AND status = 'active'
    `).run(userId, { updated_at: now });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;

