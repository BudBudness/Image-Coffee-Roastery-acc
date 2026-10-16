import Link from "next/link";
import { ArrowLeft, CalendarClock, CheckCircle2, PhoneCall } from "lucide-react";
import { completeFollowUp, createFollowUp } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };
type FollowUp = {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  channel: string;
  due_at: string;
  completed_at: string | null;
  outcome: string | null;
};
type ReservationOption = { id: string; guest_name: string; check_in: string };

const errorMessages: Record<string, string> = {
  invalid: "Enter a guest name, due date and valid follow-up channel.",
  save: "The follow-up could not be saved. Check your staff access and database setup.",
};

export default async function FollowUpsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  let followUps: FollowUp[] = [];
  let reservations: ReservationOption[] = [];
  let loadError = "";

  if (configured) {
    const supabase = await createClient();
    const [followUpResult, reservationResult] = await Promise.all([
      supabase.from("guest_follow_ups").select("id, guest_name, guest_phone, channel, due_at, completed_at, outcome").order("completed_at", { ascending: true, nullsFirst: true }).order("due_at", { ascending: true }).limit(100),
      supabase.from("reservations").select("id, guest_name, check_in").order("created_at", { ascending: false }).limit(100),
    ]);
    if (followUpResult.error) loadError = followUpResult.error.message;
    else followUps = (followUpResult.data ?? []) as FollowUp[];
    if (reservationResult.error && !loadError) loadError = reservationResult.error.message;
    else reservations = reservationResult.data ?? [];
  }

  const now = Date.now();
  return (
    <main className="form-shell reservations-shell">
      <header className="form-topbar"><Link href="/" className="back-link"><ArrowLeft size={17} /> Dashboard</Link><div className="form-brand"><PhoneCall size={18} /> GUEST FOLLOW-UPS</div></header>
      <div className="list-heading"><div><span className="eyebrow">GUEST RELATIONSHIPS</span><h1>Follow-up queue</h1><p>Schedule callbacks and guest messages, then record the outcome.</p></div></div>
      {!configured && <div className="notice"><strong>Database setup required</strong><span>Configure Supabase and apply the migration before using follow-ups.</span></div>}
      {loadError && <div className="notice warning"><strong>Could not load follow-ups</strong><span>{loadError}</span></div>}
      {query.created === "1" && <div className="notice success"><strong>Follow-up scheduled</strong><span>The item has been added to the queue.</span></div>}
      {query.completed === "1" && <div className="notice success"><strong>Follow-up completed</strong><span>The outcome has been recorded.</span></div>}
      {query.error && <div className="notice warning"><strong>Could not save follow-up</strong><span>{errorMessages[query.error] ?? "Check the details and try again."}</span></div>}

      <section className="panel followup-create">
        <div className="panel-heading"><div><h2>Schedule a follow-up</h2><p>Choose when the team should contact the guest.</p></div><CalendarClock size={20} /></div>
        <form action={createFollowUp} className="form-grid">
          <label>Guest name *<input name="guest_name" required placeholder="Guest full name" /></label>
          <label>Phone number<input name="guest_phone" type="tel" placeholder="+256…" /></label>
          <label>Due date and time (Uganda time) *<input name="due_at" type="datetime-local" required /></label>
          <label>Contact channel<select name="channel" defaultValue="phone"><option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option><option value="other">Other</option></select></label>
          <label className="full-span">Related reservation (optional)<select name="reservation_id" defaultValue=""><option value="">Not linked to a reservation</option>{reservations.map((reservation) => <option value={reservation.id} key={reservation.id}>{reservation.guest_name} · {reservation.check_in}</option>)}</select></label>
          <div className="full-span form-actions"><button type="submit" disabled={!configured}>Schedule follow-up</button></div>
        </form>
      </section>

      <section className="followup-list">
        <div className="panel-heading"><div><h2>Follow-up queue</h2><p>{followUps.filter((item) => !item.completed_at).length} open items · up to 100 recent records</p></div></div>
        {followUps.length ? followUps.map((item) => {
          const overdue = !item.completed_at && new Date(item.due_at).getTime() < now;
          return <article className="followup-card" key={item.id}>
            <div className="followup-head"><div><h3>{item.guest_name}</h3><p>{item.guest_phone || "No phone recorded"} · {item.channel.toUpperCase()}</p></div><span className={"badge " + (item.completed_at ? "confirmed" : overdue ? "cancelled" : "enquiry")}>{item.completed_at ? "Completed" : overdue ? "Overdue" : "Scheduled"}</span></div>
            <div className="followup-due"><CalendarClock size={15} /><span>{new Date(item.due_at).toLocaleString("en-UG", { timeZone: "Africa/Kampala", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} EAT</span></div>
            {item.completed_at ? <p className="followup-outcome"><CheckCircle2 size={15} /> {item.outcome || "Completed — no outcome note"}</p> : <form action={completeFollowUp} className="followup-complete"><input type="hidden" name="follow_up_id" value={item.id} /><input name="outcome" placeholder="Outcome / notes (optional)" /><button className="small-action" type="submit">Mark completed</button></form>}
          </article>;
        }) : <div className="empty-state"><div className="empty-icon"><PhoneCall size={22} /></div><strong>No follow-ups scheduled</strong><p>Schedule a guest callback or message to create the first queue item.</p></div>}
      </section>
      <footer>Guest follow-up queue · Times shown in East Africa Time (UTC+3)</footer>
    </main>
  );
}
