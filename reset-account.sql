-- Reset Account Script for AlvaP
-- This will clear all data for the most recent user account

-- First, let's see what users exist
SELECT id, email, name, created_at FROM users ORDER BY created_at DESC;

-- Delete in order to respect foreign key constraints
-- (Uncomment the lines below to actually perform the deletion)

-- Delete user sessions
-- DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- Delete audit logs  
-- DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- Delete candidates
-- DELETE FROM candidates WHERE created_by IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- Delete taxonomy data
-- DELETE FROM taxonomy_skills WHERE taxonomy_id IN (
--   SELECT id FROM taxonomies WHERE created_by IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1)
-- );
-- DELETE FROM taxonomy_roles WHERE taxonomy_id IN (
--   SELECT id FROM taxonomies WHERE created_by IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1)
-- );
-- DELETE FROM taxonomies WHERE created_by IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- Delete billing data
-- DELETE FROM billing_invoices WHERE org_id IN (
--   SELECT id FROM billing_orgs WHERE created_by IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1)
-- );
-- DELETE FROM billing_orgs WHERE created_by IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- Delete the user
-- DELETE FROM users WHERE id IN (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- Verify deletion
-- SELECT COUNT(*) as remaining_users FROM users;
