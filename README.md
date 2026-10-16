# Image Coffee Roastery — Accommodation Desk

Accommodation-only booking and operations system for Image Coffee Roastery in Uganda.

## Product scope

- 13 rooms, with a fixed rate of **UGX 100,000 per room per night**
- Room availability and occupancy
- Guest enquiries and reservations
- Check-in and check-out tracking
- Payment records and outstanding balances
- Guest follow-ups and operational reports

Restaurant, bar, and roastery sales are intentionally out of scope.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth and PostgreSQL
- Vercel deployment

## Status

Initial repository foundation. The application UI and database migration are being built here. Live persistence and authentication require a Supabase project and environment variables; deployment is not considered production-ready until those are configured and verified.

## Local setup

1. Install Node.js 22 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable key.
4. Apply the SQL migration in `supabase/migrations/` to the intended Supabase project.
5. Run `npm run dev`.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never place a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable or commit credentials.

## Business rules

- Room rate is fixed at UGX 100,000 per room per night.
- A reservation cannot overlap another active reservation for the same room.
- Enquiries do not block room availability until confirmed.
- Payment records are tracked separately from reservations.
- Staff access must be authenticated; production access policies must be reviewed before launch.
