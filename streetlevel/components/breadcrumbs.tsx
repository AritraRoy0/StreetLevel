/**
 * The trail above an editorial page's heading.
 *
 * The same list feeds the `BreadcrumbList` structured data, so what a search
 * result shows as the page's path is exactly what the reader sees here.
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/seo";
import { cn } from "@/lib/utils";

export function Breadcrumbs({ crumbs, className }: { crumbs: readonly Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-4", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="font-medium text-ink-soft">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link href={crumb.path} className="underline-offset-2 transition-colors hover:text-ink hover:underline">
                    {crumb.name}
                  </Link>
                  <ChevronRight aria-hidden="true" className="h-3 w-3 text-faint" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
