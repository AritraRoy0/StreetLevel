export function DashboardFooter() {
  return (
    <footer className="mt-20 border-t border-black px-0 py-8">
      <div className="flex flex-col gap-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <span>StreetLevel / market intelligence</span>
        <div className="flex gap-5">
          <span>Data delayed for demonstration</span>
          <span>Build 0.1.0</span>
        </div>
      </div>
    </footer>
  );
}
