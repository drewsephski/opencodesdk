import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "squid-chat",
  description: "AI chat powered by OpenCode SDK",
  icons: {
    icon: "/squid-chat-logo.svg",
    shortcut: "/squid-chat-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem("studio-theme"));if(t==="dark"||t==="light"){if(t==="dark")document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=t}else{if(window.matchMedia("(prefers-color-scheme:dark)").matches){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}else{document.documentElement.style.colorScheme="light"}}}catch(e){if(window.matchMedia("(prefers-color-scheme:dark)").matches)document.documentElement.classList.add("dark")}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
