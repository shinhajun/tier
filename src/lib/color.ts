const INK = '#171816'
const PAPER = '#FFFDF7'

function channelToLinear(channel: number) {
  const normalized = channel / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16))
  if (!channels || channels.length !== 3 || channels.some(Number.isNaN)) return 1
  const [red, green, blue] = channels.map(channelToLinear)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

export function getReadableTextColor(background: string) {
  if (!/^#[0-9a-f]{6}$/i.test(background)) return INK
  return contrastRatio(background, INK) >= contrastRatio(background, PAPER)
    ? INK
    : PAPER
}
