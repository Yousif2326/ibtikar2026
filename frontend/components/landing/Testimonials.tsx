'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useScrollReveal } from './useScrollReveal';

const testimonials = [
  {
    name: 'Dr. Sarah Chen',
    role: 'Oncologist',
    org: 'Memorial Cancer Center',
    initials: 'SC',
    rating: 5,
    content:
      'TrialMatch completely transformed how we identify trials for our patients. What used to take our research coordinators hours now takes minutes. We enrolled 40% more patients in our first quarter using it.',
  },
  {
    name: 'Dr. James Okafor',
    role: 'Clinical Research Director',
    org: 'Midwest Research Network',
    initials: 'JO',
    rating: 5,
    content:
      'The accuracy of the AI matching is remarkable. It picked up on biomarker-specific eligibility criteria that our team had overlooked. This tool is indispensable for any trial site.',
  },
  {
    name: 'Dr. Maria Gonzalez',
    role: 'Pulmonologist',
    org: 'Southwest Medical Group',
    initials: 'MG',
    rating: 5,
    content:
      'My patients are getting access to treatments they would never have found on their own. One patient was matched to a Phase III trial that has since shown incredible results. This is life-changing technology.',
  },
  {
    name: 'Dr. David Park',
    role: 'Hematologist',
    org: 'Pacific Coast Health',
    initials: 'DP',
    rating: 5,
    content:
      'We integrated TrialMatch into our clinical workflow and saw immediate results. The HIPAA-compliant design gave our compliance team full confidence. Enrollment rates have tripled.',
  },
  {
    name: 'Dr. Emily Watson',
    role: 'Research Coordinator',
    org: 'University Clinical Trials Unit',
    initials: 'EW',
    rating: 5,
    content:
      'As someone who manually screened patients for years, this tool is a game-changer. The OCR feature alone saves me hours per week. The matching quality is consistently excellent.',
  },
  {
    name: 'Dr. Michael Rivera',
    role: 'Chief Medical Officer',
    org: 'TriState Health Partners',
    initials: 'MR',
    rating: 5,
    content:
      'From a leadership perspective, TrialMatch has been transformative. It reduces our cost per enrolled patient significantly while improving patient satisfaction scores across the board.',
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          className="h-4 w-4 fill-primary text-primary"
          viewBox="0 0 20 20"
        >
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const ref = useScrollReveal();

  return (
    <section id="testimonials" className="py-24 sm:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-5 sm:px-8" ref={ref}>
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
            Testimonials
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Trusted by healthcare professionals
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See what physicians and research teams have to say about TrialMatch.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
          {testimonials.map((t, i) => (
            <Card
              key={i}
              className="group border-border/50 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            >
              <CardContent className="p-6">
                {/* Rating */}
                <StarRating count={t.rating} />

                {/* Quote */}
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{t.content}&rdquo;
                </p>

                {/* Author */}
                <div className="mt-5 flex items-center gap-3 border-t border-border/50 pt-4">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                      {t.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.role}, {t.org}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
