"use client";

/**
 * A table row that opens a page when any part of it is clicked.
 *
 * Only the symbol cell used to be a link, so a click on the price or the return
 * beside it did nothing, which is not what a row that highlights on hover
 * promises. The row now navigates, while a real `<Link>` stays inside it for
 * keyboard users, middle-click and "open in new tab". Clicks that land on that
 * link, or on any other control in the row, are left to it.
 */

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LinkRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  const onClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("a, button, input, select, label")) return;
    // Let the browser keep text selection working inside the row.
    if (window.getSelection()?.toString()) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href);
  };

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => router.prefetch(href)}
      className={cn("group/row cursor-pointer transition-colors hover:bg-sunken", className)}
    >
      {children}
    </tr>
  );
}
