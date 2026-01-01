# Cingulum – Dream P&L (MVP)

This is a working MVP that:
- Parses **Xero Profit & Loss** exports (`.xlsx`)
- Parses **Xero General Ledger Detail** exports (`.xlsx`, grouped by account like your file)
- Re-expresses Xero data into a **built-in Dream P&L** structure (board / investor view)
- Lets users **map Xero accounts → Dream lines** with a fast, iPhone-like toggle UX
- Lets users **edit the Dream layout** (add/remove/rename/reorder groups/lines) and export/import template JSON
- Supports **drill-down to transactions** (if GL is loaded) from either a Dream line or a raw Xero account
- Includes a **simple replacement scenario** (remove legacy TMS revenue via matchers; add simulated bundle revenue + COGS)

## Run locally

1) Install dependencies
```bash
npm install
```

2) Start
```bash
npm run dev
```

Open: `http://localhost:5173`

## How the “built-in upload” dream works

The app does not depend on a fixed Cingulum sheet structure.
Instead, it builds a **canonical model** from the raw Xero export:

- `parseXeroProfitAndLoss()` outputs:
  - months (keys + labels)
  - a flat list of accounts with values per month, tagged with a best-effort section

- The Dream P&L is:
  - **a template** (groups + lines)
  - each line keeps `mappedAccounts: string[]` (Xero account names)
  - computed values = `SUM(account values for mapped accounts)`

So once a user maps accounts once, the Dream P&L “just works” for future exports from that org.

## Files worth reading

- `src/lib/xero/plParser.ts` – robust P&L parser (finds header row, infers months, reads account rows)
- `src/lib/xero/glParser.ts` – GL parser for grouped-by-account exports
- `src/lib/dream/template.ts` – built-in Dream P&L template (editable in UI)
- `src/components/MappingEditor.tsx` – the iPhone-like mapping UX
- `src/components/TemplateEditor.tsx` – the layout editor

## Adapting to other Xero export variants

The parser is intentionally defensive, but Xero exports can vary.
If you encounter a new variant, you usually update only:
- `src/lib/xero/plParser.ts` (header detection + month columns)
- `src/lib/xero/glParser.ts` (account grouping rules / column headers)

The rest of the app stays unchanged because it consumes the canonical model.

## Next iteration (obvious improvements)

- Multi-entity / multi-file dataset manager (saved runs)
- “Unmapped account resolver” flow (guided)
- Better scenario modelling: project counts from GL, not manual inputs
- Rules-based mapping (regex rules per Dream line) + auto mapping library
- Export Dream P&L to PDF / Excel
