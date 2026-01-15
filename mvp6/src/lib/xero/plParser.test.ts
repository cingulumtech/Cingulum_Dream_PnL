import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { parseXeroProfitAndLoss } from './plParser'

function toArrayBuffer(buffer: Uint8Array) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

describe('parseXeroProfitAndLoss', () => {
  it('preserves spreadsheet sign for fixture values', () => {
    const fixture = new URL('../../test/fixtures/Profit_and_Loss.csv', import.meta.url)
    const buf = readFileSync(fixture)
    const parsed = parseXeroProfitAndLoss(toArrayBuffer(buf))

    const decIdx = parsed.months.indexOf('2025-12')
    const novIdx = parsed.months.indexOf('2025-11')

    const drRyan = parsed.accounts.find(a => a.name === 'Dr Ryan Medical Sales')
    const mgmtFee = parsed.accounts.find(a => a.name === 'Management Fee')

    expect(decIdx).toBeGreaterThanOrEqual(0)
    expect(novIdx).toBeGreaterThanOrEqual(0)
    expect(drRyan?.values[decIdx]).toBeCloseTo(4950)
    expect(mgmtFee?.values[novIdx]).toBeCloseTo(6066.97)
  })
})
