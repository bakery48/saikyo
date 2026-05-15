import type { ReactNode } from 'react';

export const metadata = {
  title: 'さいきょうのモンスター',
  description: 'さいきょうのモンスターを作ろう — マルチプレイヤーボードゲーム',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
