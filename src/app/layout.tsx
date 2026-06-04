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
          @keyframes hp-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.45; }
          }
          .hp-danger {
            animation: hp-pulse 0.9s ease-in-out infinite;
          }
          @keyframes draft-shake {
            0%   { transform: translateX(0); }
            18%  { transform: translateX(-6px); }
            36%  { transform: translateX(6px); }
            54%  { transform: translateX(-4px); }
            72%  { transform: translateX(4px); }
            88%  { transform: translateX(-2px); }
            100% { transform: translateX(0); }
          }
          .draft-shake {
            animation: draft-shake 0.5s ease-out;
          }
          @keyframes badge-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0,102,204,0); }
            50%       { box-shadow: 0 0 0 5px rgba(0,102,204,0.25); }
          }
          .badge-pending {
            animation: badge-pulse 1.4s ease-in-out infinite;
          }
          @keyframes card-get {
            0%   { transform: scale(0.7); opacity: 0; }
            60%  { transform: scale(1.12); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .card-get {
            animation: card-get 0.4s cubic-bezier(0.22,1,0.36,1) both;
          }
          @keyframes first-mover-pop {
            0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 0; }
            55%  { transform: translate(-50%,-50%) scale(1.08); opacity: 1; }
            75%  { transform: translate(-50%,-50%) scale(1.0); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(1.0); opacity: 0; }
          }
          @keyframes monster-enter {
            0%   { transform: translateY(24px) scale(0.92); opacity: 0; }
            70%  { transform: translateY(-4px) scale(1.02); opacity: 1; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes card-flip-in {
            0%   { transform: rotateY(90deg) scale(0.96); opacity: 0.2; }
            60%  { transform: rotateY(-8deg) scale(1.02); opacity: 1; }
            100% { transform: rotateY(0deg) scale(1); opacity: 1; }
          }
          .card-flip-in {
            animation: card-flip-in 0.5s cubic-bezier(0.22,1,0.36,1) both;
            transform-origin: left center;
          }
          @keyframes reward-pop {
            0%   { transform: translateY(0) scale(1); opacity: 1; }
            40%  { transform: translateY(-28px) scale(1.4); opacity: 1; }
            100% { transform: translateY(-52px) scale(0.9); opacity: 0; }
          }
          .reward-pop {
            position: absolute;
            pointer-events: none;
            font-weight: 700;
            font-size: 20px;
            color: #0066cc;
            animation: reward-pop 1.1s ease-out forwards;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
