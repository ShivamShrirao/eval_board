import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eval Board",
  description: "Visualize and compare diffusion model outputs across checkpoints and datasets."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
