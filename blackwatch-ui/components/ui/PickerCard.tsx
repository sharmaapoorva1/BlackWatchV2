import Link from "next/link";

export function PickerCard({
  href,
  icon,
  title,
  blurb,
  badge,
  dashed = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
  badge?: string;
  dashed?: boolean;
}) {
  return (
    <Link href={href} className={`flex flex-col gap-2 border px-4 py-4 text-fg transition-colors hover:border-fg-muted hover:bg-canvas ${dashed ? "border-dashed bg-transparent" : "border-line bg-surface"}`}>
      <div className="flex items-center gap-2">
        <span className="text-muted">{icon}</span>
        <span className="text-sm">{title}</span>
        {badge && (
          <code className="ml-auto font-mono text-[11px] text-subtle">{badge}</code>
        )}
      </div>
      <span className="text-[11px] text-subtle">{blurb}</span>
    </Link>
  );
}
