import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Link2, Check } from 'lucide-react';
import { isLegalPlaceholder } from '@/config/legal';
import { legalConfig, legalRoutes, warnLegalPlaceholders } from '@/config/legal';

/**
 * Layout reutilizável para as páginas legais/suporte.
 * O cabeçalho e o rodapé do site são fornecidos pelo Layout global,
 * portanto este componente cuida apenas da área de leitura.
 */
export default function LegalPageLayout({
  pageTitle,
  metaTitle,
  metaDescription,
  intro,
  version,
  lastUpdated,
  sections = [],
  currentRoute,
  children,
}) {
  useEffect(() => {
    warnLegalPlaceholders();
  }, []);

  useEffect(() => {
    if (metaTitle) {
      const previous = document.title;
      document.title = metaTitle;
      return () => {
        document.title = previous;
      };
    }
  }, [metaTitle]);

  useEffect(() => {
    if (!metaDescription) return;
    let tag = document.querySelector('meta[name="description"]');
    const created = !tag;
    const previous = tag?.getAttribute('content') ?? null;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', metaDescription);
    return () => {
      if (created) {
        tag?.remove();
      } else if (previous !== null) {
        tag?.setAttribute('content', previous);
      }
    };
  }, [metaDescription]);

  const crossLinks = [
    { label: 'Central de Ajuda', to: legalRoutes.ajuda },
    { label: 'Termos de Uso', to: legalRoutes.termos },
    { label: 'Privacidade', to: legalRoutes.privacidade },
  ];

  return (
    <div className="min-h-[60vh] bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {pageTitle}
          </h1>
          {intro && (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {intro}
            </p>
          )}
          {(version || lastUpdated) && (
            <p className="mt-4 text-sm text-muted-foreground">
              {version && <span>Versão {version}</span>}
              {version && lastUpdated && <span aria-hidden="true"> · </span>}
              {lastUpdated && <span>Última atualização: {lastUpdated}</span>}
            </p>
          )}
        </header>

        {sections.length > 0 && (
          <nav aria-label="Sumário" className="mt-8 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Nesta página</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <main className="mt-10 space-y-10">{children}</main>

        <section className="mt-14 border-t border-border pt-8">
          <h2 className="text-sm font-semibold text-foreground">Páginas relacionadas</h2>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {crossLinks.map((link) => (
              <li key={link.to}>
                {link.to === currentRoute ? (
                  <span className="text-sm text-muted-foreground">{link.label}</span>
                ) : (
                  <Link
                    to={link.to}
                    className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">
            {legalConfig.brandName}
          </p>
        </section>
      </div>
    </div>
  );
}

/** Bloco de seção reutilizável com âncora e título semântico. */
export function LegalSection({ id, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="text-xl sm:text-2xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
