'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useContactModal } from '@/components/contact/ContactModalProvider';
import { acquireScrollLock } from '@/lib/scroll-lock';
import { BrandLogo } from './BrandLogo';

const navItems = [
  { href: '/#ana-sayfa', label: 'Ana Sayfa', sectionId: 'ana-sayfa', tone: 'sky' },
  { href: '/#cozumler', label: 'Çözümler', sectionId: 'cozumler', tone: 'teal' },
  { href: '/#teknolojiler', label: 'Teknolojiler', sectionId: 'teknolojiler', tone: 'indigo' },
  { href: '/#urunler', label: 'Ürünler', sectionId: 'urunler', tone: 'amber' },
  { href: '/payment', label: 'Ödeme', tone: 'emerald' },
  { href: '/download', label: 'Download', tone: 'slate' },
  { href: '/#iletisim', label: 'İletişim', sectionId: 'iletisim', opensContactModal: true, tone: 'rose' },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const { openContactModal, isOpen: contactOpen } = useContactModal();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('ana-sayfa');
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isHome = pathname === '/';

  const activeHref = useMemo(() => {
    if (!isHome) return pathname;
    return `/#${activeSection}`;
  }, [activeSection, isHome, pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isHome) return;
    const sections = ['ana-sayfa', 'cozumler', 'teknolojiler', 'urunler', 'iletisim']
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: '-124px 0px -50% 0px' }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [isHome]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const release = acquireScrollLock();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      release();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const isActive = (href: string) =>
    activeHref === href ||
    pathname === href ||
    (href === '/#cozumler' && pathname.startsWith('/solutions')) ||
    (href === '/#teknolojiler' && pathname.startsWith('/technologies')) ||
    (href === '/#urunler' && pathname.startsWith('/projects')) ||
    (href === '/payment' && pathname.startsWith('/payment')) ||
    (href === '/download' && pathname.startsWith('/download')) ||
    (href === '/#iletisim' && contactOpen);

  const renderNavItem = (item: (typeof navItems)[number], mobile = false) => {
    const active = isActive(item.href);
    const className = mobile
      ? 'nav-pill rounded-lg border border-transparent px-3.5 py-2.5 text-[1rem] font-semibold text-ink'
      : 'nav-pill whitespace-nowrap rounded-lg border border-transparent px-3 py-2.5 text-[0.9375rem] font-semibold leading-none tracking-normal text-ink xl:px-3.5';

    if ('opensContactModal' in item && item.opensContactModal) {
      return (
        <button
          key={item.label}
          type="button"
          data-active={active}
          data-tone={item.tone}
          aria-haspopup="dialog"
          aria-expanded={contactOpen}
          className={className}
          onClick={(event) => {
            if (mobile) setOpen(false);
            openContactModal(event.currentTarget);
          }}
        >
          {item.label}
        </button>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        data-active={active}
        data-tone={item.tone}
        className={className}
        onClick={() => {
          if (mobile) setOpen(false);
        }}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-line bg-surface/98 shadow-soft backdrop-blur-md'
          : 'border-b border-line/80 bg-surface/92 backdrop-blur-md'
      }`}
    >
      <div className="section-wrap relative flex h-[72px] items-center justify-between gap-3 sm:h-[80px] xl:h-[88px]">
        {/* Sol: Logo */}
        <BrandLogo />

        {/* Orta: Nav linkleri — absolute ile tam ortala */}
        <nav className="pointer-events-none absolute inset-x-0 hidden items-center justify-center gap-0.5 lg:flex">
          <div className="pointer-events-auto flex items-center gap-0.5">
            {navItems.map((item) => renderNavItem(item))}
          </div>
        </nav>

        {/* Sağ: CTA butonu */}
        <div className="hidden lg:flex lg:shrink-0">
          <Link
            href="/#iletisim"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
              boxShadow: '0 4px 14px rgba(14,165,233,0.4)',
            }}
          >
            Projenizi Konuşalım
          </Link>
        </div>
        <button
          type="button"
          ref={buttonRef}
          className="btn btn-ghost h-10 w-10 shrink-0 rounded-lg border-line p-0 text-ink lg:hidden"
          aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <div
        id="mobile-nav"
        className={`overflow-hidden border-t border-line bg-surface transition-all duration-300 lg:hidden ${
          open ? 'max-h-[min(80vh,42rem)] overflow-y-auto opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div ref={menuRef} className="section-wrap flex flex-col gap-1 py-3">
          {navItems.map((item) => renderNavItem(item, true))}
          <Link
            href="/#iletisim"
            className="btn btn-primary mt-2 text-center"
            onClick={() => setOpen(false)}
          >
            Projenizi Konuşalım
          </Link>
        </div>
      </div>
    </header>
  );
}
