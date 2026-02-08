import {
  getSignUpUrl,
  withAuth,
} from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import Benefits from '@/components/landing/Benefits';
import Testimonials from '@/components/landing/Testimonials';
import FAQ from '@/components/landing/FAQ';
import FinalCTA from '@/components/landing/FinalCTA';
import Footer from '@/components/landing/Footer';

export default async function HomePage() {
  const { user } = await withAuth();
  const signUpUrl = await getSignUpUrl();

  // If already authenticated, go straight to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <>
      <Header signUpUrl={signUpUrl} />
      <main>
        <Hero signUpUrl={signUpUrl} />
        <HowItWorks />
        <Benefits />
        <Testimonials />
        <FAQ />
        <FinalCTA signUpUrl={signUpUrl} />
      </main>
      <Footer />
    </>
  );
}
