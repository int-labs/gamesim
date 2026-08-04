import { useGame } from '@/state/store';
import { PixelPanel, PixelBadge } from '@/components/primitives';
import { PixelStepLine } from '@/components/charts/PixelStepLine';
import { PixelStepBars } from '@/components/charts/PixelStepBars';
import { PixelStackedBar } from '@/components/charts/PixelStackedBar';
import { fmt$ } from '@/utils/format';
import { MetricIcon, MetricIconKind } from '@/components/icons/MetricIcon';
import { useState } from 'react';
import clsx from 'clsx';

type SubTab = 'pnl' | 'charts' | 'cash';

const TABS: { id: SubTab; label: string }[] = [
  { id: 'pnl', label: 'P&L' },
  { id: 'charts', label: 'Charts' },
  { id: 'cash', label: 'Cash Flow' },
];

export function PnLPanel() {
  const ledger = useGame((s) => s.ledger);
  const series = useGame((s) => s.series);
  const cash = useGame((s) => s.player.cash);
  const product = useGame(
    (s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? s.portfolio.productLines[0],
  );
  const [tab, setTab] = useState<SubTab>('pnl');

  const sum = (k: string) => ledger.filter((e) => e.kind === k).reduce((a, b) => a + b.amount, 0);
  const grossRevenue = sum('revenue');
  const matCost = -sum('cogs-material');
  const labor = -sum('cogs-labor');
  const packaging = -sum('cogs-packaging');
  const fulfillment = -sum('cogs-fulfillment');
  const pkgFulfill = packaging + fulfillment;
  const marketing = -sum('opex-marketing');
  const tools = -sum('opex-tool');
  const totalCogs = matCost + labor + packaging + fulfillment;
  const grossProfit = grossRevenue - totalCogs;
  const opProfit = grossProfit - marketing - tools;

  const rows: PnLRowData[] = [
    { kind: 'revenue', icon: 'revenue', iconTone: 'mint', label: 'Gross Revenue', value: grossRevenue, sign: 'plus', cause: 'Driven by units sold × price.' },
    { kind: 'material', icon: 'material', iconTone: 'sand', label: 'Material Cost', value: -matCost, sign: 'minus', cause: causeMaterial(product) },
    { kind: 'labor', icon: 'labor', iconTone: 'sky', label: 'Labor Cost', value: -labor, sign: 'minus', cause: 'Daily wage × number of helpers hired.' },
    { kind: 'marketing', icon: 'marketing', iconTone: 'rose', label: 'Marketing Spend', value: -marketing, sign: 'minus', cause: 'Active campaigns and channel daily cost.' },
    { kind: 'pkg', icon: 'packaging', iconTone: 'sand', label: 'Packaging / Fulfillment', value: -pkgFulfill, sign: 'minus', cause: 'Per-unit packaging + shipping.' },
    { kind: 'tools', icon: 'tools', iconTone: 'violet', label: 'Tools / Upgrades', value: -tools, sign: 'minus', cause: 'One-off equipment, supplier deals, processes.' },
    { kind: 'gross', icon: 'profit', iconTone: 'mint', label: 'Gross Profit', value: grossProfit, sign: grossProfit >= 0 ? 'plus' : 'minus', cause: 'Revenue minus all COGS.', emphasis: 'subtotal' },
    { kind: 'op', icon: 'profit', iconTone: 'mint', label: 'Operating Profit', value: opProfit, sign: opProfit >= 0 ? 'plus' : 'minus', cause: 'Gross profit minus operating expenses.', emphasis: 'highlight' },
    { kind: 'cash', icon: 'cash', iconTone: 'mint', label: 'Cash Balance', value: cash, sign: cash >= 0 ? 'plus' : 'minus', cause: 'Cash you actually have on hand right now.', emphasis: 'highlight' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Sub-tab strip */}
      <div
        role="tablist"
        aria-label="P&L sections"
        className="grid grid-cols-3 gap-1 p-1 bg-surface-2/50 border border-border-soft"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-2 py-2 tab-label-sm transition-colors cursor-pointer truncate',
              tab === t.id
                ? 'bg-surface text-text border border-border shadow-[1px_1px_0_0_var(--c-shadow)]'
                : 'border border-transparent text-text-2 hover:bg-surface/60 hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pnl' && (
        <PixelPanel title="Profit & Loss · Live">
          <table className="w-full body-xs" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-cream-200">
                <th className="text-left px-2 py-1.5 eyebrow eyebrow-sm text-ink-700 w-7"></th>
                <th className="text-left px-1 py-1.5 eyebrow eyebrow-sm text-ink-700">Line item</th>
                <th className="text-right px-2 py-1.5 eyebrow eyebrow-sm text-ink-700 w-24">Amount</th>
                <th className="text-right px-2 py-1.5 eyebrow eyebrow-sm text-ink-700 w-16 hidden sm:table-cell">Cause</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <PnLRow key={r.kind + i} row={r} />
              ))}
            </tbody>
          </table>
          <div className="pt-3 flex items-center gap-2 flex-wrap">
            <PixelBadge tone={cash >= 0 ? 'success' : 'error'}>Cash {fmt$(cash)}</PixelBadge>
            <PixelBadge tone={opProfit >= 0 ? 'success' : 'error'}>Op profit {fmt$(opProfit)}</PixelBadge>
          </div>
        </PixelPanel>
      )}

      {tab === 'charts' && (
        <div className="flex flex-col gap-3">
          <PixelPanel title="Cash vs Profit · last 30 days">
            <div className="space-y-3">
              <Labeled tag="Cash">
                <PixelStepLine data={series.cash.slice(-30)} stroke="#5fb27a" fill="rgba(95,178,122,0.18)" width={310} height={86} />
              </Labeled>
              <Labeled tag="Daily profit">
                <PixelStepLine data={series.profit.slice(-30)} stroke="#5b86c2" fill="rgba(91,134,194,0.18)" width={310} height={86} />
              </Labeled>
            </div>
          </PixelPanel>

          <PixelPanel title="Cost Breakdown">
            <PixelStackedBar
              data={[
                { label: 'Material', value: matCost, color: '#e07a6a' },
                { label: 'Labor', value: labor, color: '#9b6cd9' },
                { label: 'Marketing', value: marketing, color: '#e6b54a' },
                { label: 'Tools', value: tools, color: '#5b86c2' },
              ]}
              width={310}
              height={26}
            />
          </PixelPanel>

          <PixelPanel title="Inventory Movement (last 14d)">
            <PixelStepBars
              data={series.sold.slice(-14).map((v, i) => ({
                label: String(i + 1),
                value: v,
                color: '#5b86c2',
              }))}
              width={310}
              height={110}
              showValues={false}
            />
          </PixelPanel>
        </div>
      )}

      {tab === 'cash' && (
        <div className="flex flex-col gap-3">
          <PixelPanel title="Cash Balance Trend">
            <PixelStepLine
              data={series.cash}
              stroke={cash >= 0 ? '#5fb27a' : '#c95448'}
              fill={cash >= 0 ? 'rgba(95,178,122,0.2)' : 'rgba(201,84,72,0.2)'}
              width={310}
              height={140}
            />
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <PixelBadge tone={cash >= 0 ? 'success' : 'error'}>Now {fmt$(cash)}</PixelBadge>
              <PixelBadge tone="neutral">Days tracked {series.cash.length}</PixelBadge>
            </div>
          </PixelPanel>

          <PixelPanel title="Daily revenue vs daily profit">
            <Labeled tag="Revenue (last 14d)">
              <PixelStepLine data={series.revenue.slice(-14)} stroke="#5fb27a" fill="rgba(95,178,122,0.18)" width={310} height={70} />
            </Labeled>
            <Labeled tag="Profit (last 14d)">
              <PixelStepLine data={series.profit.slice(-14)} stroke="#5b86c2" fill="rgba(91,134,194,0.18)" width={310} height={70} />
            </Labeled>
            <p className="body-xs text-ink-700 mt-2 leading-snug">
              When revenue rises but profit doesn't, look at Material and Marketing in the P&L tab.
            </p>
          </PixelPanel>
        </div>
      )}
    </div>
  );
}

