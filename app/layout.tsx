import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/Toast";
import ProtoGuide from "@/components/ProtoGuide";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = { title: "VTH Thank You Spin – Design Prototype", description: "Clickable design & UX prototype for the VTH Thank You Spin experience." };
export const viewport: Viewport = { themeColor: "#070920", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <StoreProvider>
          <ToastProvider>
            {children}
            <ProtoGuide />
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
