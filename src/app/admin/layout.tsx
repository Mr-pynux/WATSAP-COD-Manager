import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "لوحة التحكم — ShoeSpot",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "any" },
      { url: "/shoespot-logo.png", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: "/shoespot-logo.png",
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}
