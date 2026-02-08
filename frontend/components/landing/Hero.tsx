'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconArrowRight, IconPlayerPlay } from '@tabler/icons-react';
import { useScrollReveal } from './useScrollReveal';

export default function Hero({ signUpUrl }: { signUpUrl: string }) {
  const ref = useScrollReveal();

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden pt-16">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
        <div className="absolute top-20 -left-32 h-[500px] w-[500px] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute top-40 -right-32 h-[400px] w-[400px] rounded-full bg-primary/[0.04] blur-3xl" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 py-20" ref={ref}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: Content */}
          <div className="max-w-2xl">
            <Badge variant="secondary" className="animate-fade-in-up mb-6 gap-2 px-3 py-1 text-xs font-semibold">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              AI-Powered Clinical Trial Matching
            </Badge>

            <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl animate-fade-in-up delay-100">
              Connect Patients{' '}
              <span className="text-primary">to the Right</span>{' '}
              Clinical Trials
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl animate-fade-in-up delay-200">
              Thousands of clinical trials need well-matched patients, yet the matching
              process is manual and inefficient. We use AI to bridge the gap --
              accelerating recruitment while giving patients access to innovative treatments.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col gap-4 sm:flex-row animate-fade-in-up delay-300">
              <Link href={signUpUrl}>
                <Button className="h-12 px-8 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-[1.02]">
                  Start Matching Patients
                  <IconArrowRight size={18} className="ml-1" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" className="h-12 px-8 text-base font-semibold rounded-xl">
                  <IconPlayerPlay size={18} className="mr-1" />
                  See How It Works
                </Button>
              </a>
            </div>

            {/* Social proof stats */}
            <div className="mt-12 flex flex-wrap items-center gap-8 animate-fade-in-up delay-400">
              <div>
                <p className="font-display text-3xl font-extrabold text-foreground">50K+</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Trials Indexed</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="font-display text-3xl font-extrabold text-foreground">95%</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Match Accuracy</p>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block" />
              <div className="hidden sm:block">
                <p className="font-display text-3xl font-extrabold text-foreground">3x</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Faster Enrollment</p>
              </div>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="relative animate-fade-in-up delay-300 hidden lg:block">
            <div className="relative">
              {/* Main card visual */}
              <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-2xl shadow-primary/[0.08]">
                {/* Simulated patient-trial match UI */}
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium text-foreground">AI Matching Engine Active</span>
                </div>

                {/* Patient card */}
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4 mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Patient Profile</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary/60" />
                      <span className="text-sm text-foreground">Stage II Non-Small Cell Lung Cancer</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary/60" />
                      <span className="text-sm text-foreground">EGFR Mutation Positive</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary/60" />
                      <span className="text-sm text-foreground">Prior Chemotherapy: 1 line</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center my-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>

                {/* Trial matches */}
                <div className="space-y-3">
                  {[
                    { match: '98%', title: 'NCT04761822 - Osimertinib + Savolitinib', phase: 'Phase III' },
                    { match: '94%', title: 'NCT05338970 - Amivantamab Combo', phase: 'Phase II' },
                    { match: '87%', title: 'NCT04487080 - Lazertinib Study', phase: 'Phase III' },
                  ].map((trial, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3 transition-all hover:border-primary/30 hover:shadow-sm">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-xs font-bold text-primary">
                        {trial.match}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{trial.title}</p>
                        <p className="text-xs text-muted-foreground">{trial.phase}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg animate-float">
                3 Matches Found
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
