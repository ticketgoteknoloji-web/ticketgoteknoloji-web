'use client';

import { FileWarning, KeyRound, Lock, ScrollText, Server, ShieldCheck, Shuffle, UserCog, WalletCards, type LucideIcon } from 'lucide-react';
import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { overlayFeature } from '@/data/featureCatalog';
import type { SolutionDetail } from '@/data/solutions';

const topics: Array<{
  id: string;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  features: string[];
}> = [
  {
    id: 'security-auth',
    title: 'Authentication',
    subtitle: 'Kullanıcının kimliğini doğrulayan giriş ve oturum katmanı.',
    Icon: KeyRound,
    features: ['Giriş', 'Oturum', 'Parola politikası', 'Çıkış', 'Oturum süresi'],
  },
  {
    id: 'security-authz',
    title: 'Authorization',
    subtitle: 'İşlemin yalnızca yetkili rol tarafından yapılmasını sağlayan erişim kontrolü.',
    Icon: UserCog,
    features: ['Yetki kontrolü', 'Kaynak erişimi', 'İşlem izni', 'Reddetme kaydı'],
  },
  {
    id: 'security-rbac',
    title: 'Role Based Access',
    subtitle: 'Ekran ve kayıt yetkisinin role göre ayrılması.',
    Icon: ShieldCheck,
    features: ['Rol tanımı', 'Ekran yetkisi', 'Kayıt yetkisi', 'Yönetici ayrımı'],
  },
  {
    id: 'security-api',
    title: 'API Security',
    subtitle: 'Servis çağrılarının kimlik, yetki ve kayıt ile korunması.',
    Icon: Lock,
    features: ['Kimlik doğrulama', 'Rate limiting', 'Girdi doğrulama', 'API log'],
  },
  {
    id: 'security-transfer',
    title: 'Secure Data Transfer',
    subtitle: 'Verinin iletim sırasında korunmasına yönelik iletişim yaklaşımı.',
    Icon: Shuffle,
    features: ['Şifreli iletim', 'Ortam ayrımı', 'Hassas alan maskeleme'],
  },
  {
    id: 'security-logging',
    title: 'Logging',
    subtitle: 'Kritik işlemlerin sonradan incelenebilir kayıt altına alınması.',
    Icon: ScrollText,
    features: ['İşlem logu', 'Hata kaydı', 'Erişim kaydı'],
  },
  {
    id: 'security-audit',
    title: 'Audit Trail',
    subtitle: 'Kim, ne zaman, hangi kaydı değiştirdi sorusuna yanıt veren iz.',
    Icon: FileWarning,
    features: ['Değişiklik izi', 'Aktör kaydı', 'Zaman damgası'],
  },
  {
    id: 'security-error',
    title: 'Error Management',
    subtitle: 'Hataların görünür, izlenebilir ve yönetilebilir şekilde ele alınması.',
    Icon: Server,
    features: ['Hata izleme', 'Uyarı', 'Kayıt'],
  },
  {
    id: 'security-backup',
    title: 'Backup yaklaşımı',
    subtitle: 'Verinin yedeklenmesi ve kurtarma senaryosunun ürün tasarımına dahil edilmesi.',
    Icon: WalletCards,
    features: ['Yedekleme', 'Kurtarma hazırlığı', 'Ortam kopyası'],
  },
  {
    id: 'security-env',
    title: 'Environment Security',
    subtitle: 'Geliştirme, test ve canlı ortamların birbirinden ayrı tutulması.',
    Icon: ShieldCheck,
    features: ['Ortam ayrımı', 'Sır yönetimi', 'Yayın kontrolü'],
  },
];

const items = topics
  .map((topic) =>
    overlayFeature('security', {
      id: topic.id,
      title: topic.title,
      modalTitle: topic.title,
      subtitle: topic.subtitle,
      description: `${topic.subtitle} Bu başlık, security-first mimarinin bir parçasıdır; doğrulanmamış sertifika iddiası taşımaz.`,
      Icon: topic.Icon,
      hoverHints: topic.features.slice(0, 3),
      features: topic.features,
      contactType: topic.title,
      ctaMessage: `${topic.title} yaklaşımı hakkında bilgi almak istiyorum.`,
    })
  )
  .filter((item): item is SolutionDetail => Boolean(item));

export function SecuritySection() {
  return (
    <section className="section-wrap section-y">
      <h2 className="section-title">Güvenlik tasarımın bir parçasıdır</h2>
      <p className="section-subtitle">
        Güvenliği sonradan eklenen bir katman olarak değil; kimlik, yetki, kayıt ve ortam ayrımıyla ürün mimarisinin parçası
        olarak ele alırız. Aşağıdaki başlıklar yaklaşımı anlatır; doğrulanmamış sertifika iddiası taşımaz.
      </p>
      <FeatureCardGrid items={items} className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" />
    </section>
  );
}
