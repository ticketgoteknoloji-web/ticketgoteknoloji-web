'use client';

import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BRAND_INFO_EMAIL, CONTACT_ENDPOINT } from '@/lib/site';

type FormDataState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  projectType: string;
  message: string;
};

export function ContactForm() {
  const [form, setForm] = useState<FormDataState>({
    name: '',
    email: '',
    phone: '',
    company: '',
    projectType: '',
    message: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormDataState, string>>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'idle' | 'error' | 'success' | 'info'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const projectTypeRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const fieldRefs: Record<keyof FormDataState, RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
    name: nameRef,
    email: emailRef,
    phone: phoneRef,
    company: companyRef,
    projectType: projectTypeRef,
    message: messageRef,
  };
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_CONTACT_API_URL?.trim(), []);

  useEffect(() => {
    const applyNeed = (value?: string | { type: string; message?: string }) => {
      if (!value) {
        const params = new URLSearchParams(window.location.search);
        const need = params.get('need');
        const message = params.get('message');
        if (need || message) {
          setForm((prev) => ({
            ...prev,
            projectType: need || prev.projectType,
            message: prev.message.trim() ? prev.message : message ?? prev.message,
          }));
        }
        return;
      }
      if (typeof value === 'string') {
        setForm((prev) => ({ ...prev, projectType: value }));
        return;
      }
      setForm((prev) => ({
        ...prev,
        projectType: value.type,
        message: prev.message.trim() ? prev.message : value.message ?? prev.message,
      }));
    };
    applyNeed();
    const onCustom = (event: Event) => {
      applyNeed((event as CustomEvent<string | { type: string; message?: string }>).detail);
    };
    window.addEventListener('ticketgo:set-project-type', onCustom);
    return () => window.removeEventListener('ticketgo:set-project-type', onCustom);
  }, []);

  const setField = <K extends keyof FormDataState>(key: K, value: FormDataState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormDataState, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Ad Soyad alanı zorunludur.';
    if (!form.email.trim()) nextErrors.email = 'E-posta alanı zorunludur.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Lütfen geçerli bir e-posta adresi girin.';
    }
    if (form.phone.trim() && !/^[+0-9()\-\s]{10,20}$/.test(form.phone)) {
      nextErrors.phone = 'Telefon numarası geçersiz. Örnek: +90 5xx xxx xx xx';
    }
    if (!form.company.trim()) nextErrors.company = 'Şirket alanı zorunludur.';
    if (!form.projectType.trim()) nextErrors.projectType = 'Proje / İhtiyaç Türü alanı zorunludur.';
    if (!form.message.trim()) nextErrors.message = 'Mesaj alanı zorunludur.';
    if (form.message.trim().length > 0 && form.message.trim().length < 12) {
      nextErrors.message = 'Mesaj en az 12 karakter olmalıdır.';
    }
    return nextErrors;
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setStatusMessage('');
    setStatusType('idle');

    const nextErrors = validate();
    setErrors(nextErrors);
    const firstErrorField = Object.keys(nextErrors)[0] as keyof FormDataState | undefined;
    if (firstErrorField) {
      fieldRefs[firstErrorField].current?.focus();
      return;
    }

    if (!endpoint) {
      setStatusType('info');
      setStatusMessage(
        `Form gönderim altyapısı henüz yapılandırılmadı. Lütfen ${BRAND_INFO_EMAIL} adresi üzerinden iletişime geçin.`
      );
      return;
    }

    void submitToEndpoint();
  };

  const submitToEndpoint = async () => {
    setSubmitting(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(endpoint as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          company: form.company.trim(),
          projectType: form.projectType.trim(),
          message: form.message.trim(),
          source: CONTACT_ENDPOINT,
        }),
      });
      if (!response.ok) {
        throw new Error('request-failed');
      }
      setStatusType('success');
      setStatusMessage('Mesajınız başarıyla alındı. En kısa sürede sizinle iletişime geçeceğiz.');
      setForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        projectType: '',
        message: '',
      });
      setErrors({});
    } catch (error) {
      setStatusType('error');
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatusMessage('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else {
        setStatusMessage('Gönderim sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="surface-card min-w-0 space-y-5 p-7" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          inputRef={nameRef}
          label="Ad Soyad"
          name="name"
          value={form.name}
          onChange={(value) => setField('name', value)}
          error={errors.name}
          required
          autoComplete="name"
        />
        <Input
          inputRef={emailRef}
          label="E-posta"
          name="email"
          type="email"
          value={form.email}
          onChange={(value) => setField('email', value)}
          error={errors.email}
          required
          autoComplete="email"
        />
        <Input
          inputRef={phoneRef}
          label="Telefon"
          name="phone"
          value={form.phone}
          onChange={(value) => setField('phone', value)}
          error={errors.phone}
          autoComplete="tel"
        />
        <Input
          inputRef={companyRef}
          label="Şirket"
          name="company"
          value={form.company}
          onChange={(value) => setField('company', value)}
          error={errors.company}
          required
          autoComplete="organization"
        />
      </div>
      <Input
        inputRef={projectTypeRef}
        label="Proje / İhtiyaç Türü"
        name="projectType"
        value={form.projectType}
        onChange={(value) => setField('projectType', value)}
        error={errors.projectType}
        required
        autoComplete="off"
      />
      <label className="block text-sm font-medium text-ink" htmlFor="message">
        Mesaj
        <span className="text-red-600"> *</span>
      </label>
      <textarea
        ref={messageRef}
        id="message"
        name="message"
        value={form.message}
        required
        onChange={(event) => setField('message', event.target.value)}
        aria-invalid={Boolean(errors.message)}
        aria-required
        aria-describedby={errors.message ? 'message-error' : undefined}
        className="field-input min-h-32"
      />
      {errors.message ? (
        <p id="message-error" className="text-sm text-red-600">
          {errors.message}
        </p>
      ) : null}

      <p className="text-sm leading-6 text-muted">
        Kişisel verilerinizin işlenmesine ilişkin detayları{' '}
        <Link href="/kvkk" className="font-semibold text-brand-600 underline">
          KVKK Aydınlatma Metni
        </Link>{' '}
        ve{' '}
        <Link href="/privacy" className="font-semibold text-brand-600 underline">
          Gizlilik Politikası
        </Link>{' '}
        üzerinden inceleyebilirsiniz.
      </p>

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="btn btn-primary rounded-full px-6 py-3"
      >
        {submitting ? 'Gönderiliyor...' : 'Gönder'}
      </button>

      {statusType === 'info' ? (
        <p className="text-sm text-muted">
          Form gönderim altyapısı henüz yapılandırılmadı. Lütfen{' '}
          <a href={`mailto:${BRAND_INFO_EMAIL}`} className="email-link inline font-semibold text-brand-600">
            {BRAND_INFO_EMAIL}
          </a>{' '}
          adresi üzerinden iletişime geçin.
        </p>
      ) : statusMessage ? (
        <p className={`text-sm ${statusType === 'error' ? 'field-error' : statusType === 'success' ? 'field-success' : 'text-muted'}`}>
          {statusMessage}
        </p>
      ) : null}
    </form>
  );
}

type InputProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
};

const Input = ({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  required = false,
  autoComplete,
  inputRef,
}: InputProps) => (
  <label className="block text-sm font-medium text-ink" htmlFor={name}>
    {label}
    {required ? <span className="text-red-600"> *</span> : null}
    <input
      ref={inputRef}
      id={name}
      type={type}
      name={name}
      value={value}
      required={required}
      autoComplete={autoComplete}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={Boolean(error)}
      aria-required={required}
      aria-describedby={error ? `${name}-error` : undefined}
      className="field-input mt-2"
    />
    {error ? (
      <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
        {error}
      </p>
    ) : null}
  </label>
);
