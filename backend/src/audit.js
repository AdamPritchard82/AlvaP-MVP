import { nanoid } from 'nanoid';
import { getDb } from './db.js';

export function recordActivity({ actorId, entityType, entityId, action, metadata }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activities (id, actor_id, entity_type, entity_id, action, metadata, created_at)
    VALUES (@id, @actor_id, @entity_type, @entity_id, @action, @metadata, @created_at)
  `).run({
    id: nanoid(),
    actor_id: actorId || null,
    entity_type: entityType,
    entity_id: entityId,
    action,
    metadata: metadata ? JSON.stringify(metadata) : null,
    created_at: now
  });
}






