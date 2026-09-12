import { PageShell, TopNav } from "@/components/shell";
import { Panel, Skeleton, SkeletonMetric } from "@/components/ui";

/**
 * The analytics skeleton.
 *
 * It mirrors the real layout closely enough that nothing jumps when the
 * content arrives: same header block, same eight-cell metric grid, same chart
 * height. A skeleton that does not match the page it stands in for causes a
 * second, worse layout shift than having no skeleton at all.
 */
export default function AnalyticsLoading() {
  return (
    <>
      <TopNav />
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-[1560px] px-4 py-3 sm:px-6 lg:px-10">
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <PageShell>
        <div className="space-y-10">
          <header className="border-b border-hairline-strong pb-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          </header>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
              <div className="space-y-2">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-8 w-64" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="border-b border-hairline lg:[&:not(:nth-child(4n+1))]:border-l">
                  <SkeletonMetric />
                </div>
              ))}
            </div>
          </section>

          <Panel>
            <div className="border-b border-hairline px-4 py-3">
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="p-4">
              <Skeleton className="h-[380px] w-full" />
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
