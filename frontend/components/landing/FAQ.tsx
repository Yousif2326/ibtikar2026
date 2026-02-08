'use client';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { useScrollReveal } from './useScrollReveal';

const faqs = [
  {
    question: 'How does the AI matching work?',
    answer:
      'Our system uses a combination of vector search and large language models to analyze patient medical records against the eligibility criteria of active clinical trials. It considers diagnosis, biomarkers, staging, prior treatments, demographics, and more to produce a relevance-ranked list of matching trials.',
  },
  {
    question: 'Is patient data stored or shared?',
    answer:
      'No. All patient data is processed ephemerally -- meaning it is used only for the duration of the matching session and then discarded. We never store, log, or share patient health information. Our platform is HIPAA-compliant by design.',
  },
  {
    question: 'What types of clinical trials are covered?',
    answer:
      'We index over 50,000 active interventional trials across all therapeutic areas, sourced from ClinicalTrials.gov and partner registries. This includes oncology, cardiology, neurology, rare diseases, and more. Our database is updated daily.',
  },
  {
    question: 'How accurate are the matches?',
    answer:
      'Our AI achieves a 95% match accuracy rate when benchmarked against expert manual screening. Each match includes a detailed breakdown of why the trial was recommended, including which eligibility criteria the patient meets or does not meet.',
  },
  {
    question: 'Can I use this for any patient population?',
    answer:
      'Yes. The platform supports matching for adult and pediatric patients across all disease areas. You can upload structured clinical data or use our OCR feature to scan printed medical documents, lab reports, or pathology results.',
  },
  {
    question: 'How long does it take to get results?',
    answer:
      'Typically under 60 seconds. After uploading patient information, the AI processes the data, searches across eligible trials, and returns a ranked list of matches almost instantly. Complex cases with extensive medical history may take slightly longer.',
  },
  {
    question: 'Is there a free trial available?',
    answer:
      'Yes. We offer a free tier that allows healthcare professionals to run a limited number of patient-trial matches per month. For higher volume needs, we offer professional and enterprise plans with unlimited matching and priority support.',
  },
  {
    question: 'Do I need special training to use the platform?',
    answer:
      'Not at all. The interface is designed for healthcare professionals with no technical background required. Upload a document or enter patient details, and the AI handles the rest. We also provide onboarding guides and live support.',
  },
];

export default function FAQ() {
  const ref = useScrollReveal();

  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8" ref={ref}>
        <div className="text-center" data-reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
            FAQ
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about TrialMatch.
          </p>
        </div>

        <div className="mt-12" data-reveal>
          <Accordion>
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={i}>
                <AccordionTrigger className="py-4 text-left text-base font-semibold text-foreground">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
