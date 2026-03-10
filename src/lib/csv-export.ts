export function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCSV(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCSVField).join(','),
    ...rows.map(row => row.map(escapeCSVField).join(',')),
  ]
  return lines.join('\r\n') + '\r\n'
}
