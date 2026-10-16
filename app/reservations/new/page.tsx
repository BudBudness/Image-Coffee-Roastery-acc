import Link from "next/link";
import { ArrowLeft, CalendarDays, Coffee } from "lucide-react";
import { createReservation } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = { searchParams: Promise<{ error?: string }> };

const errorMessages: Record<string, string> = {
  invalid: "Enter the guest name, arrival date, departure date and a valid booking status.",
  dates: "Departure must be after arrival. Guest counts must be valid positive numbers.",
  room_required: "Choose a room before confirming a reservation.",
  conflict: "That room already has an overlapping confirmed stay. Choose another room or dates.",
  permission: "Your staff account does not have permission to create reservations.",
  save: "The reservation could not be saved. Check the database migration and try again.",
};

export default async function NewReservationPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  let rooms: { id: string; room_number: string; status: string }[] = [];
  let roomError = "";

  if (configured) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("rooms").select("id, room_number, status").neq("status", "maintenance").order("room_number");
    if (error) roomError = error.message;
    else rooms = data ?? [];
  }

  return (
    <main className="form-shell">
      <header className="form-topbar"><Link href="/" className="back-link"><ArrowLeft size={17} /> Dashboard</Link><div className="form-brand"><Coffee size={18} /> IMAGE COFFEE ROASTERY</div></header>
      <section className="form-card">
        <span className="eyebrow">GUEST MANAGEMENT</span>
        <h1>New reservation</h1>
        <p className="form-intro">Create an enquiry or confirm a room booking. The rate is fixed at UGX 100,000 per room per night.</p>
        {!configured && <div className="notice"><strong>Supabase setup required</strong><span>Configure the project environment and apply the database migration before creating records.</span></div>}
        {query.error && <div className="notice warning"><strong>Could not save reservation</strong><span>{errorMessages[query.error] ?? "An unexpected error occurred."}</span></div>}
        {roomError && <div className="notice warning"><strong>Room list unavailable</strong><span>{roomError}</span></div>}
        <form action={createReservation} className="reservation-form">
          <div className="form-section-title">Guest details</div>
          <div className="form-grid">
            <label>Guest full name *<input name="guest_name" required autoComplete="name" placeholder="Full name" /></label>
            <label>Phone number<input name="guest_phone" type="tel" autoComplete="tel" placeholder="+256…" /></label>
            <label className="full-span">Email address<input name="guest_email" type="email" autoComplete="email" placeholder="guest@example.com" /></label>
          </div>
          <div className="form-section-title">Stay details</div>
          <div className="form-grid">
            <label>Arrival date *<input name="check_in" type="date" required /></label>
            <label>Departure date *<input name="check_out" type="date" required /></label>
            <label>Adults<input name="adults" type="number" min="1" max="20" defaultValue="1" required /></label>
            <label>Children<input name="children" type="number" min="0" max="20" defaultValue="0" required /></label>
            <label className="full-span">Room for confirmed booking
              <select name="room_id" defaultValue="">
                <option value="">No room assigned (enquiry only)</option>
                {rooms.map((room) => <option value={room.id} key={room.id}>Room {room.room_number} · Current status: {room.status}</option>)}
              </select>
              <small>Only currently available rooms are listed. The database also blocks overlapping confirmed stays.</small>
            </label>
            <label className="full-span">Booking stage
              <select name="status" defaultValue="enquiry">
                <option value="enquiry">Enquiry — does not hold a room</option>
                <option value="confirmed">Confirmed — reserve the selected room</option>
              </select>
            </label>
            <label className="full-span">Special requests<textarea name="special_requests" rows={3} placeholder="Arrival time, accessibility needs, or other requests" /></label>
          </div>
          <div className="rate-note"><CalendarDays size={18} /><div><strong>Fixed room rate: UGX 100,000 / night</strong><small>Total is calculated from the number of nights. Payments are recorded separately.</small></div></div>
          <div className="form-actions"><Link href="/" className="cancel-button">Cancel</Link><button type="submit" disabled={!configured}>Save reservation</button></div>
        </form>
      </section>
    </main>
  );
}
