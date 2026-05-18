import type { ReactNode } from 'react';

export const metadata = {
  title: 'さいきょうのモンスター',
  description: 'さいきょうのモンスターを作ろう — マルチプレイヤーボードゲーム',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <style>{`
          @keyframes ssr-shine {
            0% { transform: translateX(-100%) skewX(-15deg); }
            100% { transform: translateX(300%) skewX(-15deg); }
          }
          .ssr-card {
            position: relative;
            overflow: hidden;
          }
          .ssr-card::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(
              105deg,
              transparent 35%,
              rgba(255, 220, 80, 0.55) 50%,
              transparent 65%
            );
            animation: ssr-shine 2.4s ease-in-out infinite;
            pointer-events: none;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
