# AlvaP Seat Billing System

## Overview

The AlvaP Seat billing system provides a complete subscription management solution for the AlvaP recruitment platform. It includes trial management, seat-based pricing, promotional codes, and session enforcement to prevent seat sharing.

## Features

### 🎯 Core Features
- **Seat-based Pricing**: £39/month per seat (monthly) or £32/month per seat (annual)
- **10-day Free Trial**: New organizations automatically get a 10-day trial
- **Promotional Codes**: Support for percentage discounts with duration limits
- **Session Management**: Anti-sharing with max 2 concurrent sessions per user
- **Trial Gating**: Graceful trial expiration with billing reminders

### 💰 Pricing Plans
- **Monthly Plan**: £39 per seat per month
- **Annual Plan**: £32 per seat per month (billed annually, 18% savings)
- **Trial**: 10 days free for new organizations

### 🎟️ Promotional Codes
- **ADAM-FREE**: 100% off forever (restricted to adam@door10.co.uk)
- **ADAM-29-6MO**: 25% off for 6 months (general use)

## Database Schema

### Tables
- `billing_plans`: Plan definitions (monthly/annual)
- `billing_orgs`: Organization billing status and trial info
- `billing_invoices`: Invoice records (internal display)
- `billing_promo_codes`: Promotional codes
- `auth_sessions`: User session tracking for anti-sharing

### Key Relationships
- `billing_orgs.org_id` → Organization identifier
- `billing_orgs.plan_code` → `billing_plans.code`
- `auth_sessions.user_id` → `users.id`
- `auth_sessions.org_id` → Organization identifier

## API Endpoints

### Billing Management
- `GET /api/billing/summary` - Get billing summary for organization
- `GET /api/billing/plans` - Get available plans
- `POST /api/billing/plan/switch` - Switch between monthly/annual plans
- `POST /api/billing/trial/begin` - Start trial for organization

### Promotional Codes
- `GET /api/billing/promo-codes` - Get available promo codes
- `POST /api/billing/promo/apply` - Apply promo code to organization

### Trial Management
- `GET /api/billing/trial/status` - Get trial status and days remaining

### Provider Status
- `GET /api/billing/provider/status` - Get billing provider status

## Frontend Components

### Pages
- `/settings/billing` - Billing settings and plan management
- `/settings/seats` - Seat management and user overview

### Components
- `TrialBanner` - Trial status banner with countdown
- `BillingSettings` - Complete billing management interface
- `SeatsManagement` - User and session management

## Configuration

### Environment Variables
```bash
BILLING_ENABLED=true                    # Enable billing features
BILLING_PROVIDER=none                   # Billing provider (none|stripe)
DEFAULT_PLAN=SEAT_MONTHLY              # Default plan for new orgs
TRIAL_DAYS=10                          # Trial duration in days
JWT_SECRET=your-secret-key             # JWT signing secret
```

### Feature Flags
- `BILLING_ENABLED`: Controls billing UI and logic
- `TAXONOMY_EDITOR_ENABLED`: Controls taxonomy settings access

## Session Management

### Anti-Sharing Features
- Maximum 2 concurrent sessions per user
- Automatic termination of oldest session when limit exceeded
- Device fingerprinting for session tracking
- IP country tracking (stub implementation)

### Session Lifecycle
1. User logs in → Create new session
2. Check existing sessions → Terminate oldest if at limit
3. Update last seen timestamp on each request
4. Clean up old sessions (30+ days inactive)

## Trial Management

### Trial Lifecycle
1. **Trial Start**: New organization gets 10-day trial
2. **Trial Active**: Full access with countdown banner
3. **Trial Ending**: Warning banner (3 days before)
4. **Trial Expired**: Billing required banner (graceful degradation)

### Trial States
- `trialing`: Active trial period
- `active`: Trial ended, billing active
- `past_due`: Payment failed
- `canceled`: Subscription canceled

## Promotional Codes

### Code Types
- **Forever**: Permanent discount (e.g., ADAM-FREE)
- **Repeating**: Time-limited discount (e.g., ADAM-29-6MO)

### Validation Rules
- Must be active (`is_active = true`)
- Must not be expired (`expires_at > now()`)
- Must not exceed max redemptions
- Email restrictions (if specified)

## Future Stripe Integration

### Adapter Pattern
The system uses an adapter pattern for billing providers:

```javascript
// Current: Stub implementation
const billingProvider = require('./services/billingProvider');

// Future: Stripe integration
const billingProvider = require('./services/stripeProvider');
```

### Stripe Mapping
- `billing_orgs` ↔ Stripe Customers
- `billing_plans` ↔ Stripe Price IDs
- `billing_promo_codes` ↔ Stripe Coupons
- Seat changes ↔ Subscription quantity updates

### Webhook Handling
Future webhook endpoints for Stripe events:
- `trial_will_end` - Trial ending notification
- `invoice.payment_failed` - Payment failure handling
- `customer.subscription.updated` - Subscription changes

## Usage Examples

### Starting a Trial
```javascript
// Backend
const result = await pricing.beginTrialForOrg('org-123');

// Frontend
const response = await api.post('/billing/trial/begin');
```

### Applying Promo Code
```javascript
// Frontend
const response = await api.post('/billing/promo/apply', { 
  code: 'ADAM-29-6MO' 
});
```

### Switching Plans
```javascript
// Frontend
const response = await api.post('/billing/plan/switch', { 
  planCode: 'SEAT_ANNUAL' 
});
```

## Monitoring and Logging

### Daily Logs
- Trial days remaining per organization
- Seat count changes
- Plan switches
- Promo code applications

### Error Handling
- Database connection failures
- Invalid promo codes
- Session limit exceeded
- Trial expiration

## Security Considerations

### Authentication
- JWT-based authentication for all billing endpoints
- Organization-scoped access control
- User role validation for admin actions

### Data Protection
- Password hashing with bcrypt
- Secure session management
- Input validation and sanitization

### Anti-Abuse
- Session limits prevent seat sharing
- Promo code redemption limits
- Trial restrictions per organization

## Troubleshooting

### Common Issues
1. **Trial not starting**: Check `billing_orgs` table for existing trial
2. **Promo code rejected**: Verify email restrictions and expiration
3. **Session limit exceeded**: Check `auth_sessions` table for old sessions
4. **Billing summary empty**: Ensure organization exists in `billing_orgs`

### Debug Endpoints
- `GET /api/billing/summary` - Check organization billing status
- `GET /api/billing/trial/status` - Verify trial information
- `GET /api/billing/provider/status` - Check provider configuration

## Migration Guide

### From No Billing
1. Run migration: `knex migrate:latest`
2. Seed data: `node backend/src/scripts/seed-billing-data.js`
3. Set environment variables
4. Deploy and test

### To Stripe Integration
1. Install Stripe SDK: `npm install stripe`
2. Replace `billingProvider.js` with Stripe implementation
3. Set `BILLING_PROVIDER=stripe`
4. Configure Stripe webhooks
5. Test with Stripe test mode

## Support

For billing-related issues:
1. Check logs for error messages
2. Verify database schema and data
3. Test API endpoints directly
4. Check environment configuration

The billing system is designed to be robust and production-ready while maintaining flexibility for future enhancements.
