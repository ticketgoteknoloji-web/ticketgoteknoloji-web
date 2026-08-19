const scenarios = [
  {
    title: 'Kurumsal servis portalı',
    text: 'Teklif, operasyon ve destek adımlarının tek kayıt omurgasında yürüdüğü iç süreç senaryosu.',
    tags: ['Özel yazılım', 'İş akışı', 'Raporlama'],
  },
  {
    title: 'Talep yönlendirme katmanı',
    text: 'Gelen talebin sınıflandırılıp ilgili ekibe bağlandığı otomasyon ve entegrasyon senaryosu.',
    tags: ['Otomasyon', 'API', 'Destek'],
  },
  {
    title: 'Saha ve merkez koordinasyonu',
    text: 'Saha ekibi ile merkez yönetimin aynı operasyon kaydını paylaştığı mobil uyumlu senaryo.',
    tags: ['Mobil', 'Operasyon', 'Cloud'],
  },
] as const;

export function CaseStudiesSection() {
  return (
    <section className="section-wrap section-y">
      <h2 className="section-title">Örnek ürün senaryoları</h2>
      <p className="section-subtitle">
        Aşağıdaki örnekler tamamlanmış müşteri referansı değildir. Farklı iş ihtiyaçları için tasarlayabildiğimiz ürün
        yaklaşımlarını temsil eder.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((item) => (
          <article key={item.title} className="site-card p-6">
            <h3 className="text-[15px] font-semibold text-ink">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted">{item.text}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
