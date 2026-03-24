import { useEffect, useRef, useState } from 'react'

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [preview, setPreview] = useState(null) // captured dataURL
  const [error, setError] = useState(null)

  // Start camera whenever we're in live-preview mode (preview === null)
  useEffect(() => {
    if (preview !== null) return
    startCamera()
  }, [preview])

  // Stop stream on unmount
  useEffect(() => {
    return () => stopStream()
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e) {
      setError('Camera access denied or not available.')
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function capture() {
    const video = videoRef.current
    if (!video) return
    // Crop source to 3:4 portrait ratio
    const srcW = video.videoWidth
    const srcH = video.videoHeight
    const dstAspect = 3 / 4
    let sx, sy, sw, sh
    if (srcW / srcH > dstAspect) {
      // video wider than 3:4 — crop sides
      sh = srcH
      sw = sh * dstAspect
      sx = (srcW - sw) / 2
      sy = 0
    } else {
      // video taller than 3:4 — crop top/bottom
      sw = srcW
      sh = sw / dstAspect
      sx = 0
      sy = (srcH - sh) / 2
    }
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = Math.round(400 * 4 / 3)
    const ctx = canvas.getContext('2d')
    // Mirror horizontally to match live preview
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
    stopStream()
    setPreview(dataUrl)
  }

  function retake() {
    stopStream()
    setPreview(null) // triggers useEffect to startCamera after re-render
  }

  function usePhoto() {
    onCapture(preview)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {error ? (
        <div className="text-center px-6">
          <p className="text-white text-lg mb-2">📷</p>
          <p className="text-white/70 text-sm mb-6">{error}</p>
          <button onClick={onCancel} className="text-white/60 text-sm underline">Cancel</button>
        </div>
      ) : !preview ? (
        <>
          {/* Live camera preview */}
          <div
            className="relative overflow-hidden rounded-2xl bg-black"
            style={{ width: 'min(80vw, 360px)', aspectRatio: '3/4' }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>

          {/* Capture button */}
          <button
            onClick={capture}
            className="mt-8 w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            aria-label="Capture photo"
          >
            <div className="w-12 h-12 rounded-full border-2 border-black/20" />
          </button>

          <button onClick={onCancel} className="mt-5 text-white/50 text-sm">
            Cancel
          </button>
        </>
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
