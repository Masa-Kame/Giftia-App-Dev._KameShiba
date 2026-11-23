import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MascotFollower from "@/components/MascotFollower";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Giftia｜贈る相手に合うギフトを迷わず選べる",
  description: "シーン・相手・予算から、理由付きのおすすめと同じシーンの口コミでギフト選びを支援します",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        {/* かめしばマスコット：カーソルを追いかける（全画面共通） */}
        <MascotFollower />
      </body>
    </html>
  );
}
