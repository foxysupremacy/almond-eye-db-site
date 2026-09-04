import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlmondEye DB - Deck Builder + Skill Zones",
  description:
    "Uma Musume support deck builder, parent deck farmer, and skill activation visualizer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('almond_theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||((!t||t==='system')&&d)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-[var(--bg-app)] text-[var(--text-primary)] antialiased transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
