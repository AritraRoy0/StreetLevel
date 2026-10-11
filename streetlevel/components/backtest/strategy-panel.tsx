"use client";

/**
 * The strategy controls.
 *
 * Every field here corresponds to one named property of the specification, so
 * what the reader sees is exactly what the engine was given. Costs and fill
 * timing are presented as prominently as the rule parameters, because they
 * change results at least as much and are the fields a demo is most tempted to
 * hide.
 *
 * Each control carries its own label. The execution choices used to be three
 * unlabelled button rows, and "Exit wins / Entry wins / Hold" means nothing
 * until it says it is the policy for a bar that signals both ways.
 */

import { useState, type ReactNode } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button, Eyebrow, Field, Panel, PanelHeader, Segmented, Select, ToggleChip } from "@/components/ui";
import { RULE_DEFINITIONS } from "@/lib/backtest";
import type { RuleKind, StrategySpec } from "@/lib/backtest";
import { cn } from "@/lib/utils";

const RULE_ORDER: RuleKind[] = [
  "buy_and_hold",
  "sma_cross",
  "ema_cross",
  "price_vs_sma",
  "macd_cross",
  "rsi_threshold",
  "bollinger_reversion",
  "donchian_breakout",
];

/**
 * A number input with its label above the value.
 *
 * Stacked rather than side by side because the panel is narrow: "Trailing
 * stop" beside a five-digit value wrapped onto two lines in a half-width cell.
 */
