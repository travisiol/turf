import type { Metadata, Viewport } from "next";
import { Roboto_Mono, Space_Grotesk } from "next/font/google";
import { Footer, Navbar } from "@/components/Chrome";
import { Providers } from "@/components/Providers";
import { site } from "@/config/site";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const mono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono", display: "swap" });

const TITLE = `${site.name} — ${site.hook}`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: TITLE, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { title: TITLE, description: site.description, siteName: site.name, type: "website" },
};

export const viewport: Viewport = { themeColor: "#F8F4EA", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body className="min-h-svh">
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
