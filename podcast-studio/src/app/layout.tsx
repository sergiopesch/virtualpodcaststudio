"use client";

import React from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { ApiConfigProvider } from "@/contexts/api-config-context";
import { ErrorBoundary } from "@/components/error-boundary";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Virtual Podcast Studio</title>
        <meta name="description" content="Create AI-powered podcasts from research papers" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ErrorBoundary>
          <SidebarProvider>
            <ApiConfigProvider>
              {children}
            </ApiConfigProvider>
          </SidebarProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}