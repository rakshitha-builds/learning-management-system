import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  title: { default: "Collab — real-time workspace", template: "%s · Collab" },
  description: "A real-time collaborative workspace: write together, see every cursor, comment and never lose a change.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#6366f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