function NumberField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 flex-col gap-0.5 border border-hairline bg-surface px-2.5 py-1.5 transition-colors focus-within:border-ink hover:border-hairline-strong",
        className,
      )}
    >
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className="w-full min-w-0 bg-transparent font-mono text-[13px] font-semibold text-ink outline-none"
        />
        {suffix && <span className="shrink-0 text-[10px] text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="min-w-0 space-y-2.5 border-t border-hairline px-4 py-4 first:border-t-0">
      <Eyebrow>{title}</Eyebrow>
      {children}
      {note && <p className="text-[11px] leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

/** A labelled row for a segmented control, so the choice says what it chooses. */
function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[11px] text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function StrategyPanel({
  spec,
  symbols,
  symbol,
  multiSymbol,
  selectedSymbols,
  onSpecChange,
  onSymbolChange,
  onMultiSymbolChange,
  onToggleSymbol,
  onReset,
  className,
}: {
  spec: StrategySpec;
  symbols: string[];
  symbol: string;
  multiSymbol: boolean;
  selectedSymbols: string[];
  onSpecChange: (next: Partial<StrategySpec>) => void;
  onSymbolChange: (symbol: string) => void;
  onMultiSymbolChange: (enabled: boolean) => void;
  onToggleSymbol: (symbol: string) => void;
  onReset: () => void;
  className?: string;
}) {
  const definition = RULE_DEFINITIONS[spec.rule];
  /**
   * Below the `xl` breakpoint the panel stacks above the results, and at full
   * length it pushed every outcome some fourteen hundred pixels down a phone.
   * There it folds to a one-line summary of the specification with an edit
   * toggle; on wide screens it is always open as the sidebar. The fold is
   * done in CSS, so the server and the client render the same markup.
   */
  const [expanded, setExpanded] = useState(false);

  const paramSummary = definition.params.map((param) => spec.params[param.key] ?? param.default).join(" / ");
  const summary = [
    multiSymbol ? `${selectedSymbols.length} symbols` : symbol,
    paramSummary ? `${definition.label} ${paramSummary}` : definition.label,
    spec.timing === "next_open" ? "next open" : "next close",
    `${spec.costs.slippageBps + spec.costs.spreadBps / 2} bps a side`,
  ].join(" · ");

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title="Strategy"
        eyebrow="The full specification"
        actions={
          <>
            <Button variant="ghost" size="xs" onClick={onReset} title="Restore the rule, window, sizing, costs and exits to their defaults">
              <RotateCcw aria-hidden="true" className="h-3 w-3" />
              Reset
            </Button>
            <Button
              size="xs"
              className="xl:hidden"
              aria-expanded={expanded}
              aria-controls="strategy-fields"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Done" : "Edit"}
              <ChevronDown aria-hidden="true" className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </Button>
          </>
        }
      />

      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block w-full px-4 py-3 text-left font-mono text-[12px] leading-relaxed text-ink-soft transition-colors hover:bg-sunken xl:hidden"
        >
          {summary}
        </button>
      )}

      <div id="strategy-fields" className={cn(expanded ? "block" : "hidden", "xl:block")}>
        <Section
          title="Universe"
          note={
            multiSymbol
              ? "One rule across every selected name against a single cash account, so the legs compete for capital rather than each spending it."
              : undefined
          }
        >
          <Segmented
            size="sm"
            label="Universe"
            value={multiSymbol ? "multi" : "single"}
            onChange={(next) => onMultiSymbolChange(next === "multi")}
            options={[
              { value: "single", label: "One symbol" },
              { value: "multi", label: "Portfolio of symbols" },
            ]}
          />
          {multiSymbol ? (
            <div className="flex flex-wrap gap-1.5">
              {symbols.map((item) => (
                <ToggleChip key={item} active={selectedSymbols.includes(item)} onChange={() => onToggleSymbol(item)}>
                  {item}
                </ToggleChip>
              ))}
            </div>
          ) : (
            <Field label="Symbol" className="w-full">
              <Select
                ariaLabel="Backtest symbol"
                value={symbol}
                onChange={onSymbolChange}
                options={symbols.map((item) => ({ value: item, label: item }))}
              />
            </Field>
          )}
        </Section>

        <Section title="Rule" note={definition.description}>
          <Field label="Rule" className="w-full">
            <Select
              ariaLabel="Trading rule"
              value={spec.rule}
              onChange={(rule) => onSpecChange({ rule: rule as RuleKind, params: {} })}
              options={RULE_ORDER.map((rule) => ({ value: rule, label: RULE_DEFINITIONS[rule].label }))}
            />
          </Field>
          {definition.params.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {definition.params.map((param) => (
                <NumberField
                  key={param.key}
                  label={param.label}
                  value={spec.params[param.key] ?? param.default}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  onChange={(value) => onSpecChange({ params: { ...spec.params, [param.key]: value } })}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="Execution">
          <ChoiceRow label="Fill at">
            <Segmented
              size="sm"
              label="Fill timing"
              value={spec.timing}
              onChange={(timing) => onSpecChange({ timing })}
              options={[
                { value: "next_open", label: "Next open" },
                { value: "next_close", label: "Next close" },
              ]}
            />
          </ChoiceRow>
          <ChoiceRow label="Rebalance">
            <Segmented
              size="sm"
              label="Rebalance cadence"
              value={spec.rebalance}
              onChange={(rebalance) => onSpecChange({ rebalance })}
              options={[
                { value: "signal", label: "On signal" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
          </ChoiceRow>
          <ChoiceRow label="Both signals">
            <Segmented
              size="sm"
              label="Conflict policy, when one bar signals entry and exit"
              value={spec.conflict}
              onChange={(conflict) => onSpecChange({ conflict })}
              options={[
                { value: "exit_wins", label: "Exit wins" },
                { value: "entry_wins", label: "Entry wins" },
                { value: "hold", label: "Hold" },
              ]}
            />
          </ChoiceRow>
        </Section>

        <Section title="Sizing">
          <Field label="Method" className="w-full">
            <Select
              ariaLabel="Position sizing method"
              value={spec.sizing.kind}
              onChange={(kind) => onSpecChange({ sizing: { ...spec.sizing, kind } })}
              options={[
                { value: "all_in", label: "Fully invested" },
                { value: "fixed_fraction", label: "Fraction of equity" },
                { value: "fixed_shares", label: "Fixed shares" },
                { value: "volatility_target", label: "Volatility target" },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            {spec.sizing.kind !== "all_in" && (
              <NumberField
                label={
                  spec.sizing.kind === "fixed_shares"
                    ? "Shares"
                    : spec.sizing.kind === "volatility_target"
                      ? "Target vol"
                      : "Fraction"
                }
                value={spec.sizing.value}
                min={0}
                max={spec.sizing.kind === "fixed_shares" ? 100_000 : 5}
                step={spec.sizing.kind === "fixed_shares" ? 1 : 0.05}
                onChange={(value) => onSpecChange({ sizing: { ...spec.sizing, value } })}
              />
            )}
            <NumberField
              label="Capital"
              value={spec.initialCapital}
              min={1_000}
              max={100_000_000}
              step={1_000}
              suffix="USD"
              onChange={(initialCapital) => onSpecChange({ initialCapital })}
            />
          </div>
          <ToggleChip
            active={spec.sizing.wholeShares}
            onChange={(wholeShares) => onSpecChange({ sizing: { ...spec.sizing, wholeShares } })}
          >
            Whole shares only
          </ToggleChip>
        </Section>

        <Section
          title="Costs"
          note="Half the spread plus slippage is charged against the direction on both legs. The benchmark pays the same, so the comparison measures the rule rather than the fee schedule."
        >
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField
              label="Commission"
              value={spec.costs.commission}
              min={0}
              max={1_000}
              step={0.5}
              onChange={(commission) => onSpecChange({ costs: { ...spec.costs, commission } })}
            />
            <label className="flex min-w-0 flex-col gap-0.5 border border-hairline bg-surface px-2.5 py-1.5 transition-colors focus-within:border-ink hover:border-hairline-strong">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Charged</span>
              <Select
                ariaLabel="Commission basis"
                value={spec.costs.commissionKind}
                onChange={(commissionKind) => onSpecChange({ costs: { ...spec.costs, commissionKind } })}
                options={[
                  { value: "per_trade", label: "Per trade" },
                  { value: "per_share", label: "Per share" },
                  { value: "bps", label: "In bps" },
                ]}
                className="text-left text-[13px]"
              />
            </label>
            <NumberField
              label="Slippage"
              value={spec.costs.slippageBps}
              min={0}
              max={1_000}
              step={1}
              suffix="bps"
              onChange={(slippageBps) => onSpecChange({ costs: { ...spec.costs, slippageBps } })}
            />
            <NumberField
              label="Spread"
              value={spec.costs.spreadBps}
              min={0}
              max={1_000}
              step={1}
              suffix="bps"
              onChange={(spreadBps) => onSpecChange({ costs: { ...spec.costs, spreadBps } })}
            />
          </div>
        </Section>

        <Section
          title="Protective exits"
          note="Zero disables a level. With daily bars a stop touched inside a session is assumed to fill before a target touched in the same session, which errs against the strategy."
        >
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField
              label="Stop loss"
              value={Math.round(spec.exits.stopLossPct * 1000) / 10}
              min={0}
              max={90}
              step={0.5}
              suffix="%"
              onChange={(value) => onSpecChange({ exits: { ...spec.exits, stopLossPct: value / 100 } })}
            />
            <NumberField
              label="Take profit"
              value={Math.round(spec.exits.takeProfitPct * 1000) / 10}
              min={0}
              max={500}
              step={0.5}
              suffix="%"
              onChange={(value) => onSpecChange({ exits: { ...spec.exits, takeProfitPct: value / 100 } })}
            />
            <NumberField
              label="Trailing stop"
              value={Math.round(spec.exits.trailingStopPct * 1000) / 10}
              min={0}
              max={90}
              step={0.5}
              suffix="%"
              onChange={(value) => onSpecChange({ exits: { ...spec.exits, trailingStopPct: value / 100 } })}
            />
            <NumberField
              label="Max hold"
              value={spec.exits.maxHoldBars}
              min={0}
              max={500}
              step={1}
              suffix="bars"
              onChange={(maxHoldBars) => onSpecChange({ exits: { ...spec.exits, maxHoldBars } })}
            />
          </div>
        </Section>
      </div>
    </Panel>
  );
}
