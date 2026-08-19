import { AiSolutionsSection } from '@/components/home/AiSolutionsSection';
import { ArchitectureMap } from '@/components/home/ArchitectureMap';
import { CapabilitiesBar } from '@/components/home/CapabilitiesBar';
import { ContactSection } from '@/components/home/ContactSection';
import { FinalCtaSection } from '@/components/home/FinalCtaSection';
import { HeroSection } from '@/components/home/HeroSection';
import { ProcessSection } from '@/components/home/ProcessSection';
import { SecurePaymentModule } from '@/components/home/SecurePaymentModule';
import { SectorsSection } from '@/components/home/SectorsSection';
import { ServicesSection } from '@/components/home/ServicesSection';
import { SolutionsSection } from '@/components/home/SolutionsSection';
import { TechnologiesSection } from '@/components/home/TechnologiesSection';
import { WhyTicketGoSection } from '@/components/home/WhyTicketGoSection';

export default function HomePage() {
  return (
    <main className="min-w-0 overflow-x-clip">
      <HeroSection />
      <CapabilitiesBar />
      <ServicesSection />
      <ArchitectureMap />
      <TechnologiesSection />
      <ProcessSection />
      <SectorsSection />
      <WhyTicketGoSection />
      <AiSolutionsSection />
      <SolutionsSection />
      <SecurePaymentModule />
      <FinalCtaSection />
      <ContactSection />
    </main>
  );
}