interface PnLRowData {
  kind: string;
  icon: MetricIconKind;
  iconTone: 'mint' | 'amber' | 'rose' | 'sky' | 'violet' | 'sand' | 'cream';
  label: string;
  value: number;
  sign: 'plus' | 'minus';
  cause: string;
  emphasis?: 'subtotal' | 'highlight';
}

function PnLRow({ row }: { row: PnLRowData }) {
  const valueClass =
    row.sign === 'plus' ? 'text-success-DEFAULT text-success' : row.value < 0 ? 'text-error' : 'text-ink-900';
  return (
    <tr
      title={row.cause}
      className={clsx(
        'border-b border-ink-900/15 align-middle cursor-help',
        row.emphasis === 'subtotal' && 'bg-cream-50',
        row.emphasis === 'highlight' && 'bg-cream-200 font-semibold',
      )}
    >
      <td className="py-1.5 px-2 align-middle">
        <MetricIcon kind={row.icon} tone={row.iconTone} size={22} />
      </td>
      <td className={clsx('py-1.5 leading-tight', row.emphasis ? 'body-xs text-ink-900' : 'body-xs text-ink-800')}>
        {row.label}
      </td>
      <td className={clsx('py-1.5 px-2 text-right num-xs', valueClass)}>
        {fmt$(row.value)}
      </td>
      <td className="py-1.5 px-2 text-right hint text-ink-700 hidden sm:table-cell">i</td>
    </tr>
  );
}

function Labeled({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow eyebrow-sm text-ink-700 mb-1">{tag}</div>
      {children}
    </div>
  );
}

function causeMaterial(product: { cover: string; paperQuality: string; size: string }) {
  if (product.cover === 'leather') return 'Lifted by leather cover (~+1.6×).';
  if (product.paperQuality === 'premium') return 'Lifted by premium paper.';
  if (product.size === 'l') return 'Larger size scales material per unit.';
  return 'Driven by paper, cover, binding and add-ons.';
}
