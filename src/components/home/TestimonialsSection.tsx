const principles = [
  {
    title: 'Önce iş süreci',
    text: 'Ekranı çizmeden önce kaydın nerede oluştuğunu, kimin onayladığını ve verinin nereye gittiğini netleştiririz.',
  },
  {
    title: 'Ölçülebilir teslim',
    text: 'Kapsamı şişirmeden; görünür adımlar, test ve yayın ile ilerleriz.',
  },
  {
    title: 'Sürdürülebilir kod',
    text: 'Yalnızca ilk yayını değil, sonraki değişikliği de taşıyacak bir yapı bırakmayı hedefleriz.',
  },
] as const;

export function TestimonialsSection() {
  return (
    <section className="section-wrap section-y">
      <h2 className="section-title">Çalışma ilkelerimiz</h2>
      <p className="section-subtitle">
        Müşteri yorumu uydurmadan, projelerde tuttuğumuz çalışma disiplinini özetliyoruz.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {principles.map((item) => (
          <article key={item.title} className="site-card p-6">
            <h3 className="text-base font-semibold text-ink">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
