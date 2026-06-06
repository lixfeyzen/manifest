import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { fetchMe } from '@/lib/queries.server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Manifest: Fulfillment Operations',
  description: 'Track every order from payment webhook to fulfillment.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await fetchMe();

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-brand-bg font-sans text-brand-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-brand-ink focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        {user ? (
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar email={user.email} />
              <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-10">
                {children}
              </main>
            </div>
          </div>
        ) : (
          <main id="main" className="grid min-h-screen place-items-center px-4">
            {children}
          </main>
        )}
      </body>
    </html>
  );
}
