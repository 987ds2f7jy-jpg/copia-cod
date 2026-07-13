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
  effectiveDate,
  lastUpdated,
  contactChannel,
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
          {(version || effectiveDate || lastUpdated) && (
            <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {version && <div><dt className="inline font-medium text-foreground">Versão:</dt> <dd className="inline">{version}</dd></div>}
              {effectiveDate && <div><dt className="inline font-medium text-foreground">Vigência:</dt> <dd className="inline">{effectiveDate}</dd></div>}
              {lastUpdated && <div><dt className="inline font-medium text-foreground">Última atualização:</dt> <dd className="inline">{lastUpdated}</dd></div>}
            </dl>
          )}
          {contactChannel && (
            <p className="mt-2 text-sm text-muted-foreground">
              Dúvidas: <LegalEmail value={contactChannel} />
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

/** Botão que copia o link da âncora para a área de transferência. */
function AnchorCopyButton({ id }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#${id}`;
      navigator.clipboard?.writeText(url);
      window.history.replaceState(null, '', `#${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* silencioso — sem rede, sem alerta ao usuário */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copiar link desta seção"
      className="inline-flex items-center text-muted-foreground/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
    >
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
    </button>
  );
}

/** Bloco de seção reutilizável com âncora e título semântico (H2). */
export function LegalSection({ id, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 group">
      <h2
        id={`${id}-title`}
        className="flex items-center gap-2 text-xl sm:text-2xl font-semibold text-foreground"
      >
        <a href={`#${id}`} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          {title}
        </a>
        <AnchorCopyButton id={id} />
      </h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** Subseção com título H3. */
export function LegalSubSection({ id, title, children }) {
  return (
    <div id={id} className="scroll-mt-24 mt-6">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="mt-2 space-y-3 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * Renderiza um e-mail: como texto comum quando ainda é placeholder,
 * como link mailto quando for um valor real.
 */
export function LegalEmail({ value }) {
  if (!value || isLegalPlaceholder(value)) {
    return <span>{value}</span>;
  }
  return (
    <a
      href={`mailto:${value}`}
      className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
    >
      {value}
    </a>
  );
}

