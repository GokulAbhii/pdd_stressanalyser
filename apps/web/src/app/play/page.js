'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'

// Import games
import ReactionTimeGame from './games/ReactionTime'
import MemoryMatchGame from './games/MemoryMatch'
import PatternRecognitionGame from './games/PatternRecognition'
import ColorStroopGame from './games/ColorStroop'
import NumberSequenceGame from './games/NumberSequence'
import MazeNavigatorGame from './games/MazeNavigator'
import WhackAMoleGame from './games/WhackAMole'
import PuzzleSliderGame from './games/PuzzleSlider'
import FocusTrackerGame from './games/FocusTracker'
import BreathingExerciseGame from './games/BreathingExercise'

// Import face tracking
import FaceTracking from './FaceTracking'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const ALL_GAMES = [
    { id: 1, name: 'Reaction Time', component: ReactionTimeGame, emoji: '⚡', description: 'Click as fast as you can when the color changes.' },
    { id: 2, name: 'Memory Match', component: MemoryMatchGame, emoji: '🧠', description: 'Find matching pairs of cards.' },
    { id: 3, name: 'Pattern Recognition', component: PatternRecognitionGame, emoji: '🔷', description: 'Repeat the pattern shown to you.' },
    { id: 4, name: 'Color Stroop', component: ColorStroopGame, emoji: '🎨', description: 'Select the color of the text, not the word.' },
    { id: 5, name: 'Number Sequence', component: NumberSequenceGame, emoji: '🔢', description: 'Enter the missing number in the sequence.' },
    { id: 6, name: 'Maze Navigator', component: MazeNavigatorGame, emoji: '🗺️', description: 'Navigate to the exit without hitting walls.' },
    { id: 7, name: 'Whack-a-Mole', component: WhackAMoleGame, emoji: '🔨', description: 'Hit the targets as they appear.' },
    { id: 8, name: 'Puzzle Slider', component: PuzzleSliderGame, emoji: '🧩', description: 'Slide tiles to form the correct image.' },
    { id: 9, name: 'Focus Tracker', component: FocusTrackerGame, emoji: '🎯', description: 'Keep your mouse on the moving target.' },
    { id: 10, name: 'Breathing Exercise', component: BreathingExerciseGame, emoji: '🧘', description: 'Follow the breathing accumulation rhythm.' }
]

