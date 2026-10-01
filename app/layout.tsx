import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Almond Eye Database",
  description:
    "Uma Musume support deck builder, parent deck farmer, and skill activation visualizer.",
  icons: {
    icon: [{ url: "/assets/icon.png", type: "image/png", sizes: "256x256" }],
    apple: [{ url: "/assets/icon.png", type: "image/png", sizes: "256x256" }],
  },
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
            __html: `(function(){try{var t=localStorage.getItem('almond_theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||((!t||t==='system')&&d)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}try{window.addEventListener('error',function(e){if(e&&(e.message==='Script error.'||(!e.error&&!e.filename))){e.stopImmediatePropagation();}},true);window.addEventListener('unhandledrejection',function(e){if(e&&(e.reason==='Script error.'||String(e.reason)==='Script error.')){e.stopImmediatePropagation();}},true);}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-[var(--bg-app)] text-[var(--text-primary)] antialiased transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
