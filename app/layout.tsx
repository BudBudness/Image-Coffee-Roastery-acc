import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Coffee Roastery | Accommodation Desk",
  description: "Room reservations and accommodation operations for Image Coffee Roastery.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
