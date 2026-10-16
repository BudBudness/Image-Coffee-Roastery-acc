"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createReservation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const guestName = String(formData.get("guest_name") ?? "").trim();
  const guestPhone = String(formData.get("guest_phone") ?? "").trim();
  const guestEmail = String(formData.get("guest_email") ?? "").trim();
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");
  const requestedStatus = String(formData.get("status") ?? "enquiry");
  const selectedRoom = String(formData.get("room_id") ?? "");
  const adults = Number(formData.get("adults") ?? 1);
  const children = Number(formData.get("children") ?? 0);
  const specialRequests = String(formData.get("special_requests") ?? "").trim();

  if (!guestName || !checkIn || !checkOut || !["enquiry", "confirmed"].includes(requestedStatus)) {
    redirect("/reservations/new?error=invalid");
  }

  const start = new Date(checkIn + "T00:00:00Z");
  const end = new Date(checkOut + "T00:00:00Z");
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (!Number.isFinite(nights) || nights < 1 || !Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) {
    redirect("/reservations/new?error=dates");
  }
  if (requestedStatus === "confirmed" && !selectedRoom) {
    redirect("/reservations/new?error=room_required");
  }

  const { error } = await supabase.from("reservations").insert({
    guest_name: guestName,
    guest_phone: guestPhone || null,
    guest_email: guestEmail || null,
    check_in: checkIn,
    check_out: checkOut,
    room_id: requestedStatus === "confirmed" ? selectedRoom : null,
    adults,
    children,
    status: requestedStatus,
    nightly_rate: 100000,
    total_amount: nights * 100000,
    payment_status: "unpaid",
    special_requests: specialRequests || null,
    created_by: user.id,
  });

  if (error) {
    const reason = error.code === "23P01" ? "conflict" : error.code === "42501" ? "permission" : "save";
    redirect("/reservations/new?error=" + reason);
  }

  revalidatePath("/");
  redirect("/?reservation_created=1");
}

export async function updateReservationStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("reservation_id") ?? "");
  const nextStatus = String(formData.get("status") ?? "");
  if (!id || !["checked_in", "checked_out", "cancelled"].includes(nextStatus)) {
    redirect("/reservations?status_error=invalid");
  }

  const { data: reservation, error: readError } = await supabase
    .from("reservations")
    .select("id, room_id, status")
    .eq("id", id)
    .single();

  if (readError || !reservation) redirect("/reservations?status_error=not_found");
  const allowed =
    (reservation.status === "confirmed" && ["checked_in", "cancelled"].includes(nextStatus)) ||
    (reservation.status === "checked_in" && nextStatus === "checked_out") ||
    (reservation.status === "enquiry" && nextStatus === "cancelled");

  if (!allowed) redirect("/reservations?status_error=transition");
  if (nextStatus === "checked_in" && !reservation.room_id) redirect("/reservations?status_error=room_required");
  if (nextStatus === "checked_in" && reservation.room_id) {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", reservation.room_id)
      .single();
    if (roomError || !room || room.status === "maintenance") {
      redirect("/reservations?status_error=room_unavailable");
    }
  }

  const { error: updateError } = await supabase
    .from("reservations")
    .update({ status: nextStatus })
    .eq("id", id);

  if (updateError) redirect("/reservations?status_error=save");

  if (reservation.room_id && nextStatus === "checked_in") {
    await supabase.from("rooms").update({ status: "occupied" }).eq("id", reservation.room_id);
  }
  if (reservation.room_id && nextStatus === "checked_out") {
    await supabase.from("rooms").update({ status: "available" }).eq("id", reservation.room_id).neq("status", "maintenance");
  }

  revalidatePath("/");
  revalidatePath("/reservations");
  redirect("/reservations?status_updated=1");
}

export async function recordPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const reservationId = String(formData.get("reservation_id") ?? "");
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();

  if (!reservationId || !Number.isFinite(amount) || amount <= 0 || !["cash", "mobile_money", "bank_transfer", "card", "other"].includes(method)) {
    redirect("/reservations?payment_error=invalid");
  }

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("id, total_amount, payments(amount)")
    .eq("id", reservationId)
    .single();

  if (reservationError || !reservation) redirect("/reservations?payment_error=not_found");
  const alreadyPaid = ((reservation.payments ?? []) as { amount: number }[]).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstanding = Math.max(0, Number(reservation.total_amount) - alreadyPaid);
  if (amount > outstanding) redirect("/reservations?payment_error=overpay");

  const { error } = await supabase.from("payments").insert({
    reservation_id: reservationId,
    amount,
    method,
    reference: reference || null,
    received_by: user.id,
  });

  if (error) {
    const reason = error.code === "42501" ? "permission" : error.message.includes("outstanding") ? "overpay" : "save";
    redirect("/reservations?payment_error=" + reason);
  }

  revalidatePath("/");
  revalidatePath("/reservations");
  redirect("/reservations?payment_saved=1");
}
