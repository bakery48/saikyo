import type { ReactNode } from 'react';

export const metadata = {
  title: 'Saikyo Monster Battle',
  description: 'Build the strongest monster — multiplayer board game',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
