import "./globals.css";
import { Cinzel_Decorative } from "next/font/google";

const wizardFont = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-wizard",
});

export const metadata = {
  title: "Dorothy & The Witch",
  description:
    "Plan your magical journey through Oz with Dorothy's interactive cost calculator",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${wizardFont.variable}`}>
      <head>
        <link rel="icon" href="/Logo.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/Logo.png" sizes="180x180" />
        <meta name="msapplication-TileImage" content="/Logo.png" />
        <meta name="msapplication-TileColor" content="#434343" />
      </head>
      <body>{children}</body>
    </html>
  );
}
