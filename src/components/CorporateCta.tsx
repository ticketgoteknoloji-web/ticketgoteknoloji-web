import Link from 'next/link';

type CorporateCtaProps = {
  href?: string;
};

export function CorporateCta({ href = '/contact' }: CorporateCtaProps) {
  return (
    <section>
      <div className="section-wrap section-y">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-8 py-10 shadow-soft md:flex md:items-center md:justify-between md:px-12 md:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_240px_at_0%_0%,rgba(213,189,138,0.2),transparent_62%)]" />
          <div className="relative max-w-2xl">
            <h2 className="section-title">
              Bir sonraki dijital ürününüzü birlikte geliştirelim.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Yeni bir platform geliştirmek, mevcut sistemlerinizi modernize etmek veya süreçlerinizi otomatikleştirmek için
              bizimle iletişime geçin.
            </p>
          </div>
          <Link href={href} className="btn btn-primary relative mt-6 shrink-0 md:mt-0">
            Projenizi Konuşalım
          </Link>
        </div>
      </div>
    </section>
  );
}
