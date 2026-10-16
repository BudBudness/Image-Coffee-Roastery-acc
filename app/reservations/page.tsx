import Link from "next/link";
import { ArrowLeft, Banknote, CalendarDays, Plus, ReceiptText } from "lucide-react";
import { recordPayment, updateReservationStatus } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };
type Reservation = {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number;
  payment_status: string;
  room_id: string | null;
  payments: { amount: number }[];
};
type Room = { id: string; room_number: string };

const money = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
const messages: Record<string, string> = {
  invalid: "Check the submitted details and try again.",
  not_found: "The reservation could not be found.",
  transition: "That status change is not allowed from the current stage.",
  room_required: "A room must be assigned before check-in.",
  save: "The change could not be saved. Check staff permissions.",
  permission: "Your staff role is not allowed to record payments.",
  overpay: "The payment is greater than the outstanding balance.",
};

export default async function ReservationsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  let reservations: Reservation[] = [];
  let rooms: Room[] = [];
  let loadError = "";

  if (configured) {
    const supabase = await createClient();
    const [reservationResult, roomResult] = await Promise.all([
      supabase.from("reservations").select("id, guest_name, guest_phone, check_in, check_out, status, total_amount, payment_status, room_id, payments(amount)").order("created_at", { ascending: false }).limit(100),
      supabase.from("rooms").select("id, room_number").order("room_number"),
    ]);
    if (reservationResult.error) loadError = reservationResult.error.message;
    else reservations = (reservationResult.data ?? []) as unknown as Reservation[];
    if (roomResult.error && !loadError) loadError = roomResult.error.message;
    else rooms = roomResult.data ?? [];
  }

  const roomNumbers = new Map(rooms.map((room) => [room.id, room.room_number]));
  const actionError = query.status_error || query.payment_error;

  return (
    <main className="form-shell reservations-shell">
      <header className="form-topbar"><Link href="/" className="back-link"><ArrowLeft size={17} /> Dashboard</Link><div className="form-brand"><CalendarDays size={18} /> RESERVATIONS & PAYMENTS</div></header>
      <div className="list-heading"><div><span className="eyebrow">ACCOMMODATION OPERATIONS</span><h1>Reservations</h1><p>Manage stays, check-ins, check-outs and guest payments.</p></div><Link href="/reservations/new" className="primary-link"><Plus size={16} /> New reservation</Link></div>
      {!configured && <div className="notice"><strong>Database setup required</strong><span>Configure Supabase and apply the migration before using reservations.</span></div>}
      {loadError && <div className="notice warning"><strong>Could not load reservations</strong><span>{loadError}</span></div>}
      {query.payment_saved === "1" && <div className="notice success"><strong>Payment recorded</strong><span>The reservation payment status has been recalculated by the database.</span></div>}
      {query.status_updated === "1" && <div className="notice success"><strong>Reservation updated</strong><span>The reservation status has been updated.</span></div>}
      {actionError && <div className="notice warning"><strong>Action could not be completed</strong><span>{messages[actionError] ?? "Check the reservation and staff permissions."}</span></div>}
      <section className="reservation-list">
        {reservations.length ? reservations.map((reservation) => {
          const paid = (reservation.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          const outstanding = Math.max(0, Number(reservation.total_amount) - paid);
          const nights = Math.max(0, Math.round((new Date(reservation.check_out + "T00:00:00Z").getTime() - new Date(reservation.check_in + "T00:00:00Z").getTime()) / 86400000));
          return <article className="reservation-card" key={reservation.id}>
            <div className="reservation-card-head"><div><h2>{reservation.guest_name}</h2><p>{reservation.guest_phone || "No phone recorded"} · {roomNumbers.has(reservation.room_id || "") ? "Room " + roomNumbers.get(reservation.room_id || "") : "No room assigned"}</p></div><span className={"badge " + reservation.status}>{reservation.status.replaceAll("_", " ")}</span></div>
            <div className="stay-summary"><div><small>CHECK-IN</small><strong>{reservation.check_in}</strong></div><div><small>CHECK-OUT</small><strong>{reservation.check_out}</strong></div><div><small>NIGHTS</small><strong>{nights}</strong></div><div><small>TOTAL</small><strong>{money.format(Number(reservation.total_amount))}</strong></div></div>
            <div className="payment-summary"><div><span>Paid</span><strong>{money.format(paid)}</strong></div><div><span>Balance</span><strong className={outstanding > 0 ? "balance-due" : "balance-clear"}>{money.format(outstanding)}</strong></div><span className={"badge " + reservation.payment_status}>{reservation.payment_status.replaceAll("_", " ")}</span></div>
            <div className="reservation-actions">
              <div className="status-actions">
                {(reservation.status === "confirmed" || reservation.status === "checked_in" || reservation.status === "enquiry") && <span className="action-label">Update stay</span>}
                {reservation.status === "confirmed" && <form action={updateReservationStatus}><input type="hidden" name="reservation_id" value={reservation.id} /><input type="hidden" name="status" value="checked_in" /><button className="small-action" type="submit">Check in</button></form>}
                {reservation.status === "checked_in" && <form action={updateReservationStatus}><input type="hidden" name="reservation_id" value={reservation.id} /><input type="hidden" name="status" value="checked_out" /><button className="small-action" type="submit">Check out</button></form>}
                {(reservation.status === "enquiry" || reservation.status === "confirmed") && <form action={updateReservationStatus}><input type="hidden" name="reservation_id" value={reservation.id} /><input type="hidden" name="status" value="cancelled" /><button className="small-action secondary" type="submit">Cancel</button></form>}
              </div>
              {outstanding > 0 && !["cancelled", "checked_out"].includes(reservation.status) && <details className="payment-details"><summary><Banknote size={15} /> Record payment</summary><form action={recordPayment} className="payment-form"><input type="hidden" name="reservation_id" value={reservation.id} /><label>Amount (UGX)<input type="number" name="amount" min="1" max={outstanding} step="1" defaultValue={outstanding} required /></label><label>Method<select name="method" defaultValue="mobile_money"><option value="mobile_money">Mobile Money</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></label><label>Reference (optional)<input name="reference" placeholder="Transaction ID" /></label><button className="small-action" type="submit">Save payment</button></form></details>}
            </div>
          </article>;
        }) : <div className="empty-state"><div className="empty-icon"><ReceiptText size={22} /></div><strong>No reservations yet</strong><p>Create a guest enquiry or confirmed booking to start tracking stays and payments.</p><Link href="/reservations/new" className="primary-link">Create reservation</Link></div>}
      </section>
      <footer>Accommodation only · Fixed rate UGX 100,000 per room per night · Payments are checked against the outstanding balance</footer>
    </main>
  );
}
