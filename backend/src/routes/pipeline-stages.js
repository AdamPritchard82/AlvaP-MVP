import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb } from '../db.js';

const router = Router();

// Get all pipeline stages
router.get('/', (req, res) => {
  try {
    const db = getDb();
    // Check if table exists first
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pipeline_stages'").get();
    if (!tableExists) {
      return res.status(503).json({ error: 'Pipeline stages table not initialized yet' });
    }
    const result = db.prepare('SELECT * FROM pipeline_stages ORDER BY position ASC').all();
    const stages = Array.isArray(result) ? result : [];
    res.json(stages);
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stages' });
  }
});

// Create a new pipeline stage
router.post('/', (req, res) => {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();
  const { name, color, border_color } = req.body || {};
  
  if (!name) return res.status(400).json({ error: 'name is required' });

  // Get the next position (always add after the first stage)
  const firstStage = db.prepare('SELECT position FROM pipeline_stages WHERE is_first = 1 ORDER BY position ASC LIMIT 1').get();
  const lastStage = db.prepare('SELECT position FROM pipeline_stages ORDER BY position DESC LIMIT 1').get();
  const position = lastStage ? lastStage.position + 1 : (firstStage ? firstStage.position + 1 : 0);

  try {
    db.prepare(`
      INSERT INTO pipeline_stages (id, name, color, border_color, position, is_default, is_first, created_at, updated_at)
      VALUES (@id, @name, @color, @border_color, @position, @is_default, @is_first, @created_at, @updated_at)
    `).run({
      id,
      name,
      color: color || 'bg-gray-100',
      border_color: border_color || 'border-gray-200',
      position,
      is_default: 0,
      is_first: 0,
      created_at: now,
      updated_at: now
    });
    
    res.status(201).json({ id });
  } catch (error) {
    console.error('Error creating pipeline stage:', error);
    res.status(500).json({ error: 'Failed to create pipeline stage' });
  }
});

// Update a pipeline stage
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, color, border_color, position } = req.body || {};
  
  const stage = db.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(id);
  if (!stage) return res.status(404).json({ error: 'Pipeline stage not found' });

  // Don't allow editing the first stage (New Opportunities)
  if (stage.is_first) {
    return res.status(400).json({ error: 'Cannot edit the first stage (New Opportunities)' });
  }

  // Don't allow editing default stages (except for color changes)
  if (stage.is_default && name && name !== stage.name) {
    return res.status(400).json({ error: 'Cannot rename default pipeline stages' });
  }

  const now = new Date().toISOString();

  try {
    db.prepare(`
      UPDATE pipeline_stages SET
        name = @name,
        color = @color,
        border_color = @border_color,
        position = @position,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id,
      name: name ?? stage.name,
      color: color ?? stage.color,
      border_color: border_color ?? stage.border_color,
      position: position ?? stage.position,
      updated_at: now
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
    res.status(500).json({ error: 'Failed to update pipeline stage' });
  }
});

// Delete a pipeline stage
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  const stage = db.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(id);
  if (!stage) return res.status(404).json({ error: 'Pipeline stage not found' });

  // Don't allow deleting the first stage (New Opportunities)
  if (stage.is_first) {
    return res.status(400).json({ error: 'Cannot delete the first stage (New Opportunities)' });
  }

  // Don't allow deleting default stages
  if (stage.is_default) {
    return res.status(400).json({ error: 'Cannot delete default pipeline stages' });
  }

  // Check if there are any jobs in this stage
  const jobsInStage = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE status = ?').get(id);
  if (jobsInStage.count > 0) {
    return res.status(400).json({ 
      error: `Cannot delete stage with ${jobsInStage.count} jobs. Please move jobs to another stage first.` 
    });
  }

  try {
    db.prepare('DELETE FROM pipeline_stages WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting pipeline stage:', error);
    res.status(500).json({ error: 'Failed to delete pipeline stage' });
  }
});

// Reorder pipeline stages
router.post('/reorder', (req, res) => {
  const db = getDb();
  const { stages } = req.body || {};
  
  if (!Array.isArray(stages)) {
    return res.status(400).json({ error: 'stages must be an array' });
  }

  try {
    const now = new Date().toISOString();
    
    // Ensure the first stage (New Opportunities) is always at position 0
    const firstStage = stages.find(stage => stage.is_first);
    if (firstStage && firstStage.position !== 0) {
      return res.status(400).json({ error: 'The first stage (New Opportunities) must always be at position 0' });
    }
    
    stages.forEach((stage, index) => {
      db.prepare(`
        UPDATE pipeline_stages SET
          position = @position,
          updated_at = @updated_at
        WHERE id = @id
      `).run({
        id: stage.id,
        position: index,
        updated_at: now
      });
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error reordering pipeline stages:', error);
    res.status(500).json({ error: 'Failed to reorder pipeline stages' });
  }
});

// Get the first stage ID (for new opportunities)
router.get('/first', (req, res) => {
  try {
    const db = getDb();
    const firstStage = db.prepare('SELECT id FROM pipeline_stages WHERE is_first = 1 ORDER BY position ASC LIMIT 1').get();
    
    if (!firstStage) {
      return res.status(404).json({ error: 'No first stage found' });
    }
    
    res.json({ id: firstStage.id });
  } catch (error) {
    console.error('Error fetching first stage:', error);
    res.status(500).json({ error: 'Failed to fetch first stage' });
  }
});

export default router;
