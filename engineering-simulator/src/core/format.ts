const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const money = (n: number) => usd.format(Math.round(n))
export const count = (n: number) => int.format(Math.round(n))

let nextId = 0
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`