export default function PlayPage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [sessionId, setSessionId] = useState(null)
    const [currentGameIndex, setCurrentGameIndex] = useState(-1) // -1 means not started
    const [selectedGames, setSelectedGames] = useState([])
    const [stressData, setStressData] = useState([])
    const [currentStress, setCurrentStress] = useState(null)
    const [loading, setLoading] = useState(false)
    const [gameState, setGameState] = useState('intro') // intro, playing, transition, completed

    const faceTrackingRef = useRef(null)

    useEffect(() => {
        const token = localStorage.getItem('token')
        const userData = localStorage.getItem('user')

        if (!token || !userData) {
            router.push('/login')
            return
        }
        setUser(JSON.parse(userData))
    }, [router])

    const selectRandomGames = () => {
        const shuffled = [...ALL_GAMES]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled.slice(0, 4)
    }

    const startSession = async () => {
        setLoading(true)
        try {
            const games = selectRandomGames()
            setSelectedGames(games)

            const response = await fetch('http://127.0.0.1:8000/api/v1/stress/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, baseline_stress: 50 })
            })

            if (!response.ok) throw new Error('Failed to create session')

            const data = await response.json()
            setSessionId(data.session_id)
            setCurrentGameIndex(0)
            setGameState('playing')

            setTimeout(() => {
                if (faceTrackingRef.current) faceTrackingRef.current.startTracking()
            }, 500)
        } catch (error) {
            console.error('Error starting session:', error)
            alert('Failed to start session: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGameComplete = async (gameData) => {
        setGameState('saving')
        try {
            const currentGame = selectedGames[currentGameIndex]

            await fetch(`http://127.0.0.1:8000/api/v1/stress/session/${sessionId}/game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_name: currentGame.name,
                    game_number: currentGameIndex + 1,
                    score: gameData.score || 0,
                    duration: gameData.duration || 0,
                    face_data: JSON.stringify(gameData.faceData || {}),
                    stress_scores: JSON.stringify(stressData.slice(-50)), // optimize payload
                    avg_stress: stressData.length > 0 ? stressData.reduce((a, b) => a + b, 0) / stressData.length : 50,
                    max_stress: stressData.length > 0 ? Math.max(...stressData) : 50,
                    min_stress: stressData.length > 0 ? Math.min(...stressData) : 50
                })
            })

            if (currentGameIndex < selectedGames.length - 1) {
                setGameState('transition')
            } else {
                setGameState('completed')
                await completeSession()
            }
        } catch (error) {
            console.error('Error saving game data:', error)
            // Proceed anyway to not block user
            if (currentGameIndex < selectedGames.length - 1) {
                setGameState('transition')
            } else {
                setGameState('completed')
            }
        }
    }

    const proceedToNextGame = () => {
        setCurrentGameIndex(prev => prev + 1)
        setGameState('playing')
        setStressData([])
    }

    const completeSession = async () => {
        try {
            await fetch(`http://127.0.0.1:8000/api/v1/stress/session/${sessionId}/complete`, {
                method: 'POST'
            })
            if (faceTrackingRef.current) faceTrackingRef.current.stopTracking()
            router.push(`/report?session=${sessionId}`)
        } catch (error) {
            console.error('Error completing session:', error)
            router.push(`/report?session=${sessionId}`)
        }
    }

    const handleStressUpdate = (stressScore) => {
        setCurrentStress(stressScore)
        setStressData(prev => {
            const newData = [...prev, stressScore]
            if (newData.length > 30) return newData.slice(newData.length - 30)
            return newData
        })
    }

    // Chart Configuration with smoother animations
    const chartData = {
        labels: stressData.map((_, i) => i),
        datasets: [
            {
                label: 'Stress Level',
                data: stressData,
                fill: true,
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                    gradient.addColorStop(0, 'rgba(124, 58, 237, 0.4)'); // Violet
                    gradient.addColorStop(1, 'rgba(124, 58, 237, 0.05)');
                    return gradient;
                },
                borderColor: 'rgba(124, 58, 237, 0.8)',
                borderWidth: 3,
                tension: 0.5, // Smoother curve
                pointRadius: 0,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
        },
        scales: {
            x: { display: false },
            y: {
                display: false,
                min: 0,
                max: 100
            }
        },
        animation: {
            duration: 1000,
            easing: 'linear'
        },
        maintainAspectRatio: false
    }

    if (!user) return <div className="flex h-screen items-center justify-center text-indigo-500 animate-pulse">Loading Environment...</div>

    if (gameState === 'intro') {
        return (
            <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-grid-white/[0.05] [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />
                <Card variant="glass" className="max-w-2xl w-full border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl animate-scale-in">
                    <CardHeader className="text-center pb-8 border-b border-white/10">
                        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-3xl flex items-center justify-center text-5xl mb-6 shadow-xl shadow-indigo-500/30 animate-float">
                            🧠
                        </div>
                        <CardTitle className="text-4xl font-extrabold text-white mb-2">Cognitive Stress Assessment</CardTitle>
                        <p className="text-slate-300 text-lg max-w-lg mx-auto leading-relaxed">
                            Evaluate your mental performance and stress response through 4 rapid-fire cognitive challenges.
                        </p>
                    </CardHeader>
                    <CardContent className="pt-8 flex flex-col gap-8">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-lg text-center transform transition-all hover:scale-105 hover:bg-white/10">
                                <div className="text-4xl mb-3">📷</div>
                                <div className="font-bold text-white text-lg">Facial Analysis</div>
                                <div className="text-sm text-slate-400">Real-time expression tracking</div>
                            </div>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-lg text-center transform transition-all hover:scale-105 hover:bg-white/10">
                                <div className="text-4xl mb-3">🎮</div>
                                <div className="font-bold text-white text-lg">4 Mini-Games</div>
                                <div className="text-sm text-slate-400">Memory, Focus, & Reaction</div>
                            </div>
                        </div>

                        <Button
                            size="lg"
                            onClick={startSession}
                            disabled={loading}
                            className="w-full text-xl h-16 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-xl shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:-translate-y-1 transition-all rounded-xl border border-white/10"
                        >
                            {loading ? 'Initializing Environment...' : 'Start Assessment Session'}
                        </Button>
                        <p className="text-center text-xs text-slate-500 font-medium tracking-wide uppercas">
                            Grant camera access when prompted • Results processed locally
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const ActiveGame = selectedGames[currentGameIndex]?.component

    return (
        <div className="h-screen w-screen mesh-bg overflow-hidden p-4 md:p-6 lg:p-8 flex gap-6 relative text-slate-200">
            {/* LEFT COLUMN: GAME AREA */}
            <div className="flex-1 flex flex-col h-full gap-6 relative z-10">

                {/* Header / Progress */}
                <div className="flex justify-between items-center bg-black/40 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/5 animate-slide-up">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
                            {selectedGames[currentGameIndex]?.emoji}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{selectedGames[currentGameIndex]?.name}</h2>
                            <p className="text-sm text-slate-400">{selectedGames[currentGameIndex]?.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/5">
                        <div className="flex gap-2">
                            {selectedGames.map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-3 h-3 rounded-full transition-all duration-300",
                                        i === currentGameIndex ? "bg-indigo-500 scale-125 shadow-glow" :
                                            i < currentGameIndex ? "bg-emerald-500" : "bg-white/20"
                                    )}
                                />
                            ))}
                        </div>
                        <span className="text-xs font-bold font-mono text-slate-500 uppercase tracking-widest pl-2 border-l border-white/10">
                            Step {currentGameIndex + 1}/4
                        </span>
                    </div>
                </div>

                {/* GAME CONTAINER */}
                <div className="flex-1 relative bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col animate-scale-in" style={{ animationDelay: '100ms' }}>
                    {gameState === 'playing' && ActiveGame && (
                        <div className="flex-1 flex flex-col">
                            {/* Pass a theme prop or wrap in context if games need to adjust colors, but for most we assume they inherit text color or use their own */}
                            <ActiveGame onComplete={handleGameComplete} />
                        </div>
                    )}

                    {gameState === 'transition' && (
                        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-500 text-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-2xl shadow-emerald-500/40 animate-bounce-slow">
                                ✓
                            </div>
                            <h2 className="text-3xl font-extrabold text-white mb-2">Task Completed!</h2>
                            <p className="text-slate-400 text-lg mb-8">Take a deep breath...</p>
                            <Button
                                onClick={proceedToNextGame}
                                size="lg"
                                className="w-56 h-14 text-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl hover:scale-105 transition-all outline-none border-none"
                            >
                                Next Challenge →
                            </Button>
                        </div>
                    )}

                    {gameState === 'saving' && (
                        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                            <div className="bg-black/80 p-6 rounded-2xl shadow-2xl flex items-center gap-4 border border-indigo-500/50 animate-float text-white">
                                <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                <span className="font-bold text-lg">Analyzing Performance...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT COLUMN: METRICS */}
            <div className="w-[360px] flex flex-col gap-6 relative z-10 animate-slide-up" style={{ animationDelay: '200ms' }}>

                {/* Camera Feed */}
                <Card className="overflow-hidden border-none shadow-xl rounded-2xl bg-black/60 border border-white/10">
                    <CardHeader className="p-4 bg-black/60 backdrop-blur-md border-b border-white/10 flex flex-row justify-between items-center absolute top-0 left-0 right-0 z-10">
                        <span className="text-xs font-bold text-white/80 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            Live Bio-Metrics
                        </span>
                    </CardHeader>
                    <div className="aspect-[4/3] bg-black relative">
                        <FaceTracking ref={faceTrackingRef} onStressUpdate={handleStressUpdate} />
                    </div>
                </Card>

                {/* Real-time Stress Graph */}
                <Card variant="neo" className="flex-1 flex flex-col border-white/10 shadow-lg bg-black/20">
                    <CardHeader className="p-5 border-b border-white/10">
                        <CardTitle className="text-sm font-bold text-slate-400 flex justify-between items-center">
                            <span className="uppercase tracking-wider">Stress Index</span>
                            <span className={cn(
                                "text-3xl font-black transition-colors duration-500",
                                !currentStress ? "text-slate-600" :
                                    currentStress < 40 ? "text-emerald-400" :
                                        currentStress < 70 ? "text-amber-400" : "text-rose-500"
                            )}>
                                {currentStress ? Math.round(currentStress) : '--'}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 relative min-h-[180px]">
                        <div className="absolute inset-0 p-4">
                            <Line data={chartData} options={chartOptions} />
                        </div>
                        {/* Overlay gradient for depth */}
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-indigo-900 to-violet-900 text-white border border-white/10 shadow-xl shadow-indigo-900/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform duration-700" />
                    <CardContent className="p-6 relative z-10">
                        <div className="text-xs opacity-70 mb-2 uppercase tracking-widest font-bold text-indigo-200">Session Status</div>
                        <div className="font-bold text-xl mb-4 text-white">High-Precision Recording</div>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-semibold transition-colors cursor-default border border-white/5">👀 Gaze Tracking</span>
                            <span className="px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-semibold transition-colors cursor-default border border-white/5">⚡ Response Time</span>
                            <span className="px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-semibold transition-colors cursor-default border border-white/5">🧠 Focus Load</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
