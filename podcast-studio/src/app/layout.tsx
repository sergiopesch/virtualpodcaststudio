import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { ApiConfigProvider } from "@/contexts/api-config-context";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Virtual Podcast Studio | AI-Powered Research to Podcast Creation",
  description: "Discover and analyze research papers from arXiv to create engaging AI-powered podcast content. Transform academic research into compelling audio narratives.",
  keywords: ["podcast", "research", "AI", "arXiv", "audio", "content creation", "virtual studio"],
  authors: [{ name: "Virtual Podcast Studio Team" }],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#9333ea',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`} suppressHydrationWarning={true}>
        <ApiConfigProvider>
          <SidebarProvider>
            {children}
          </SidebarProvider>
        </ApiConfigProvider>
      </body>
    </html>
  );
}
