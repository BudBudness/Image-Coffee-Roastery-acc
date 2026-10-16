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
