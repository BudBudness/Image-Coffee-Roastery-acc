import { BedDouble, CalendarDays, CircleDollarSign, ClipboardList, Coffee, LogOut, Users } from "lucide-react";
import { signOut } from "@/app/actions";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 });

export const dynamic = "force-dynamic";

type Room = { id: string; room_number: string; room_type: string | null; status: string };
type Reservation = {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number;
  payment_status: string;
  payments: { amount: number }[];
};

export default async function Home({ searchParams }: { searchParams: Promise<{ reservation_created?: string }> }) {
  const query = await searchParams;
  let configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  let rooms: Room[] = [];
  let reservations: Reservation[] = [];
  let loadError = "";

  if (configured) {
    try {
      const supabase = await createClient();
      const [roomResult, reservationResult] = await Promise.all([
        supabase.from("rooms").select("id, room_number, room_type, status").order("room_number"),
        supabase.from("reservations").select("id, guest_name, check_in, check_out, status, total_amount, payment_status, payments(amount)").order("created_at", { ascending: false }).limit(8),
      ]);
      if (roomResult.error) loadError = roomResult.error.message;
      else rooms = roomResult.data ?? [];
      if (reservationResult.error && !loadError) loadError = reservationResult.error.message;
      else reservations = reservationResult.data ?? [];
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Could not connect to the database.";
    }
  }

  const occupied = rooms.filter((room) => room.status === "occupied").length;
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const datePart = (type: string) => dateParts.find((part) => part.type === type)?.value ?? "";
  const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const arrivals = reservations.filter((reservation) => reservation.check_in === today && reservation.status === "confirmed").length;
  const outstanding = reservations.reduce((sum, reservation) => {
    if (reservation.payment_status === "paid") return sum;
    const paid = (reservation.payments ?? []).reduce((paidTotal, payment) => paidTotal + Number(payment.amount || 0), 0);
    return sum + Math.max(0, Number(reservation.total_amount || 0) - paid);
  }, 0);
  const displayRooms = rooms.length ? rooms : (!configured ? Array.from({ length: 13 }, (_, i) => ({ id: String(i + 1), room_number: String(i + 1).padStart(2, "0"), room_type: "Standard", status: "not_configured" })) : []);
  const totalRooms = configured ? rooms.length : 13;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Coffee size={22} /></span><div><strong>IMAGE</strong><small>COFFEE ROASTERY</small></div></div>
        <div className="side-label">ACCOMMODATION</div>
        <a className="nav-link active" href="#"><BedDouble size={18} /> Overview</a>
        <a className="nav-link" href="#reservations"><CalendarDays size={18} /> Reservations</a>
        <a className="nav-link" href="#rooms"><Users size={18} /> Rooms & occupancy</a>
        <div className="sidebar-bottom"><span className="status-dot" /> Accommodation desk <small>13 rooms · Mbarara, Uganda</small></div>
      </aside>

      <section className="main">
        <header className="topbar"><div><span className="eyebrow">IMAGE COFFEE ROASTERY</span><h1>Accommodation overview</h1><p>Bookings, room availability and guest payments.</p></div><div className="topbar-actions"><Link href="/reservations/new" className="primary-link">+ New reservation</Link><div className="topbar-date"><CalendarDays size={16} /> {new Date().toLocaleDateString("en-UG", { timeZone: "Africa/Kampala", weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div><form action={signOut}><button className="signout-button" type="submit"><LogOut size={15} /> Sign out</button></form></div></header>

        {query.reservation_created === "1" && <div className="notice success"><strong>Reservation saved</strong><span>The reservation was created successfully. Recent activity has been refreshed.</span></div>}
        {!configured && <div className="notice"><strong>Database setup required</strong><span>Add the Supabase project URL and publishable key to the deployment environment, then apply the migration in <code>supabase/migrations</code>. Live data will appear once configured.</span></div>}
        {loadError && <div className="notice warning"><strong>Data connection needs attention</strong><span>{loadError}. Confirm that the migration is applied and your signed-in role has the required access.</span></div>}

        <div className="metrics">
          <article className="metric"><div className="metric-top"><span>Total rooms</span><BedDouble size={18} /></div><strong>{rooms.length || 13}</strong><small>Fixed rate {money.format(100000)} / night</small></article>
          <article className="metric"><div className="metric-top"><span>Occupied now</span><Users size={18} /></div><strong>{occupied}</strong><small>{rooms.length ? Math.round((occupied / rooms.length) * 100) : 0}% of registered rooms</small></article>
          <article className="metric"><div className="metric-top"><span>Arrivals today</span><CalendarDays size={18} /></div><strong>{arrivals}</strong><small>Confirmed reservations</small></article>
          <article className="metric"><div className="metric-top"><span>Outstanding balance (latest 8)</span><CircleDollarSign size={18} /></div><strong className="money">{money.format(outstanding)}</strong><small>After recorded payments · latest 8</small></article>
        </div>

        <section className="panel" id="rooms"><div className="panel-heading"><div><h2>Room inventory</h2><p>Availability and occupancy across the property</p></div><span className="count-pill">{totalRooms} rooms</span></div>
          <div className="room-grid">{displayRooms.map((room) => <div className="room-tile" key={room.id}><div className="room-number"><BedDouble size={17} /><strong>{room.room_number}</strong></div><span className={"room-status " + (room.status === "available" ? "available" : room.status === "occupied" ? "occupied" : room.status === "maintenance" ? "maintenance" : "setup")}>{room.status.replaceAll("_", " ")}</span><small>{room.room_type || "Standard room"}</small></div>)}</div>{configured && !rooms.length && <div className="empty-state"><strong>No room records loaded</strong><p>Confirm that the database migration is applied and your account has a staff profile.</p></div>}
        </section>

        <section className="panel" id="reservations"><div className="panel-heading"><div><h2>Recent reservations</h2><p>Latest guest booking activity</p></div><ClipboardList size={20} /></div>
          {reservations.length ? <div className="table-wrap"><table><thead><tr><th>Guest</th><th>Stay</th><th>Status</th><th>Payment</th><th>Total</th></tr></thead><tbody>{reservations.map((reservation) => <tr key={reservation.id}><td className="guest-name">{reservation.guest_name}</td><td>{reservation.check_in} <span className="muted">to</span> {reservation.check_out}</td><td><span className={"badge " + reservation.status}>{reservation.status}</span></td><td>{reservation.payment_status.replaceAll("_", " ")}</td><td className="amount">{money.format(Number(reservation.total_amount))}</td></tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-icon"><CalendarDays size={22} /></div><strong>No reservations to display</strong><p>Reservations will appear here after the database is connected and records are created.</p></div>}
        </section>
        <footer>Accommodation management · All prices in UGX · Restaurant and roastery sales excluded</footer>
      </section>
    </main>
  );
}
