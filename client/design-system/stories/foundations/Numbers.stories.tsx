import type { Meta, StoryObj } from "@storybook/react-vite";
import { createNumberFormatter, Text } from "../../src";
import { Code, DocPage, DocSection } from "./docs";

const meta = {
  title: "Foundations/Numbers",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const usd = createNumberFormatter();
const idr = createNumberFormatter({ currency: "IDR" });

const rows: { call: string; usd: string; idr: string }[] = [
  { call: "number(1234.5)", usd: usd.number(1234.5), idr: idr.number(1234.5) },
  { call: "number(1234.5, { decimals: 2 })", usd: usd.number(1234.5, { decimals: 2 }), idr: idr.number(1234.5, { decimals: 2 }) },
  { call: "number(3000000000, { compact: true })", usd: usd.number(3e9, { compact: true }), idr: idr.number(3e9, { compact: true }) },
  { call: "money(1234.5)", usd: usd.money(1234.5), idr: idr.money(1234.5) },
  { call: "money(5000, { compact: true })", usd: usd.money(5000, { compact: true }), idr: idr.money(5000, { compact: true }) },
  { call: "money(-1234.5, { accounting: true, decimals: 2 })", usd: usd.money(-1234.5, { accounting: true, decimals: 2 }), idr: idr.money(-1234.5, { accounting: true, decimals: 2 }) },
  { call: "percent(0.1234)", usd: usd.percent(0.1234), idr: idr.percent(0.1234) },
  { call: "percent(0.1234, { decimals: 2 })", usd: usd.percent(0.1234, { decimals: 2 }), idr: idr.percent(0.1234, { decimals: 2 }) },
  { call: "percent(0.99, { signed: true })", usd: usd.percent(0.99, { signed: true }), idr: idr.percent(0.99, { signed: true }) },
  { call: "percent(-0.99, { signed: true })", usd: usd.percent(-0.99, { signed: true }), idr: idr.percent(-0.99, { signed: true }) },
];

export const Formatting: Story = {
  render: () => (
    <DocPage
      title="Numbers"
      intro={
        <>
          One number policy per app (decision D23): en-US grouping, as every client formats today, and the simulation&apos;s currency. Wrap an
          app in <Code>NumberFormatProvider</Code> and read the formatter with <Code>useNumberFormat()</Code>.
        </>
      }
    >
      <DocSection title="Examples" description="The same calls with USD and IDR as the simulation's currency.">
        <table className="w-full border-collapse overflow-hidden rounded-2xl bg-surface-card shadow-xs">
          <thead className="bg-surface-header-subtle">
            <tr>
              {["Call", "USD", "IDR"].map((heading) => (
                <th key={heading} scope="col" className="px-5 py-3 text-start type-body font-semibold text-fg-subtle">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.call} className="border-t border-line">
                <td className="px-5 py-3">
                  <Code>{row.call}</Code>
                </td>
                <td className="px-5 py-3">
                  <Text as="span" variant="body-lg" tone="primary" numeric>
                    {row.usd}
                  </Text>
                </td>
                <td className="px-5 py-3">
                  <Text as="span" variant="body-lg" tone="primary" numeric>
                    {row.idr}
                  </Text>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocSection>
    </DocPage>
  ),
};
