export function logAudit(db, { trainerId, entityType, entityId, action, oldValue = null, newValue = null }) {
  db.prepare(
    `INSERT INTO audit_log (trainer_id, entity_type, entity_id, action, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    trainerId,
    entityType,
    entityId,
    action,
    oldValue === null ? null : JSON.stringify(oldValue),
    newValue === null ? null : JSON.stringify(newValue)
  );
}
