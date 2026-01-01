import React from 'react'
import { Card, Chip } from './ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-2 text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  )
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-slate-200">
      {children}
    </div>
  )
}

export function Help() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">Help</div>
          <div className="mt-1 text-sm text-slate-300">
            A clear explanation of how the app stays auditable and how the scenario math works.
          </div>
        </div>
        <Chip>Last updated: MVP6</Chip>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="How this stays auditable">
          <div>
            • <span className="text-slate-100">Current</span> is always computed directly from the uploaded Xero Profit &amp; Loss.
          </div>
          <div>
            • <span className="text-slate-100">Dream P&amp;L</span> is a pure re-expression: it sums Xero accounts into your management
            categories.
          </div>
          <div>
            • <span className="text-slate-100">Scenario</span> is replacement-based: it subtracts only what you explicitly mark as legacy
            income (e.g., TMS) and then adds bundle revenue. Nothing is “double-counted” unless you turn it on.
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Tip: drill-down confidence comes from being able to click a line and see the underlying accounts and GL transactions.
          </div>
        </Section>

        <Section title="Replacement modelling (the rule)">
          <div>
            Bundles are not additive revenue. The scenario does:
            <Formula>Scenario = Base − Legacy TMS (and optional consult revenue) + (CBA revenue + cgTMS revenue)</Formula>
          </div>
          <div className="mt-3">
            Costs are treated separately via a toggle:
            <Formula>ΔCOGS = (Costs per CBA × CBAs/month) + (Costs per Program × Programs/month)</Formula>
            <div className="mt-2 text-xs text-slate-400">
              If the “Apply bundle costs” toggle is off, the scenario changes revenue only and assumes your existing P&amp;L already
              contains those costs.
            </div>
          </div>
        </Section>

        <Section title="Doctor consults & service fee">
          <div>
            Patient fees are not the same as your actual cost. This model assumes you retain a global <span className="text-slate-100">service fee %</span>
            and the remainder is paid to the doctor.
          </div>
          <Formula>
            Doctor payout (actual cost) = Patient fee × (1 − ServiceFee%)
          </Formula>
          <div className="mt-3">
            Within cgTMS, if you include a 6-week consult, the model automatically includes the corresponding 6-month consult for the same
            patients (same fee + count per patient).
          </div>
        </Section>

        <Section title="Shifting the needle">
          <div>
            These are hypothetical levers that can materially change profitability. They are kept separate from the operational bundle
            settings so it stays spreadsheet-clear.
          </div>
          <div className="mt-2">
            • <span className="text-slate-100">Rent</span>: either set a new fixed monthly rent or apply a monthly % change (compounded).
          </div>
          <div>
            • <span className="text-slate-100">TMS machines</span>: derive programs/month from machines × patients/week/machine × weeks/year × utilisation.
          </div>
        </Section>
      </div>

      <div className="mt-6 text-xs text-slate-400">
        If something feels “off”, the fastest check is: confirm (1) which accounts are being removed as legacy streams and (2) whether bundle
        costs are being added to scenario COGS.
      </div>
    </Card>
  )
}
