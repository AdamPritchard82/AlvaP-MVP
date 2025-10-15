/**
 * Billing API Routes
 * 
 * Handles billing-related endpoints for AlvaP Seat system
 */

const express = require('express');
const router = express.Router();
const pricing = require('../services/pricing');
const billingProvider = require('../services/billingProvider');

/**
 * Apply promo code to organization
 */
router.post('/promo/apply', async (req, res) => {
  try {
    const { code } = req.body;
    const orgId = req.user.orgId || 'default'; // TODO: Get from user context
    const actorUserId = req.user.userId;

    if (!code) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    const result = await pricing.applyPromo(orgId, code, actorUserId);
    
    res.json({
      success: true,
      message: 'Promo code applied successfully',
      promo: result
    });
  } catch (error) {
    console.error('Error applying promo code:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Get billing summary for organization
 */
router.get('/summary', async (req, res) => {
  try {
    const orgId = req.user.orgId || 'default'; // TODO: Get from user context
    
    const summary = await pricing.getBillingSummary(orgId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting billing summary:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Switch plan for organization
 */
router.post('/plan/switch', async (req, res) => {
  try {
    const { planCode } = req.body;
    const orgId = req.user.orgId || 'default'; // TODO: Get from user context

    if (!planCode) {
      return res.status(400).json({ error: 'Plan code is required' });
    }

    const plan = await pricing.switchPlan(orgId, planCode);
    
    res.json({
      success: true,
      message: 'Plan switched successfully',
      plan
    });
  } catch (error) {
    console.error('Error switching plan:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Begin trial for organization
 */
router.post('/trial/begin', async (req, res) => {
  try {
    const orgId = req.user.orgId || 'default'; // TODO: Get from user context
    
    const result = await pricing.beginTrialForOrg(orgId);
    
    res.json({
      success: true,
      message: 'Trial started successfully',
      trial: result
    });
  } catch (error) {
    console.error('Error beginning trial:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Get available plans
 */
router.get('/plans', async (req, res) => {
  try {
    const knex = require('knex');
    const config = require('../config/config');
    const db = knex(config.database);

    const plans = await db('billing_plans')
      .where('is_active', true)
      .select('*')
      .orderBy('interval', 'asc')
      .orderBy('amount_pence', 'asc');

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Get promo codes (for admin)
 */
router.get('/promo-codes', async (req, res) => {
  try {
    const knex = require('knex');
    const config = require('../config/config');
    const db = knex(config.database);

    const promoCodes = await db('billing_promo_codes')
      .where('is_active', true)
      .select('code', 'description', 'percent_off', 'duration', 'expires_at', 'max_redemptions', 'redeemed_count')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: promoCodes
    });
  } catch (error) {
    console.error('Error getting promo codes:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Check trial status
 */
router.get('/trial/status', async (req, res) => {
  try {
    const orgId = req.user.orgId || 'default'; // TODO: Get from user context
    
    const trialStatus = await pricing.getTrialStatus(orgId);
    const checkResult = await pricing.checkTrialStatus(orgId);
    
    res.json({
      success: true,
      data: {
        ...trialStatus,
        ...checkResult
      }
    });
  } catch (error) {
    console.error('Error checking trial status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Get billing provider status
 */
router.get('/provider/status', (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: billingProvider.isEnabled(),
      provider: billingProvider.getProvider(),
      message: billingProvider.getProvider() === 'none' 
        ? 'Payment provider not connected yet — charging will start when connected.'
        : `Connected to ${billingProvider.getProvider()}`
    }
  });
});

module.exports = router;
