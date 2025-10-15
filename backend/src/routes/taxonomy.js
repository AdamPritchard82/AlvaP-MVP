const express = require('express');
const { nanoid } = require('nanoid');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { INDUSTRY_PRESETS, getAvailableIndustries, getRolesForIndustries, getSkillsForRoles } = require('../taxonomy-presets');

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// GET /taxonomy/active - Get the active taxonomy for the organization
router.get('/active', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.userId;
    
    // For now, we'll use a simple org_id based on user
    // In a real multi-tenant app, this would come from user's organization
    const orgId = 'default'; // TODO: Get from user's organization
    
    // Get active taxonomy
    const taxonomy = db.prepare(`
      SELECT id, name, is_active, created_at, updated_at 
      FROM taxonomies 
      WHERE org_id = ? AND is_active = 1
    `).get(orgId);
    
    if (!taxonomy) {
      return res.json({ 
        success: true, 
        roles: [], 
        skillsByRole: {},
        hasActiveTaxonomy: false 
      });
    }
    
    // Get roles for this taxonomy
    const roles = db.prepare(`
      SELECT id, name, sort_order 
      FROM taxonomy_roles 
      WHERE taxonomy_id = ? 
      ORDER BY sort_order ASC, name ASC
    `).all(taxonomy.id);
    
    // Get skills for each role
    const skillsByRole = {};
    for (const role of roles) {
      const skills = db.prepare(`
        SELECT name, weight, scale_max 
        FROM taxonomy_skills 
        WHERE role_id = ? 
        ORDER BY weight DESC, name ASC
      `).all(role.id);
      
      skillsByRole[role.name] = skills;
    }
    
    res.json({
      success: true,
      roles: roles.map(r => ({ id: r.id, name: r.name, sortOrder: r.sort_order })),
      skillsByRole,
      hasActiveTaxonomy: true,
      taxonomy: {
        id: taxonomy.id,
        name: taxonomy.name,
        createdAt: taxonomy.created_at,
        updatedAt: taxonomy.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching active taxonomy:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch taxonomy' });
  }
});

// GET /taxonomy/presets - Get available industry presets
router.get('/presets', (req, res) => {
  try {
    const industries = getAvailableIndustries();
    const presets = industries.map(industry => ({
      name: industry,
      roles: INDUSTRY_PRESETS[industry].roles,
      skillsByRole: INDUSTRY_PRESETS[industry].skillsByRole
    }));
    
    res.json({
      success: true,
      presets
    });
  } catch (error) {
    console.error('Error fetching presets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch presets' });
  }
});

// POST /admin/taxonomy - Create or update active taxonomy (admin only)
router.post('/admin/taxonomy', requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.userId;
    const { name, industries, roles, skillsByRole } = req.body;
    
    if (!name || !roles || !Array.isArray(roles)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and roles are required' 
      });
    }
    
    const orgId = 'default'; // TODO: Get from user's organization
    
    // Start transaction
    const transaction = db.transaction(() => {
      // Deactivate current active taxonomy
      db.prepare(`
        UPDATE taxonomies 
        SET is_active = 0, updated_at = ? 
        WHERE org_id = ? AND is_active = 1
      `).run(new Date().toISOString(), orgId);
      
      // Create new taxonomy
      const taxonomyId = nanoid();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO taxonomies (id, org_id, name, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(taxonomyId, orgId, name, now, now);
      
      // Create roles
      const roleIds = {};
      roles.forEach((role, index) => {
        const roleId = nanoid();
        roleIds[role] = roleId;
        
        db.prepare(`
          INSERT INTO taxonomy_roles (id, taxonomy_id, name, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(roleId, taxonomyId, role, index, now, now);
      });
      
      // Create skills for each role
      if (skillsByRole) {
        Object.entries(skillsByRole).forEach(([roleName, skills]) => {
          const roleId = roleIds[roleName];
          if (roleId && Array.isArray(skills)) {
            skills.forEach(skill => {
              const skillId = nanoid();
              db.prepare(`
                INSERT INTO taxonomy_skills (id, role_id, name, weight, scale_max, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).run(
                skillId, 
                roleId, 
                skill.name || skill, 
                skill.weight || 1, 
                skill.scale_max || 5, 
                now, 
                now
              );
            });
          }
        });
      }
      
      return taxonomyId;
    });
    
    const taxonomyId = transaction();
    
    res.json({
      success: true,
      message: 'Taxonomy created successfully',
      taxonomyId
    });
  } catch (error) {
    console.error('Error creating taxonomy:', error);
    res.status(500).json({ success: false, error: 'Failed to create taxonomy' });
  }
});

// GET /admin/taxonomy/usage - Check usage of roles/skills before deletion
router.get('/admin/taxonomy/usage', requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const { roleIds, skillIds } = req.query;
    
    const usage = {
      roles: {},
      skills: {}
    };
    
    // Check role usage (simplified - in real app, you'd check actual candidate assignments)
    if (roleIds) {
      const roleIdArray = roleIds.split(',');
      for (const roleId of roleIdArray) {
        // For now, return mock data - in real app, check candidate_role_assignments table
        usage.roles[roleId] = {
          inUse: false,
          candidateCount: 0,
          message: 'No candidates currently assigned to this role'
        };
      }
    }
    
    // Check skill usage
    if (skillIds) {
      const skillIdArray = skillIds.split(',');
      for (const skillId of skillIdArray) {
        // For now, return mock data - in real app, check candidate_skill_assignments table
        usage.skills[skillId] = {
          inUse: false,
          candidateCount: 0,
          message: 'No candidates currently assigned to this skill'
        };
      }
    }
    
    res.json({
      success: true,
      usage
    });
  } catch (error) {
    console.error('Error checking usage:', error);
    res.status(500).json({ success: false, error: 'Failed to check usage' });
  }
});

// DELETE /admin/taxonomy/roles/:roleId - Delete a role (with usage check)
router.delete('/admin/taxonomy/roles/:roleId', requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const { roleId } = req.params;
    const { force } = req.query;
    
    // Check if role is in use
    const usage = db.prepare(`
      SELECT COUNT(*) as count 
      FROM candidates 
      WHERE JSON_EXTRACT(skills, '$."${roleId}"') IS NOT NULL
    `).get();
    
    if (usage.count > 0 && force !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Role is in use',
        message: `This role is currently used by ${usage.count} candidates. Use force=true to delete anyway.`,
        candidateCount: usage.count
      });
    }
    
    // Delete the role (cascade will delete skills)
    db.prepare('DELETE FROM taxonomy_roles WHERE id = ?').run(roleId);
    
    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ success: false, error: 'Failed to delete role' });
  }
});

// DELETE /admin/taxonomy/skills/:skillId - Delete a skill (with usage check)
router.delete('/admin/taxonomy/skills/:skillId', requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const { skillId } = req.params;
    const { force } = req.query;
    
    // Check if skill is in use (simplified check)
    const usage = db.prepare(`
      SELECT COUNT(*) as count 
      FROM candidates 
      WHERE JSON_EXTRACT(skills, '$."${skillId}"') IS NOT NULL
    `).get();
    
    if (usage.count > 0 && force !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Skill is in use',
        message: `This skill is currently used by ${usage.count} candidates. Use force=true to delete anyway.`,
        candidateCount: usage.count
      });
    }
    
    // Delete the skill
    db.prepare('DELETE FROM taxonomy_skills WHERE id = ?').run(skillId);
    
    res.json({
      success: true,
      message: 'Skill deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ success: false, error: 'Failed to delete skill' });
  }
});

module.exports = router;
