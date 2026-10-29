import { describe, expect, it } from 'vitest'
import { MAX_PHOTO_BYTES, PhotoError, preparePhoto } from './images'

// jsdom has no createImageBitmap, so these exercise the fallback path (no resize possible).
describe('preparePhoto without browser resizing', () => {
  it('passes through images the server accepts', async () => {
    const file = new File(['x'], 'a.webp', { type: 'image/webp' })
    expect(await preparePhoto(file)).toBe(file)
  })

  it('refuses other file types and oversized images with Arabic messages', async () => {
    await expect(preparePhoto(new File(['x'], 'a.heic', { type: 'image/heic' }))).rejects.toThrow(PhotoError)
    await expect(preparePhoto(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' }))).rejects.toThrow(
      'هذه الصورة كبيرة جداً (أكثر من 5 ميغابايت). جرّب صورة أخرى.',
    )
  })
})
