import Link from 'next/link';
import {
  getSignUpUrl,
  withAuth,
} from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const { user } = await withAuth();
  const signUpUrl = await getSignUpUrl();

  // If already authenticated, go straight to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              <path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66" />
              <path d="m18 15-2-2" />
              <path d="m15 18-2-2" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Clinical Trial Matcher
          </h1>
          <p className="mt-3 text-muted-foreground">
            AI-powered clinical trial matching for healthcare professionals.
            Upload patient documents, and we&apos;ll find relevant clinical trials
            in seconds.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign In
          </Link>
          <Link
            href={signUpUrl}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Create Account
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          HIPAA-compliant. All patient data is processed ephemerally and never stored.
        </p>
      </div>
    </main>
  );
}
