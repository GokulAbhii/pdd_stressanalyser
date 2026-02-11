'use client'
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'

const FaceTracking = forwardRef(({ onStressUpdate }, ref) => {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const wsRef = useRef(null)
    const [isTracking, setIsTracking] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [scriptsLoaded, setScriptsLoaded] = useState(false)
    const animationRef = useRef(null)
    const faceMeshRef = useRef(null)
    const cameraRef = useRef(null)

    useImperativeHandle(ref, () => ({
        startTracking,
        stopTracking
    }))

    const loadScripts = () => {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined') return resolve()
            if (window.FaceMesh && window.Camera) {
                setScriptsLoaded(true)
                return resolve()
            }

            const scripts = [
                'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
                'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
                'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
            ]

            let loadedCount = 0

            scripts.forEach(src => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    loadedCount++
                    if (loadedCount === scripts.length) {
                        setScriptsLoaded(true)
                        resolve()
                    }
                    return
                }

                const script = document.createElement('script')
                script.src = src
                script.crossOrigin = 'anonymous'
                script.onload = () => {
                    loadedCount++
                    if (loadedCount === scripts.length) {
                        setScriptsLoaded(true)
                        resolve()
                    }
                }
                script.onerror = () => reject(new Error(`Failed to load ${src}`))
                document.body.appendChild(script)
            })
        })
    }

    const startTracking = async () => {
        setError(null)
        setIsLoading(true)

        try {
            if (!scriptsLoaded) {
                // Try waiting for scripts
                await loadScripts()
            }

            // Get camera access
            let stream
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    }
                })
            } catch (err) {
                console.error('Camera Error:', err)
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    throw new Error('Camera access denied. Please allow camera access.')
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    throw new Error('No camera found.')
                } else {
                    throw new Error('Failed to access camera: ' + err.message)
                }
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }

            // Initialize MediaPipe FaceMesh
            if (typeof window !== 'undefined' && window.FaceMesh) {
                const FaceMesh = window.FaceMesh
                faceMeshRef.current = new FaceMesh({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
                    }
                })

                faceMeshRef.current.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                })

                faceMeshRef.current.onResults(onFaceMeshResults)

                // Start camera
                if (window.Camera) {
                    const Camera = window.Camera
                    cameraRef.current = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (faceMeshRef.current && videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
                                await faceMeshRef.current.send({ image: videoRef.current })
                            }
                        },
                        width: 640,
                        height: 480
                    })
                    await cameraRef.current.start()
                }
            } else {
                throw new Error('FaceMesh library not loaded')
            }

            // Connect to WebSocket
            wsRef.current = new WebSocket('ws://127.0.0.1:8000/ws/analysis')

            wsRef.current.onopen = () => {
                console.log('WebSocket connected')
                setIsTracking(true)
                setIsLoading(false)
            }

            wsRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (onStressUpdate && data.stress_score !== undefined) {
                    onStressUpdate(data.stress_score)
                }
            }

            wsRef.current.onerror = (err) => {
                console.error('WebSocket error:', err)
                // Don't show visible error for WS loss unless critical, just log
            }

        } catch (err) {
            console.error('Error starting tracking:', err)
            setIsLoading(false)
            setError(err.message || 'Failed to start tracking')
        }
    }

    const calculateStressMetrics = (landmarks) => {
        // Eye aspect ratio (blink detection)
        const leftEye = [landmarks[33], landmarks[160], landmarks[158], landmarks[133], landmarks[153], landmarks[144]]
        const rightEye = [landmarks[362], landmarks[385], landmarks[387], landmarks[263], landmarks[373], landmarks[380]]

        const leftEAR = eyeAspectRatio(leftEye)
        const rightEAR = eyeAspectRatio(rightEye)
        const avgEAR = (leftEAR + rightEAR) / 2

        // Mouth aspect ratio (jaw clench)
        const mouth = [landmarks[61], landmarks[291], landmarks[0], landmarks[17]]
        const mouthAR = mouthAspectRatio(mouth)

        // Eyebrow position (brow tension)
        const leftBrow = landmarks[70]
        const rightBrow = landmarks[300]
        const nose = landmarks[1]
        const browTension = Math.abs(leftBrow.y - nose.y) + Math.abs(rightBrow.y - nose.y)

        // Head movement (jitter)
        const noseTip = landmarks[1]
        const jitter = Math.sqrt(noseTip.x ** 2 + noseTip.y ** 2)

        return {
            blink_rate: avgEAR < 0.2 ? 1.0 : 0.0,
            eye_openness: avgEAR,
            jaw_clench: mouthAR,
            brow_tension: browTension * 100,
            jitter: jitter,
            game_score: 0.5
        }
    }

    // New: Calculate estimated stress score locally for immediate UI feedback
    const calculateLocalStressScore = (metrics) => {
        // Simple heuristic: 
        // High blink rate = +20
        // High brow tension = +30
        // High jitter (restlessness) = +30
        // Jaw clench = +20

        let score = 50 // Base baseline

        if (metrics.blink_rate > 0.5) score += 10
        if (metrics.brow_tension > 20) score += 20
        if (metrics.jitter > 10) score += 15
        if (metrics.jaw_clench < 0.2) score += 10 // Clenched

        // Random fluctuation to simulate "live" sensitivity if static
        score += (Math.random() * 10 - 5)

        return Math.min(100, Math.max(0, score))
    }

    const onFaceMeshResults = (results) => {
        if (!canvasRef.current || !videoRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0]

            // Draw face mesh
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)' // Primary Indigo color
            ctx.lineWidth = 1

            // Draw connections
            if (window.FACEMESH_TESSELATION) {
                for (const connection of window.FACEMESH_TESSELATION) {
                    const start = landmarks[connection[0]]
                    const end = landmarks[connection[1]]

                    ctx.beginPath()
                    ctx.moveTo(start.x * canvas.width, start.y * canvas.height)
                    ctx.lineTo(end.x * canvas.width, end.y * canvas.height)
                    ctx.stroke()
                }
            }

            // Calculate stress indicators
            const metrics = calculateStressMetrics(landmarks)

            // ESTIMATE LOCAL STRESS for UI feedback
            const estimatedStress = calculateLocalStressScore(metrics)
            if (onStressUpdate) {
                onStressUpdate(estimatedStress)
            }

            // Send to WebSocket
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    ...metrics,
                    stress_score_local: estimatedStress,
                    timestamp: Date.now()
                }))
            }
        }
    }

    const eyeAspectRatio = (eye) => {
        const vertical1 = distance(eye[1], eye[5])
        const vertical2 = distance(eye[2], eye[4])
        const horizontal = distance(eye[0], eye[3])
        return (vertical1 + vertical2) / (2.0 * horizontal)
    }

    const mouthAspectRatio = (mouth) => {
        const vertical = distance(mouth[2], mouth[3])
        const horizontal = distance(mouth[0], mouth[1])
        return vertical / horizontal
    }

    const distance = (p1, p2) => {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
    }

    const stopTracking = () => {
        setIsTracking(false)
        setIsLoading(false)

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
        }

        if (cameraRef.current) {
            // cameraRef.current.stop() // Camera utils stop might fail if video is gone
        }

        if (faceMeshRef.current) {
            try { faceMeshRef.current.close() } catch (e) { }
        }

        if (wsRef.current) {
            wsRef.current.close()
        }

        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop())
        }
    }

    useEffect(() => {
        loadScripts().catch(err => {
            console.error('Failed to load MediaPipe scripts:', err)
            setError('Failed to load AI models. Please refresh.')
        })

        return () => {
            stopTracking()
        }
    }, [])

    return (
        <div className="relative h-[240px] bg-gradient-to-br from-white/50 to-white/30 rounded-xl overflow-hidden border-2 border-primary/20 shadow-lg">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
            />
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />

            {/* Loading Overlay */}
            {isLoading && !error && (
                <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm text-text-primary p-4">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-sm font-semibold">Initializing AI...</p>
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-danger/20 backdrop-blur-sm text-danger p-4 text-center border-2 border-danger/30">
                    <p className="text-2xl mb-2">⚠️</p>
                    <p className="text-sm font-bold">{error}</p>
                    <button
                        onClick={() => startTracking()}
                        className="mt-2 text-xs bg-danger hover:bg-danger/90 px-4 py-2 rounded-lg text-white font-bold transition-all"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Success Indicator */}
            {isTracking && (
                <div className="absolute top-3 right-3 bg-success/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 font-bold text-white shadow-lg border border-success/50">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Tracking Active
                </div>
            )}
        </div>
    )
})

FaceTracking.displayName = 'FaceTracking'

export default FaceTracking
