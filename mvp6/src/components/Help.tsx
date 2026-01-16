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
        <Section title="Auditability model">
          <div>
            <span className="text-slate-100">Current</span> = direct from uploaded Xero P&amp;L (no transformations).
          </div>
          <div>
            <span className="text-slate-100">Dream P&amp;L</span> = re-expression only: mapped accounts roll up to management lines. No synthetic maths.
          </div>
          <div>
            <span className="text-slate-100">Scenario</span> = explicit replacement: remove legacy revenue, then add bundle revenue and optional bundle costs.
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Trust comes from drill-down: every Dream line can open the mapped Xero accounts and (if uploaded) the matching GL transactions.
          </div>
        </Section>

        <Section title="Replacement rule (core math)">
          <div>
            Bundles are replacements, not add-ons. The scenario always follows:
            <Formula>Scenario = Current - Legacy TMS (plus or minus consult removal) + CBA bundle + cgTMS bundle</Formula>
          </div>
          <div className="mt-3">
            Movement KPI math depends on comparison mode (Reports): last3 vs prev3, scenario vs current, or month vs prior.
          </div>
        </Section>

        <Section title="Bundle costs toggle">
          <div>
            Control whether bundle COGS are injected into the scenario or assumed already in your P&amp;L.
          </div>
          <Formula>When ON: COGS change = (CBA costs x CBA volume) + (cgTMS costs x Program volume)</Formula>
          <div className="mt-2 text-xs text-slate-400">
            When OFF, only revenue changes. Use this if your current P&amp;L already contains the bundle delivery costs.
          </div>
        </Section>

        <Section title="Doctor service fee logic">
          <div>
            Patient fees are split automatically using the global service-fee %. The remainder is the doctor payout (your cost).
          </div>
          <Formula>Doctor payout = Patient fee x (1 - ServiceFee%)</Formula>
          <div className="mt-2 text-xs text-slate-400">
            If 6-week consults are enabled, the 6-month consult is automatically included for the same patients with the same fee.
          </div>
        </Section>

        <Section title="Troubleshooting checklist">
          <div>1) Confirm which accounts are tagged as legacy TMS revenue (and optional consult removal).</div>
          <div>2) Check whether Apply bundle costs is ON or OFF. This drives COGS movements.</div>
          <div>3) Review mapping completeness: if &lt;85%, Reports will default to Legacy for accuracy.</div>
          <div>4) Re-run Saved Export from a snapshot to confirm movements are stable.</div>
        </Section>

        <Section title="Where to go next">
          <div><span className="text-slate-100">Mapping</span>: Map remaining accounts to improve Dream completeness.</div>
          <div><span className="text-slate-100">Overview</span>: Adjust levers (rent, machines, volumes) and see the P&amp;L shift.</div>
          <div><span className="text-slate-100">Reports</span>: Generate investor PDF with chosen datasource and scenario overlay.</div>
        </Section>

        <Section title="Simple flow (one-page mental model)">
          <div className="font-mono text-[11px] leading-relaxed text-slate-200">
            Uploads to Map accounts to Dream P&amp;L to Scenario rule to Reports and Snapshots
            <div className="text-slate-400 mt-2">Every step keeps a trail: dataset hashes, template layout hash, and saved report configs.</div>
          </div>
        </Section>
      </div>

      <div className="mt-6 text-xs text-slate-400">
        Need confidence fast? Load a snapshot, open Mapping to confirm account coverage, then hit Reports to regenerate the PDF using the saved
        data source and comparison mode.
      </div>
    </Card>
  )
}
