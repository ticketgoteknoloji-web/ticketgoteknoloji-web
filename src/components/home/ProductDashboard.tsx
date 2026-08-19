export function ProductDashboard() {

  return (

    <div className="hero-float relative min-w-0 overflow-hidden">

      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">

        <div className="mb-4">

          <p className="text-sm font-semibold text-ink">Dijital Ürün Kompozisyonu</p>

          <p className="mt-0.5 text-[11px] text-muted">Modüler dijital ürün mimarisi</p>

        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

          {[

            { label: 'CRM', value: 'Modül' },

            { label: 'Operasyon', value: 'Akış' },

            { label: 'Analytics', value: 'KPI' },

            { label: 'API', value: 'Gateway' },

            { label: 'AI Services', value: 'Katman' },

          ].map((item) => (

            <div key={item.label} className="rounded-xl border border-line bg-canvas px-3 py-3">

              <p className="text-[11px] text-muted">{item.value}</p>

              <p className="mt-1 text-sm font-semibold text-ink">{item.label}</p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-100">

                <span className="metric-fill block h-full w-3/4 rounded-full bg-brand-500" />

              </div>

            </div>

          ))}

        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-canvas">

          <table className="min-w-full text-left text-xs text-muted">

            <thead className="text-muted/80">

              <tr>

                <th className="px-3 py-2 font-medium text-ink">Modül</th>

                <th className="px-3 py-2 font-medium text-ink">Katman</th>

                <th className="px-3 py-2 font-medium text-ink">Durum</th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-line">

                <td className="px-3 py-2 text-ink">Müşteri kaydı</td>

                <td className="px-3 py-2">CRM</td>

                <td className="px-3 py-2 font-medium text-brand-600">Aktif</td>

              </tr>

              <tr className="border-t border-line">

                <td className="px-3 py-2 text-ink">Onay kuyruğu</td>

                <td className="px-3 py-2">Operasyon</td>

                <td className="px-3 py-2 font-medium text-brand-600">Aktif</td>

              </tr>

              <tr className="border-t border-line">

                <td className="px-3 py-2 text-ink">KPI paneli</td>

                <td className="px-3 py-2">Analytics</td>

                <td className="px-3 py-2 font-medium text-brand-600">Aktif</td>

              </tr>

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );

}

