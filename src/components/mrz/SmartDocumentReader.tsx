'use client';

import { useState } from 'react';
import { MrzVerifyScreen } from '@/components/mrz/MrzVerifyScreen';
import { VehicleRegistrationScreen } from '@/components/mrz/VehicleRegistrationScreen';
import type { OnDocumentConfirmed } from '@/lib/document-reader/types';

/**
 * TicketGo Akıllı Belge Okuyucu — composes the existing, unmodified
 * MrzVerifyScreen (passport + T.C. kimlik, both flows already handled
 * internally by that component) with the new VehicleRegistrationScreen.
 *
 * This component does NOT re-implement or alter passport/kimlik behavior —
 * it only decides which existing screen to mount.
 */

type DocumentChoice = 'passport_or_id' | 'vehicle_registration' | null;

type SmartDocumentReaderProps = {
  onDocumentConfirmed?: OnDocumentConfirmed;
};

export function SmartDocumentReader({ onDocumentConfirmed }: SmartDocumentReaderProps) {
  const [choice, setChoice] = useState<DocumentChoice>(null);

  // MrzVerifyScreen renders its own complete "mrz-app" header/layout — mount
  // it standalone (not nested inside this component's header) to avoid a
  // duplicated TicketGo header. This is what "compose, don't rewrite" means
  // here: SmartDocumentReader decides WHICH existing screen to show, and for
  // passport/kimlik it changes nothing about how that screen renders itself.
  if (choice === 'passport_or_id') {
    return (
      <div>
        <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => setChoice(null)}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            ← Belge türünü değiştir
          </button>
        </div>
        <MrzVerifyScreen />
      </div>
    );
  }

  return (
    <div className="mrz-app min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center px-4 py-4 sm:px-6">
          <div className="inline-flex flex-col items-start" aria-label="TicketGo Teknoloji A.Ş.">
            <span className="font-sans text-[1.625rem] font-bold leading-none tracking-tight sm:text-[1.875rem]">
              <span className="text-[#1e3a8a]">ticket</span>
              <span className="text-[#0ea5e9]">Go</span>
            </span>
            <span className="mt-0.5 font-sans text-[0.6875rem] font-medium leading-none tracking-[0.1em] text-[#1e3a8a]/75">
              AKILLI BELGE OKUYUCU
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        {choice === null ? (
          <>
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[2rem]">
              TicketGo Akıllı Belge Okuyucu
            </h1>
            <p className="mt-3 text-base text-slate-600">Okutmak istediğiniz belge türünü seçin.</p>

            <div className="mt-8 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setChoice('passport_or_id')}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#1d4ed8]/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
              >
                <span>
                  <span className="block text-base font-semibold text-slate-900">Pasaport / T.C. Kimlik</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">MRZ okuma ve doğrulama</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setChoice('vehicle_registration')}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#1d4ed8]/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
              >
                <span>
                  <span className="block text-base font-semibold text-slate-900">Araç Ruhsatı</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">Plaka, marka, model, VIN ve diğer bilgiler</span>
                </span>
              </button>
            </div>
          </>
        ) : null}

        {choice === 'vehicle_registration' ? (
          <VehicleRegistrationScreen onDocumentConfirmed={onDocumentConfirmed} onBack={() => setChoice(null)} />
        ) : null}
      </main>
    </div>
  );
}
