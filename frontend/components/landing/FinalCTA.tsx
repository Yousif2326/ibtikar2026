'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { useScrollReveal } from './useScrollReveal';

const perks = [
  'Free tier available',
  'No credit card required',
  'HIPAA compliant',
  'Set up in minutes',
];

export default function FinalCTA({ signUpUrl }: { signUpUrl: string }) {
  const ref = useScrollReveal();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-background" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-primary/[0.04] blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-5 sm:px-8 text-center" ref={ref}>
        <div data-reveal>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Ready to accelerate your{' '}
            <span className="text-primary">clinical trial recruitment?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Join healthcare professionals who are already matching patients to
            life-changing clinical trials faster than ever before.
          </p>

          {/* Perks */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {perks.map((perk, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconCheck size={16} className="text-primary shrink-0" />
                {perk}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href={signUpUrl}>
              <Button className="h-14 px-10 text-lg font-bold rounded-xl shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:scale-[1.02] animate-pulse-glow">
                Get Started Free
                <IconArrowRight size={20} className="ml-1" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="h-14 px-10 text-lg font-semibold rounded-xl">
                Sign In
              </Button>
            </Link>
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            No credit card required. Start matching patients in minutes.
          </p>
        </div>
      </div>
    </section>
  );
}
