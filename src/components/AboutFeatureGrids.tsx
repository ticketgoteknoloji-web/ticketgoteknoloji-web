'use client';

import {
  ShieldCheck,
  Layers,
  GitMerge,
  Database,
  BrainCircuit,
  RefreshCw,
  Search,
  PenTool,
  Cpu,
  Code2,
  Network,
  TestTube2,
  Rocket,
  TrendingUp,
  Cloud,
  Smartphone,
  CreditCard,
  Workflow,
  Globe,
  Bot,
} from 'lucide-react';
import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { overlayFeature } from '@/data/featureCatalog';
import type { SolutionDetail } from '@/data/solutions';
import type { LucideIcon } from 'lucide-react';

/* ── What We Develop grid ─────────────────────────────────────────────────── */

const whatWeDo = [
  overlayFeature('software', {
    title: 'Kurumsal Yazılım',
    subtitle: 'İşletmelerin operasyonel ihtiyaçlarına göre geliştirilen ölçeklenebilir ve güvenli kurumsal yazılım sistemleri.',
    cardAccent: 'ca-saas',
  }),
  overlayFeature('crm', {
    title: 'CRM Sistemleri',
    subtitle: 'Müşteri, satış, teklif, iletişim ve operasyon süreçlerinin merkezi olarak yönetilebildiği CRM platformları.',
    cardAccent: 'ca-crm',
  }),
  overlayFeature('frontend', {
    title: 'Web Platformları',
    subtitle: 'Modern, hızlı, güvenli ve ölçeklenebilir web uygulamaları ve dijital servisler.',
    cardAccent: 'ca-saas',
  }),
  overlayFeature('arch-mobile', {
    title: 'Mobil Uygulamalar',
    subtitle: 'iOS ve Android ekosistemleri için kullanıcı odaklı mobil uygulama çözümleri.',
    cardAccent: 'ca-mobile',
  }),
  overlayFeature('api', {
    title: 'API & Entegrasyon',
    subtitle: 'Farklı sistemlerin güvenli ve kontrollü biçimde haberleşmesini sağlayan API ve entegrasyon altyapıları.',
    cardAccent: 'ca-api',
  }),
  overlayFeature('ai', {
    title: 'Yapay Zekâ',
    subtitle: 'İş süreçlerine entegre edilebilen yapay zekâ destekli otomasyon, analiz ve akıllı servis çözümleri.',
    cardAccent: 'ca-ai',
  }),
  overlayFeature('analytics', {
    title: 'Veri & Analitik',
    subtitle: 'Operasyonel verilerin ölçülebilir bilgiye dönüştürülmesini sağlayan dashboard, raporlama ve analitik sistemleri.',
    cardAccent: 'ca-analytics',
  }),
  overlayFeature('cloud', {
    title: 'Bulut & Altyapı',
    subtitle: 'Yüksek erişilebilirlik ve ölçeklenebilirlik hedefiyle tasarlanan modern sunucu ve bulut altyapıları.',
    cardAccent: 'ca-cloud',
  }),
  overlayFeature('automation', {
    title: 'Otomasyon',
    subtitle: 'Tekrarlayan operasyonların azaltılmasını ve iş süreçlerinin hızlandırılmasını sağlayan dijital otomasyon sistemleri.',
    cardAccent: 'ca-automation',
  }),
  overlayFeature('security', {
    title: 'Ödeme Teknolojileri',
    subtitle: 'Güvenli ödeme akışlarının ve ödeme servislerinin dijital platformlarla entegre edilmesine yönelik teknoloji çözümleri.',
    cardAccent: 'ca-payment',
  }),
].filter((item): item is SolutionDetail => Boolean(item));

export function AboutWhatWeDo() {
  return (
    <FeatureCardGrid
      items={whatWeDo}
      className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
    />
  );
}

/* ── Technology Principles ────────────────────────────────────────────────── */

type PrincipleItem = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

