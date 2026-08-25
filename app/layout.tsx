import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Academic Prepare",
  description:
    "Prepare and improve your academic documents before submission — grammar, clarity, structure, citations, and university guideline checks.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
