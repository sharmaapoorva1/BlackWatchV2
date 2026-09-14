import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

// Page-level header. MUI owns the responsive stacking so actions never force
// a narrow page wider than its viewport.
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}) {
  return <header className="mb-6 flex min-w-0 flex-col justify-between gap-3 md:flex-row md:items-end md:gap-4">
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="overflow-wrap-anywhere font-display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>;
}
