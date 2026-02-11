'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import AnimatedIcon from '@/components/ui/AnimatedIcon'

function ReportContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const sessionId = searchParams.get('session')

    const [report, setReport] = useState(null)
    const [sessionData, setSessionData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!sessionId) {
            router.push('/dashboard')
            return
        }
        fetchReport()
    }, [sessionId, router])

    const fetchReport = async () => {
        try {
            // Fetch session data first
            const sessionResponse = await fetch(
                `http://127.0.0.1:8000/api/v1/stress/session/${sessionId}`
            )

            if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json()
                setSessionData(sessionData)
            }

            // Generate report if not exists
            const generateResponse = await fetch(
                `http://127.0.0.1:8000/api/v1/reports/generate/${sessionId}`,
                { method: 'POST' }
            )

            if (!generateResponse.ok) {
                // Try to fetch existing report
                const fetchResponse = await fetch(
                    `http://127.0.0.1:8000/api/v1/reports/session/${sessionId}/report`
                )

                if (!fetchResponse.ok) {
                    throw new Error('Failed to load report')
                }

                const data = await fetchResponse.json()
                setReport(data)
            } else {
                const data = await generateResponse.json()
                console.log('Report generated:', data.overall_stress)
                setReport(data)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const downloadPDF = async () => {
        try {
            const response = await fetch(
                `http://127.0.0.1:8000/api/v1/reports/${report.id}/pdf`
            )
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `stress_report_${report.id}_${new Date().toISOString().split('T')[0]}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error('Error downloading PDF:', error)
            alert('Failed to download PDF')
        }
    }

    const parseJSON = (str) => {
        try {
            return JSON.parse(str)
        } catch {
            return []
        }
    }

    const getStressColor = (level) => {
        if (level === 'Low') return 'text-emerald-600 bg-emerald-100 border-emerald-200'
        if (level === 'Medium') return 'text-amber-600 bg-amber-100 border-amber-200'
        return 'text-red-600 bg-red-100 border-red-200'
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center min-h-[50vh]">
                <div className="text-center space-y-4">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-pulse"></div>
                        <div className="absolute inset-2 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-slate-600 font-medium animate-pulse">Generating comprehensive analysis...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex bg-red-50 p-6 rounded-2xl border border-red-200 text-red-900 items-center justify-between shadow-xl">
                <div>
                    <h3 className="font-bold text-lg mb-1">Error Loading Report</h3>
                    <p>{error}</p>
                </div>
                <Button onClick={() => router.push('/dashboard')} variant="destructive" className="shadow-lg">Return to Dashboard</Button>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 pb-6 border-b border-indigo-500/30">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-500/30">
                        Confidential Report
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white">Stress Analysis Report</h1>
                    <p className="text-slate-400 font-medium text-lg">
                        Session #{sessionId} • {new Date(report.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={downloadPDF} variant="outline" className="border-indigo-500/50 hover:bg-indigo-500/20 text-indigo-300">
                        Download PDF
                    </Button>
                    <Button onClick={() => router.push('/dashboard')} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/50">
                        Dashboard
                    </Button>
                </div>
            </div>

            {/* Overall Assessment - Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card variant="neo" className="lg:col-span-2 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl pointer-events-none" />
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-white">Overall Assessment</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-8 relative z-10">
                        <div className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl border border-white/20 shadow-sm text-center overflow-hidden">
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Stress Score</p>
                            <div className="text-5xl font-black text-indigo-400 mb-2 w-full truncate px-2" title={report.overall_stress}>
                                <AnimatedCounter
                                    key={`score-${Math.min(100, Number(report.overall_stress) || 0)}`}
                                    value={Math.min(100, Number(report.overall_stress) || 0)}
                                />
                            </div>
                            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden flex-shrink-0">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-1000"
                                    style={{ width: `${Math.min(100, Number(report.overall_stress))}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl border border-white/20 shadow-sm text-center">
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Stress Level</p>
                            <span className={cn("px-4 py-2 rounded-xl text-lg font-bold border-2 shadow-sm inline-block my-2", getStressColor(report.stress_level))}>
                                {report.stress_level}
                            </span>
                        </div>

                        <div className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl border border-white/20 shadow-sm text-center">
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Trend</p>
                            <div className="text-3xl font-bold my-2 bg-clip-text text-transparent bg-gradient-to-r from-slate-200 to-slate-400">
                                {report.stress_trend === 'Increasing' ? '📈 Rising' :
                                    report.stress_trend === 'Decreasing' ? '📉 Falling' : '➡️ Stable'}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* AI Insight */}
                <Card variant="vibrant" className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-0 shadow-xl shadow-indigo-500/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <span className="text-2xl animate-pulse">🤖</span>
                            AI Insight
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-indigo-100 text-lg leading-relaxed font-medium">
                            Based on your facial micro-expressions and reaction times, your stress response appears to be
                            <span className="text-white font-bold"> {report.stress_level.toLowerCase()}</span>.
                            {report.stress_level === 'High' ? " Immediate relaxation techniques recommended." : " You are maintaining good cognitive balance."}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Game Performance */}
            {sessionData?.games?.length > 0 && (
                <Card variant="neo" className="overflow-hidden">
                    <CardHeader className="bg-white/5 border-b border-white/10">
                        <CardTitle className="text-lg font-bold text-slate-200">Detailed Performance Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider text-left">
                                    <tr>
                                        <th className="p-4">Activity</th>
                                        <th className="p-4">Duration</th>
                                        <th className="p-4">Score</th>
                                        <th className="p-4">Avg Stress</th>
                                        <th className="p-4">Peak Stress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {sessionData.games.map((game, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors text-slate-300">
                                            <td className="p-4 font-bold text-white">{game.game_name}</td>
                                            <td className="p-4 text-slate-400 font-mono">{game.duration.toFixed(1)}s</td>
                                            <td className="p-4 font-bold text-indigo-400">{game.score.toFixed(0)}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-16 bg-slate-700 rounded-full overflow-hidden">
                                                        <div className="h-full bg-amber-500" style={{ width: `${game.avg_stress}%` }} />
                                                    </div>
                                                    <span className="text-xs font-medium">{game.avg_stress.toFixed(0)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs font-medium text-slate-400">{game.max_stress.toFixed(0)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recommendations Grid */}
            <div>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <span className="text-3xl text-emerald-500">✨</span> Personalized Recommendations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <RecommendationCard title="Recommended Activities" icon="tree" items={parseJSON(report.activities)} delay="100ms" />
                    <RecommendationCard title="Workout Plan" icon="workout" items={parseJSON(report.workouts)} delay="200ms" />
                    <RecommendationCard title="Meditation" icon="meditate" items={parseJSON(report.meditation)} delay="300ms" />
                    <RecommendationCard title="Nutrition" icon="food" items={parseJSON(report.food_control)} delay="400ms" />
                </div>
            </div>

            <div className="p-4 bg-amber-950/30 text-amber-200 rounded-xl border border-amber-500/30 text-sm font-medium flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <span><strong>Disclaimer:</strong> This report is AI-generated based on facial analysis. It is not a medical diagnosis. Please consult a healthcare professional for medical advice.</span>
            </div>
        </div>
    )
}

function RecommendationCard({ title, icon, items, delay }) {
    const getIcon = () => {
        if (icon === 'tree') return '🌳'
        if (icon === 'workout') return '💪'
        if (icon === 'meditate') return '🧘'
        if (icon === 'food') return '🥗'
        return '✨'
    }

    return (
        <Card variant="neo" className="animate-slide-up hover:scale-[1.02] transition-transform duration-300" style={{ animationDelay: delay }}>
            <CardHeader className="flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xl shadow-sm border border-indigo-500/30">
                    {getIcon()}
                </div>
                <CardTitle className="text-lg font-bold text-slate-200">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {items.map((item, idx) => (
                        <li key={idx} className="flex gap-3 items-start p-3 rounded-lg hover:bg-white/5 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0"></span>
                            <span className="text-slate-400 font-medium text-sm leading-relaxed">{item}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    )
}

export default function ReportPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={<div className="flex h-screen items-center justify-center text-indigo-500 font-bold animate-pulse">Loading Report Interface...</div>}>
                <ReportContent />
            </Suspense>
        </DashboardLayout>
    )
}
