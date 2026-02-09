'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  IconBolt,
  IconShieldCheck,
  IconClockHour4,
  IconTargetArrow,
  IconUsers,
  IconWorldSearch,
} from '@tabler/icons-react';
import { useScrollReveal } from './useScrollReveal';

const benefits = [
  {
    icon: IconBolt,
    title: 'Instant Matching',
    description:
      'Go from patient intake to treatment trial matches in under 60 seconds. No more hours of manual database searching.',
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
  },
  {
    icon: IconTargetArrow,
    title: '95% Match Accuracy',
    description:
      'Our AI analyzes complex eligibility criteria including biomarkers, staging, and treatment history for precise matching.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: IconShieldCheck,
    title: 'Privacy-Focused',
    description:
      'All patient data is processed ephemerally and never stored. We are not HIPAA compliant yet; use accordingly. Built with healthcare privacy in mind.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: IconClockHour4,
    title: '3x Faster Enrollment',
    description:
      'Clinical trials using our platform enroll patients three times faster than traditional manual methods.',
    color: 'text-blue-600',
    bg: 'bg-blue-500/10',
  },
  {
    icon: IconUsers,
    title: 'Patient Access',
    description:
      'Give patients access to cutting-edge treatments they may never have known existed. Every match is a potential breakthrough.',
    color: 'text-violet-600',
    bg: 'bg-violet-500/10',
  },
  {
    icon: IconWorldSearch,
    title: '50K+ Active Trials',
    description:
      'Our database covers trials across all therapeutic areas, continually updated from ClinicalTrials.gov and partner registries.',
    color: 'text-rose-600',
    bg: 'bg-rose-500/10',
  },
];

export default function Benefits() {
  const ref = useScrollReveal();

  return (
    <section id="benefits" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8" ref={ref}>
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
            Why Treatment Trial Match
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for healthcare professionals who value precision
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every feature is designed to make treatment trial matching faster, safer, and more accurate.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
          {benefits.map((b, i) => (
            <Card
              key={i}
              className="group border-border/50 bg-card transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/[0.05] hover:-translate-y-0.5"
            >
              <CardContent className="p-6">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${b.bg} transition-transform group-hover:scale-110`}>
                  <b.icon size={24} className={b.color} strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">
                  {b.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {b.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
