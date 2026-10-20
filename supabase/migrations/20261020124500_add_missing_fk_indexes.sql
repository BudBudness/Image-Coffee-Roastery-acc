-- Add covering indexes for foreign keys used by operational joins and staff ownership.
create index if not exists guest_follow_ups_reservation_id_idx
  on public.guest_follow_ups (reservation_id);
create index if not exists guest_follow_ups_assigned_to_idx
  on public.guest_follow_ups (assigned_to);
create index if not exists payments_received_by_idx
  on public.payments (received_by);
create index if not exists reservations_created_by_idx
  on public.reservations (created_by);
