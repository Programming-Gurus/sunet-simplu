// The rules of the two output devices (DESIGN.md, 5.7 and 8.2). The app remembers a device by its name.

export interface OutputStatus {
  /** The main output is "System default". */
  mainIsDefault: boolean
  /** "System default" is always connected. A named device is connected if it is in the list. */
  mainConnected: boolean
  previewConnected: boolean
  /** A preview plays only when the preview output is valid (5.7). */
  previewValid: boolean
}

export function outputStatus(main: string | null, preview: string | null, connected: string[]): OutputStatus {
  const mainConnected = main === null || connected.includes(main)
  const previewConnected = preview !== null && connected.includes(preview)
  return {
    mainIsDefault: main === null,
    mainConnected,
    previewConnected,
    // The main output is a named device, the preview output is a different named device,
    // and the preview device is connected.
    previewValid: main !== null && preview !== null && preview !== main && previewConnected,
  }
}

/**
 * The names that one setting can offer: the connected devices without the device of the other
 * setting, and the remembered device also if it is not connected.
 */
export function selectableNames(own: string | null, other: string | null, connected: string[]): string[] {
  const names = connected.filter((name) => name !== other)
  if (own !== null && !names.includes(own)) names.unshift(own)
  return names
}
