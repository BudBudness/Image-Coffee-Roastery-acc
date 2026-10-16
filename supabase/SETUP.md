# Supabase setup notes

1. Create/select the intended Supabase project and configure the two environment variables documented in the root README.
2. Apply `migrations/202610160001_accommodation_core.sql` in the Supabase SQL editor or via a reviewed migration workflow.
3. In Supabase Authentication, create the first staff user with a unique email and a strong password. Keep public sign-up disabled.
4. Copy that user's UUID from Authentication > Users. As a project administrator, run the following SQL once, replacing the placeholder UUID and name:

```sql
insert into public.staff_profiles (user_id, full_name, role)
values ('00000000-0000-0000-0000-000000000000', 'Accommodation Manager', 'manager');
```

5. Add the project URL and publishable key to Vercel's Production, Preview and Development environment settings as appropriate. Never use a service-role/secret key in the browser.
6. Deploy and sign in. The dashboard is protected by Supabase Auth; database reads and writes are further restricted by row-level security and the staff profile role.

## Security notes

- The migration seeds only room inventory. It does not seed guest records or payments.
- Only authenticated users with a staff profile can read operational data.
- A manager can create staff profiles. Reception can create/update reservations and manage rooms. Accounts and managers can record payments.
- The database exclusion constraint prevents overlapping confirmed or checked-in stays for the same room.
- Guest enquiries do not reserve inventory.
