interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="text-brand-700 text-sm font-semibold">{eyebrow}</p>}
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      {description && <p className="text-ink-muted mt-1 text-[0.9375rem]">{description}</p>}
    </header>
  );
}
