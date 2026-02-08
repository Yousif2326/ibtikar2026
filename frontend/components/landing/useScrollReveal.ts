'use client';

import { useEffect, useRef } from 'react';

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in-up');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    // Observe direct children that have data-reveal attribute
    const children = el.querySelectorAll('[data-reveal]');
    children.forEach((child) => {
      child.classList.add('opacity-0');
      observer.observe(child);
    });

    return () => observer.disconnect();
  }, []);

  return ref;
}
