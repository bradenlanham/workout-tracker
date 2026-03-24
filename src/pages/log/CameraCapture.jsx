import { useRef, useState } from 'react'

export default function CameraCapture({ onCapture, onCancel }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)

  // Auto-open the native camera on mount
  const triggerCamera = (el) => {
    fileRef.current = el
    if (el) el.click()
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) { onCancel(); return }

    const img = new Image()
    img.onload = () => {
      // Crop to 3:4 portrait
      const srcW = img.naturalWidth
      const srcH = img.naturalHeight
      const dstAspect = 3 / 4
      let sx, sy, sw, sh
      if (srcW / srcH > dstAspect) {
        sh = srcH
        sw = sh * dstAspect
        sx = (srcW - sw) / 2
        sy = 0
      } else {
        sw = srcW
        sh = sw / dstAspect
        sx = 0
        sy = (srcH - sh) / 2
      }
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = Math.round(400 * 4 / 3)
      const ctx = canvas.getContext('2d')
      // Mirror horizontally so selfie matches the camera preview
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
      setPreview(dataUrl)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  function retake() {
    setPreview(null)
    // Re-trigger file input after state clears
    setTimeout(() => fileRef.current?.click(), 50)
  }

  function usePhoto() {
    onCapture(preview)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Hidden file input — opens native camera */}
      <input
        ref={triggerCamera}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFile}
        className="hidden"
      />

      {!preview ? (
        <div className="text-center px-6">
          <p className="text-white text-lg mb-2">📷</p>
          <p className="text-white/70 text-sm mb-4">Opening camera…</p>
          <button onClick={onCancel} className="text-white/50 text-sm underline">
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Preview captured image */}
          <div
            className="overflow-hidden rounded-2xl"
            style={{ width: 'min(80vw, 360px)', aspectRatio: '3/4' }}
          >
            <img src={preview} alt="Captured selfie" className="w-full h-full object-cover" />
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={retake}
              className="px-6 py-3 rounded-2xl bg-white/10 text-white font-semibold text-sm"
            >
              Retake
            </button>
            <button
              onClick={usePhoto}
              className="px-6 py-3 rounded-2xl bg-white text-black font-bold text-sm"
            >
              Use Photo
            </button>
          </div>

          <button onClick={onCancel} className="mt-4 text-white/50 text-sm">
            Cancel
          </button>
        </>
      )}
    </div>
  )
}
