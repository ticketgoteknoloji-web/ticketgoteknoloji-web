import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="section-wrap flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Sayfa bulunamadı</h1>
      <p className="mt-4 max-w-xl text-sm text-muted">
        Aradığınız içerik taşınmış, silinmiş veya geçici olarak kullanılamıyor olabilir.
      </p>
      <Link
        href="/"
        className="btn btn-primary mt-8 rounded-full"
      >
        Ana Sayfaya Dön
      </Link>
    </main>
  );
}
