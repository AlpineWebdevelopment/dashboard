import { Nunito } from 'next/font/google';
import { ReactNode } from 'react';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
});

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        body, html {
          background: #dde8b4 !important;
          background-image: none !important;
          color-scheme: light !important;
          color: #1a2808 !important;
        }
      `}</style>
      <div className={nunito.variable} style={{ fontFamily: 'var(--font-nunito), sans-serif' }}>
        {children}
      </div>
    </>
  );
}