const principles: PrincipleItem[] = [
  {
    Icon: ShieldCheck,
    title: 'Security by Design',
    description: 'Güvenliği sistem mimarisinin başlangıç noktasından itibaren ele alıyoruz.',
  },
  {
    Icon: Layers,
    title: 'Scalable Architecture',
    description: 'Geliştirilen sistemlerin artan kullanıcı ve işlem hacmine uyum sağlayabilmesini hedefliyoruz.',
  },
  {
    Icon: GitMerge,
    title: 'API-First',
    description: 'Sistemlerin farklı platform ve servislerle entegre çalışabilmesini sağlayan API odaklı mimariler geliştiriyoruz.',
  },
  {
    Icon: Database,
    title: 'Data-Driven',
    description: 'Operasyonel verileri ölçülebilir ve karar destekleyici bilgiye dönüştürüyoruz.',
  },
  {
    Icon: BrainCircuit,
    title: 'AI-Ready',
    description: 'Yeni nesil yapay zekâ servislerinin mevcut sistemlere entegre edilebilmesine uygun altyapılar tasarlıyoruz.',
  },
  {
    Icon: RefreshCw,
    title: 'Continuous Development',
    description: 'Teknoloji ürünlerini tek seferlik projeler yerine sürekli gelişen dijital sistemler olarak ele alıyoruz.',
  },
];

export function AboutTechPrinciples() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {principles.map((p) => (
        <div
          key={p.title}
          className="surface-card flex flex-col gap-3 p-6 transition-shadow hover:shadow-md"
        >
          <p.Icon size={22} className="text-brand-600" aria-hidden />
          <h3 className="font-semibold text-ink">{p.title}</h3>
          <p className="text-sm leading-6 text-muted">{p.description}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Process Steps ────────────────────────────────────────────────────────── */

type ProcessStep = {
  num: string;
  Icon: LucideIcon;
  title: string;
  description: string;
};

const processStepsList: ProcessStep[] = [
  {
    num: '01',
    Icon: Search,
    title: 'Keşif',
    description: 'İş modelini, mevcut sistemleri, hedefleri ve teknoloji ihtiyaçlarını analiz ediyoruz.',
  },
  {
    num: '02',
    Icon: TrendingUp,
    title: 'Analiz',
    description: 'İş gereksinimlerini, kullanıcı ihtiyaçlarını ve teknik gereksinimleri belirliyoruz.',
  },
  {
    num: '03',
    Icon: PenTool,
    title: 'Ürün & UX Tasarımı',
    description: 'Kullanıcı deneyimini ve ürün akışlarını tasarlıyoruz.',
  },
  {
    num: '04',
    Icon: Cpu,
    title: 'Teknik Mimari',
    description: 'Ölçeklenebilir, güvenli ve sürdürülebilir sistem mimarisini oluşturuyoruz.',
  },
  {
    num: '05',
    Icon: Code2,
    title: 'Geliştirme',
    description: 'Modern yazılım teknolojileriyle ürünü geliştiriyoruz.',
  },
  {
    num: '06',
    Icon: Network,
    title: 'Entegrasyon',
    description: 'API, ödeme, CRM ve üçüncü taraf servis entegrasyonlarını gerçekleştiriyoruz.',
  },
  {
    num: '07',
    Icon: TestTube2,
    title: 'Test & Kalite',
    description: 'Fonksiyon, performans, güvenlik ve kullanıcı deneyimi testlerini gerçekleştiriyoruz.',
  },
  {
    num: '08',
    Icon: Rocket,
    title: 'Yayına Alma',
    description: 'Ürünü kontrollü şekilde production ortamına taşıyoruz.',
  },
  {
    num: '09',
    Icon: RefreshCw,
    title: 'Sürekli Gelişim',
    description: 'Bakım, destek, izleme ve yeni özellik geliştirme süreçlerini sürdürüyoruz.',
  },
];

export function AboutProcess() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3">
      {processStepsList.map((step) => (
        <div
          key={step.num}
          className="surface-card flex flex-col gap-3 p-6 transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tabular-nums text-brand-500 opacity-70">{step.num}</span>
            <step.Icon size={18} className="text-brand-600" aria-hidden />
          </div>
          <h3 className="font-semibold text-ink">{step.title}</h3>
          <p className="text-sm leading-6 text-muted">{step.description}</p>
        </div>
      ))}
    </div>
  );
}
