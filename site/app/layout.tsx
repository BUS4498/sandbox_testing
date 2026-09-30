import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internship Prep Desk · Student Workspace",
  description: "Signed-in internship discovery, fit review, and application preparation for students.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
