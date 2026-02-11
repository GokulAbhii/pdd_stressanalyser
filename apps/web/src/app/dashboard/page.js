'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import AnimatedIcon from '@/components/ui/AnimatedIcon'

export default function DashboardPage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const token = localStorage.getItem('token')
        const userData = localStorage.getItem('user')

        if (!token || !userData) {
            router.push('/login')
            return
        }

        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        fetchSessions(parsedUser.id)

        // Real-time polling every 3 seconds
        const interval = setInterval(() => {
            fetchSessions(parsedUser.id)
        }, 3000)

        return () => clearInterval(interval)
    }, [router])

    const fetchSessions = async (userId) => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/v1/stress/user/${userId}/history`)
            if (response.ok) {
                const data = await response.json()
                // Only update if length changed to prevent unnecessary re-renders causing jitter, 
                // or just update always for simple values. 
                // Since we want realtime updates of new sessions, let's just set it.
                // Comparing length might be a simple optimization but let's just set it for now 
                // to ensure avgStress updates too.
                setSessions(data)
            }
        } catch (error) {
            console.error('Error fetching sessions:', error)
        } finally {
            setLoading(false)
        }
    }

    // Fix: Ensure numbers are parsed to prevent string concatenation
    const avgStress = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (Number(s.avg_stress) || 0), 0) / sessions.length
        : 0

    const getStressLevel = (stress) => {
        if (stress < 30) return { label: 'Optimal', color: 'text-emerald-400', badgeInfo: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' }
        if (stress < 70) return { label: 'Moderate', color: 'text-amber-400', badgeInfo: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' }
        return { label: 'High', color: 'text-red-400', badgeInfo: 'bg-red-500/20 text-red-300 border border-red-500/30' }
    }

    const overallStatus = getStressLevel(avgStress)
    const wellnessScore = Math.max(0, 100 - avgStress)

    if (!user) return null

    return (
        <DashboardLayout>
            <div className="space-y-8 animate-in fade-in duration-700">
                <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
                    <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200 drop-shadow-sm">Welcome back, {user.name}</h2>
                    <p className="text-lg text-slate-400 font-medium mt-2 max-w-2xl">
                        Your cognitive health metrics are ready. System status is <span className="text-emerald-400 font-bold">Optimal</span>.
                    </p>
                </div>

                {/* Stats Grid - Neo Boxed Design */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

                    {/* Total Sessions */}
                    <Card variant="neo" className="animate-slide-up relative overflow-hidden" style={{ animationDelay: '100ms' }}>
                        <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Total Sessions</CardTitle>
                            <AnimatedIcon type="chart" className="scale-75" />
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 w-fit shadow-md">
                                <div className="text-4xl font-black text-white">
                                    <AnimatedCounter value={sessions.length} />
                                </div>
                            </div>
                            <p className="text-sm font-medium text-slate-400 mt-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block animate-pulse"></span>
                                Lifetime assessments
                            </p>
                        </CardContent>
                    </Card>

                    {/* Stress Level */}
                    <Card variant="neo" className="animate-slide-up relative overflow-hidden" style={{ animationDelay: '200ms' }}>
                        <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Avg Stress</CardTitle>
                            <AnimatedIcon type="brain" className="scale-75" />
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 w-fit shadow-md">
                                <div className="text-4xl font-black text-white">
                                    <AnimatedCounter value={Math.round(avgStress)} />
                                </div>
                            </div>
                            <p className={`text-sm font-bold mt-3 inline-block px-2 py-0.5 rounded-lg ${overallStatus.badgeInfo}`}>
                                {overallStatus.label} Range
                            </p>
                        </CardContent>
                    </Card>

                    {/* Wellness Score */}
                    <Card variant="neo" className="animate-slide-up relative overflow-hidden" style={{ animationDelay: '300ms' }}>
                        <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Wellness Score</CardTitle>
                            <AnimatedIcon type="heart" className="scale-75" />
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 w-fit shadow-md">
                                <div className="text-4xl font-black text-emerald-400">
                                    <AnimatedCounter value={Math.round(wellnessScore)} />
                                </div>
                            </div>
                            <p className="text-sm font-medium text-emerald-300/70 mt-3">
                                +2% from last week
                            </p>
                        </CardContent>
                    </Card>

                    {/* System Status */}
                    <Card variant="neo" className="animate-slide-up relative overflow-hidden" style={{ animationDelay: '400ms' }}>
                        <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">System Status</CardTitle>
                            <AnimatedIcon type="energy" className="scale-75" />
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="bg-white/60 backdrop-blur-sm border border-white/50 rounded-2xl p-4 w-fit shadow-sm">
                                <div className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 uppercase tracking-tight">
                                    ONLINE
                                </div>
                            </div>
                            <p className="text-sm font-medium text-slate-600 mt-3">
                                AI Neural Net Ready
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                    {/* Main Action - Start New Session */}
                    <Card variant="vibrant" className="col-span-4 animate-slide-up relative overflow-hidden group border-0 shadow-2xl shadow-indigo-500/20" style={{ animationDelay: '500ms' }}>

                        {/* Dynamic Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 opacity-90 group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />

                        {/* Abstract shapes */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-white/20 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 group-hover:translate-x-1/3 transition-transform duration-700 ease-in-out pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/2 animate-pulse-slow pointer-events-none" />

                        <CardHeader className="relative z-10 p-8">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl mb-4 border border-white/20 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                                🚀
                            </div>
                            <CardTitle className="text-4xl text-white font-black tracking-tight drop-shadow-md">Start New Assessment</CardTitle>
                            <CardDescription className="text-indigo-100 text-lg font-medium max-w-lg mt-2">
                                Launch a 4-game cognitive sequence to measure your stress levels using advanced biometric analysis.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="relative z-10 p-8 pt-0">
                            <Button
                                size="lg"
                                className="w-full sm:w-auto text-lg h-16 px-8 bg-white text-indigo-600 hover:bg-slate-100 hover:text-indigo-700 font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-xl"
                                onClick={() => router.push('/play')}
                            >
                                Launch Session &rarr;
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Recent History */}
                    <Card variant="neo" className="col-span-3 animate-slide-up bg-white/5" style={{ animationDelay: '600ms' }}>
                        <CardHeader>
                            <CardTitle className="text-xl font-bold text-white">Recent Activity</CardTitle>
                            <CardDescription className="text-slate-400 font-medium">
                                Your last 3 stress assessment results.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {loading ? (
                                    <div className="text-sm text-slate-400 animate-pulse p-4 text-center">Loading history...</div>
                                ) : sessions.length === 0 ? (
                                    <div className="text-sm text-slate-400 p-4 text-center bg-white/5 rounded-xl border border-white/10">No sessions recorded yet.</div>
                                ) : (
                                    sessions.slice(0, 5).map((session, i) => (
                                        <div
                                            key={session.id}
                                            onClick={() => router.push(`/report?session=${session.id}`)}
                                            className="group flex items-center justify-between cursor-pointer hover:bg-white/10 p-3 rounded-xl transition-all duration-300 border border-transparent hover:border-white/10 hover:shadow-md"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm border border-indigo-500/30 group-hover:scale-110 transition-transform">
                                                    #{session.id.toString().slice(-3)}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">Cognitive Check</p>
                                                    <p className="text-xs text-slate-400 font-medium">{new Date(session.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className={`text-sm font-black px-3 py-1.5 rounded-lg border ${getStressLevel(session.avg_stress).badgeInfo}`}>
                                                {session.avg_stress?.toFixed(0)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    )
}
