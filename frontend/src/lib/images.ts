/**
 * Photos are shrunk in the browser before upload (D28): phone pictures are 3–8 MB, mobile data is slow and
 * expensive, and the server only needs ~1600 px to read a nameplate. The server still validates and
 * re-encodes every file — this is a convenience, not a security control.
 */
export const MAX_PHOTOS = 5
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const MAX_EDGE = 1600
const QUALITY = 0.82
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export class PhotoError extends Error {}

/** Returns a JPEG no larger than MAX_EDGE, or the original if the browser can't resize but the server accepts it. */
export async function preparePhoto(file: File): Promise<File> {
  const resized = await resize(file).catch(() => null)
  if (resized) return resized

  if (!ACCEPTED.has(file.type)) throw new PhotoError('نوع هذا الملف غير مدعوم. اختر صورة (JPG أو PNG أو WebP).')
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError('هذه الصورة كبيرة جداً (أكثر من 5 ميغابايت). جرّب صورة أخرى.')
  return file
}

async function resize(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return null

    context.fillStyle = '#fff' // transparent PNGs would turn black in JPEG
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    if (!blob) return null

    const name = file.name.replace(/\.[^.]*$/, '') || 'photo'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
