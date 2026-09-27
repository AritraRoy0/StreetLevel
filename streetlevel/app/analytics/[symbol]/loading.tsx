import { PageShell } from "@/components/shell";
import { Panel, Skeleton, SkeletonMetric } from "@/components/ui";

/**
 * The analytics skeleton.
 *
 * It mirrors the real layout closely enough that nothing jumps when the
 * content arrives: same header block and symbol strip, same sticky control
 * bar, same eight-cell metric grid, same chart height. A skeleton that does not
 * match the page it stands in for causes a second, worse layout shift than
 * having no skeleton at all.
 */
export default function AnalyticsLoading() {
  return (
    <>
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto flex h-9 max-w-[1560px] items-center px-4 sm:px-6 lg:px-10">
          <Skeleton className="h-2.5 w-48" />
        </div>
      </div>
      <PageShell>
        <div aria-busy="true" aria-label="Loading analytics" className="space-y-8 sm:space-y-10">
          <header className="mb-5 space-y-5 sm:mb-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-3">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-80 max-w-full" />
              </div>
              <div className="space-y-2 sm:flex sm:flex-col sm:items-end">
                <Skeleton className="h-9 w-44" />
                <Skeleton className="h-3 w-56" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-11 w-full" />
          </header>

          <div className="-mx-4 border-y border-hairline px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <Skeleton className="ml-auto h-7 w-full max-w-[520px]" />
          </div>

          <section>
            <div className="mb-4 space-y-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonMetric key={index} />
              ))}
            </div>
          </section>

          <Panel>
            <div className="border-b border-hairline px-4 py-3">
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="border-b border-hairline px-4 py-3">
              <Skeleton className="h-6 w-full max-w-[640px]" />
            </div>
            <div className="p-3 sm:p-4">
              <Skeleton className="h-[480px] w-full" />
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            {[0, 1].map((index) => (
              <Panel key={index}>
                <div className="border-b border-hairline px-4 py-3">
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="space-y-4 p-4">
                  {Array.from({ length: 5 }).map((_, row) => (
                    <div key={row} className="flex items-center justify-between gap-4">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      </PageShell>
    </>
  );
}
