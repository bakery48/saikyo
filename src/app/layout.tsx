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
          @keyframes phase-banner-slide {
            0%   { transform: translateY(-110%); opacity: 0; }
            12%  { transform: translateY(0);     opacity: 1; }
            78%  { transform: translateY(0);     opacity: 1; }
            100% { transform: translateY(-110%); opacity: 0; }
          }
          .phase-banner {
            animation: phase-banner-slide 0.85s cubic-bezier(0.22,1,0.36,1) forwards;
          }
          @keyframes stat-bounce {
            0%   { transform: scale(1); }
            28%  { transform: scale(1.5); }
            58%  { transform: scale(0.88); }
            82%  { transform: scale(1.06); }
            100% { transform: scale(1); }
          }
          .stat-bounce {
            display: inline-block;
            animation: stat-bounce 0.42s ease-out;
          }
          @keyframes champion-glow {
            0%, 100% { text-shadow: 0 0 8px #d4a000, 0 0 20px #d4a000; }
            50%       { text-shadow: 0 0 24px #ffd700, 0 0 48px #ffd700, 0 0 72px #ffa500; }
          }
          @keyframes champion-pop {
            0%   { transform: scale(0.4); opacity: 0; }
            65%  { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes confetti-fall {
            0%   { transform: translateY(0) rotate(0deg);    opacity: 1; }
            100% { transform: translateY(90vh) rotate(720deg); opacity: 0; }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
