ALTER TABLE notifications
  DROP CONSTRAINT notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'request_assigned',
      'request_started',
      'request_completed',
      'request_declined',
      'request_reassigned',
      'request_cancelled',
      'request_reviewed',
      'specialization_change_approved',
      'specialization_change_rejected'
    )
  );