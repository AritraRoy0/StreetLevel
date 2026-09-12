"use client";

/**
 * The strategy controls.
 *
 * Every field here corresponds to one named property of the specification, so
 * what the reader sees is exactly what the engine was given. Costs and fill
 * timing are presented as prominently as the rule parameters, because they
 * change results at least as much and are the fields a demo is most tempted to
 * hide.
 */

import { Eyebrow, Field, Panel, PanelHeader, Segmented, Select, ToggleChip } from "@/components/ui";
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
    <label className={cn("flex items-center justify-between gap-2 border border-hairline bg-surface px-2.5 py-1.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className="w-16 bg-transparent text-right font-mono text-[12px] font-semibold text-ink outline-none"
        />
        {suffix && <span className="text-[10px] text-faint">{suffix}</span>}
      </span>
    </label>
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
  className?: string;
}) {
  const definition = RULE_DEFINITIONS[spec.rule];

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader title="Strategy" eyebrow="Every field is part of the specification" />

      <div className="space-y-5 p-4">
        {/* Universe ------------------------------------------------------- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Universe</Eyebrow>
            <ToggleChip active={multiSymbol} onChange={onMultiSymbolChange}>
              Multi-symbol
            </ToggleChip>
          </div>
          {multiSymbol ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {symbols.map((item) => (
                  <ToggleChip key={item} active={selectedSymbols.includes(item)} onChange={() => onToggleSymbol(item)}>
                    {item}
                  </ToggleChip>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                One rule across every selected name against a single cash account, so the legs compete for capital
                rather than each spending it.
              </p>
            </>
          ) : (
            <Field label="Symbol" className="w-full justify-between">
              <Select
                ariaLabel="Backtest symbol"
                value={symbol}
                onChange={onSymbolChange}
                options={symbols.map((item) => ({ value: item, label: item }))}
              />
            </Field>
          )}
        </div>

        {/* Rule ----------------------------------------------------------- */}
        <div className="space-y-2 border-t border-hairline pt-4">
          <Eyebrow>Rule</Eyebrow>
          <Field label="Rule" className="w-full justify-between">
            <Select
              ariaLabel="Trading rule"
              value={spec.rule}
              onChange={(rule) => onSpecChange({ rule: rule as RuleKind, params: {} })}
              options={RULE_ORDER.map((rule) => ({ value: rule, label: RULE_DEFINITIONS[rule].label }))}
            />
          </Field>
          <p className="text-[11px] leading-relaxed text-muted">{definition.description}</p>

          {definition.params.length > 0 && (
            <div className="grid gap-1.5 sm:grid-cols-2">
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
        </div>

        {/* Execution ------------------------------------------------------ */}
        <div className="space-y-2 border-t border-hairline pt-4">
          <Eyebrow>Execution</Eyebrow>
          <div className="flex flex-wrap gap-2">
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
          </div>
          <Segmented
            size="sm"
            label="Conflict policy"
            value={spec.conflict}
            onChange={(conflict) => onSpecChange({ conflict })}
            options={[
              { value: "exit_wins", label: "Exit wins" },
              { value: "entry_wins", label: "Entry wins" },
              { value: "hold", label: "Hold" },
            ]}
          />
        </div>

        {/* Sizing --------------------------------------------------------- */}
        <div className="space-y-2 border-t border-hairline pt-4">
          <Eyebrow>Sizing</Eyebrow>
          <Field label="Method" className="w-full justify-between">
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
          <div className="grid gap-1.5 sm:grid-cols-2">
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
              onChange={(initialCapital) => onSpecChange({ initialCapital })}
            />
          </div>
          <ToggleChip
            active={spec.sizing.wholeShares}
            onChange={(wholeShares) => onSpecChange({ sizing: { ...spec.sizing, wholeShares } })}
          >
            Whole shares
          </ToggleChip>
        </div>

        {/* Costs ---------------------------------------------------------- */}
        <div className="space-y-2 border-t border-hairline pt-4">
          <Eyebrow>Costs</Eyebrow>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <NumberField
              label="Commission"
              value={spec.costs.commission}
              min={0}
              max={1_000}
              step={0.5}
              onChange={(commission) => onSpecChange({ costs: { ...spec.costs, commission } })}
            />
            <Field label="Basis" className="justify-between">
              <Select
                ariaLabel="Commission basis"
                value={spec.costs.commissionKind}
                onChange={(commissionKind) => onSpecChange({ costs: { ...spec.costs, commissionKind } })}
                options={[
                  { value: "per_trade", label: "Per trade" },
                  { value: "per_share", label: "Per share" },
                  { value: "bps", label: "Basis points" },
                ]}
              />
            </Field>
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
          <p className="text-[11px] leading-relaxed text-muted">
            Half the spread plus slippage is charged against the direction on both legs. The benchmark pays the same,
            so the comparison measures the rule rather than the fee schedule.
          </p>
        </div>

        {/* Protective exits ----------------------------------------------- */}
        <div className="space-y-2 border-t border-hairline pt-4">
          <Eyebrow>Protective exits</Eyebrow>
          <div className="grid gap-1.5 sm:grid-cols-2">
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
          <p className="text-[11px] leading-relaxed text-muted">
            Zero disables a level. With daily bars a stop touched inside a session is assumed to fill before a target
            touched in the same session, which errs against the strategy.
          </p>
        </div>
      </div>
    </Panel>
  );
}
