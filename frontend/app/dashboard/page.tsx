import { withAuth, signOut } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  const { user } = await withAuth();

  if (!user) {
    redirect('/');
  }

  return (
    <DashboardClient
      user={{
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
      }}
      signOutAction={async () => {
        'use server';
        await signOut();
      }}
    />
  );
}
