import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { fetchMe } from '@/lib/queries.server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Manifest — Fulfillment Operations',
  description: 'Track every order from payment webhook to fulfillment.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await fetchMe();

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-brand-bg font-sans text-brand-ink antialiased">
        {user ? (
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar email={user.email} />
              <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-10">{children}</main>
            </div>
          </div>
        ) : (
          <div className="grid min-h-screen place-items-center px-4">{children}</div>
        )}
      </body>
    </html>
  );
}
