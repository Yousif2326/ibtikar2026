import Link from 'next/link';
import {
  getSignUpUrl,
  withAuth,
  signOut,
} from '@workos-inc/authkit-nextjs';

export default async function HomePage() {
  // Retrieves the user from the session or returns `null` if no user is signed in
  const { user } = await withAuth();

  // Get the URL to redirect the user to AuthKit to sign up
  const signUpUrl = await getSignUpUrl();

  if (!user) {
    return (
      <main>
        <h1>Welcome</h1>
        <p>Please sign in to continue.</p>
        <Link href="/login">Sign in</Link>
        {' | '}
        <Link href={signUpUrl}>Sign up</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>Welcome back{user.firstName && `, ${user.firstName}`}</h1>
      <p>Email: {user.email}</p>
      <form
        action={async () => {
          'use server';
          await signOut();
        }}
      >
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
