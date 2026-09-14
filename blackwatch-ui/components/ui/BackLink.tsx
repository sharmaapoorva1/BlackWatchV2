import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <div className="mb-4">
      <Link href={href} className="inline-flex items-center gap-1.5 text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
        <ArrowLeft size={12} /> {label}
      </Link>
    </div>
  );
}
