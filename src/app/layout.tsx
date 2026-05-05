import type { Metadata } from "next";
import "./globals.css";
import InstagramBanner from "@/components/InstagramBanner";

export const metadata: Metadata = {
  title: "Monstah Voice AI | Premium Audio Chatbot",
  description: "A state-of-the-art voice-enabled AI assistant for your premium brand.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <InstagramBanner />
        {children}
      </body>
    </html>
  );
}
