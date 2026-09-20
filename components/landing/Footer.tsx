'use client';

import Link from 'next/link';
import { ShieldCheck, Mail, ArrowRight, MessageSquare, Link as LinkIcon, GitBranch } from 'lucide-react';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const footerSections: FooterSection[] = [
  {
    title: 'Producto',
    links: [
      { label: 'Características', href: '#features' },
      { label: 'Precios', href: '#pricing' },
      { label: 'Integraciones', href: '#integrations' },
      { label: 'API & Docs', href: '/docs' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Roadmap', href: '/roadmap' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre Nosotros', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Carreras', href: '/careers' },
      { label: 'Prensa', href: '/press' },
      { label: 'Contacto', href: '/contact' },
      { label: 'Socios', href: '/partners' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { label: 'Centro de Ayuda', href: '/help' },
      { label: 'Comunidad', href: '/community' },
      { label: 'Webinars', href: '/webinars' },
      { label: 'Casos de Estudio', href: '/case-studies' },
      { label: 'Plantillas', href: '/templates' },
      { label: 'Estado del Sistema', href: '/status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacidad', href: '/privacy' },
      { label: 'Términos de Servicio', href: '/terms' },
      { label: 'Política de Cookies', href: '/cookies' },
      { label: 'DPA / RGPD', href: '/dpa' },
      { label: 'Seguridad', href: '/security' },
      { label: 'SLA', href: '/sla' },
    ],
  },
];

const socialLinks = [
  { icon: MessageSquare, label: 'Twitter', href: 'https://twitter.com/apphr' },
  { icon: GitBranch, label: 'GitHub', href: 'https://github.com/apphr' },
  { icon: LinkIcon, label: 'LinkedIn', href: 'https://linkedin.com/company/apphr' },
  { icon: Mail, label: 'Email', href: 'mailto:hola@apphr.io' },
];

export function Footer() {
  return (
    <footer className="bg-slate-50 dark:bg-[#0b0f19] border-t border-slate-200 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-6" aria-label="AppHR - Inicio">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/25">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                  AppHR
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Hotel Management</span>
              </div>
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              La plataforma de gestión hotelera en tiempo real que sincroniza recepción, limpieza y gerencia.
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation Columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                {section.title}
              </h4>
              <nav aria-label={`${section.title} links`}>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 group"
                      >
                        {link.label}
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-0 group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">AppHR</span>
              <span>— © 2026 AppHR Technologies. Todos los derechos reservados.</span>
            </div>

            {/* Compliance badges */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                SOC2 Type II
              </span>
              <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                ISO 27001
              </span>
              <span className="px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                GDPR Compliant
              </span>
              <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                CCPA Ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}