import type { Metadata, Viewport } from "next";
import { Poppins, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import ProtoGuide from "@/components/ProtoGuide";

const inter = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = { title: "VTH Thank You Spin", description: "Spin the wheel and claim your thank-you reward from the Vocational Training Hub.", icons: { icon: "/favicon.svg" } };
export const viewport: Viewport = { themeColor: "#0a0e2e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <ToastProvider>
          {children}
          <ProtoGuide />
        </ToastProvider>
      </body>
    </html>
  );
}
