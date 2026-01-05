const currencyFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number | null | undefined, opts?: { maximumFractionDigits?: number }) {
  const n = Number(value ?? 0)
  const formatter =
    opts?.maximumFractionDigits != null
      ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: opts.maximumFractionDigits })
      : currencyFormatter
  return formatter.format(Math.round(n))
}

export function formatNumber(value: number | null | undefined, opts?: { maximumFractionDigits?: number }) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: opts?.maximumFractionDigits ?? 2, minimumFractionDigits: 0 }).format(n)
}

export function formatPercent(value: number | null | undefined, opts?: { maximumFractionDigits?: number }) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('en-AU', {
    style: 'percent',
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
    minimumFractionDigits: 0,
  }).format(n)
}
