'use client';

import { IconUpload, IconBrain, IconListCheck } from '@tabler/icons-react';
import { useScrollReveal } from './useScrollReveal';

const steps = [
  {
    icon: IconUpload,
    step: '01',
    title: 'Upload Patient Data',
    description:
      'Snap a photo of patient documents or enter clinical details directly. Our OCR engine extracts key medical information in seconds.',
  },
  {
    icon: IconBrain,
    step: '02',
    title: 'AI Matches Trials',
    description:
      'Our model analyzes eligibility criteria across thousands of active trials, scoring each match by relevance, location, and phase.',
  },
  {
    icon: IconListCheck,
    step: '03',
    title: 'Review & Enroll',
    description:
      'Receive a ranked list of matching trials with detailed breakdowns. Review eligibility and connect patients to the right trial.',
  },
];

export default function HowItWorks() {
  const ref = useScrollReveal();

  return (
    <section id="how-it-works" className="relative py-24 sm:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-5 sm:px-8" ref={ref}>
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
            How It Works
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From patient data to trial match in minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Three simple steps to connect patients with life-changing clinical trials.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3 md:gap-6 lg:gap-12" data-reveal>
          {steps.map((step, i) => (
            <div key={i} className="group relative">
              {/* Connector line (desktop only) */}
              {i < steps.length - 1 && (
                <div className="absolute top-12 left-[calc(50%+48px)] hidden h-px w-[calc(100%-96px)] bg-border md:block" />
              )}

              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className="relative mb-6">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/[0.08] transition-all group-hover:bg-primary/[0.12] group-hover:shadow-lg group-hover:shadow-primary/10">
                    <step.icon size={36} className="text-primary" strokeWidth={1.5} />
                  </div>
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground shadow-sm">
                    {step.step}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
