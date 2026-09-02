import { describe, expect, it } from 'vitest'
import { getReadableTextColor } from './color'

describe('getReadableTextColor', () => {
  it('uses paper text on dark custom rows', () => {
    expect(getReadableTextColor('#000000')).toBe('#FFFDF7')
    expect(getReadableTextColor('#183153')).toBe('#FFFDF7')
  })

  it('uses ink text on pale custom rows and invalid fallback input', () => {
    expect(getReadableTextColor('#F8DF8B')).toBe('#171816')
    expect(getReadableTextColor('tomato')).toBe('#171816')
  })
})
