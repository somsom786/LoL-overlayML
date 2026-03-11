import React, { useEffect, useState, useCallback, useRef } from 'react';
import type {
    LiveGameData, GoldDifferential, ThreatAssessment,
    ItemRecommendation, PerformanceBenchmark as PerfBenchmark,
} from './types';
import { subscribe, startPolling, getSource } from './services/DataService';
import { initDataDragon, getVersion } from './services/DataDragonService';
import { calculateGoldGap } from './engine/GoldGapCalculator';
import { assessThreats, recommendItems } from './engine/ItemizationEngine';
import { calculatePerformance } from './engine/PerformanceBenchmark';
import { analyzeWinCondition, type WinCondition } from './engine/WinConditionEngine';
import { queryMLHub, isMLOnline, type MLPrediction } from './services/MLService';
import { getSnapshotCount } from './services/MatchRecorder';
import { GoldDiffBar } from './components/GoldDiffBar';
import { SituationalPanel } from './components/SituationalPanel';
import { PerformanceGauge } from './components/PerformanceGauge';
import { WinConditionPanel } from './components/WinConditionPanel';
import { WinProbabilityMeter } from './components/WinProbabilityMeter';
import { StrategicInsight } from './components/StrategicInsight';

const ML_QUERY_INTERVAL = 30_000; // 30 seconds

const App: React.FC = () => {
    const [gameData, setGameData] = useState<LiveGameData | null>(null);
    const [goldDiff, setGoldDiff] = useState<GoldDifferential | null>(null);
    const [threats, setThreats] = useState<ThreatAssessment[]>([]);
    const [recommendations, setRecommendations] = useState<ItemRecommendation[]>([]);
    const [performance, setPerformance] = useState<PerfBenchmark | null>(null);
    const [winCondition, setWinCondition] = useState<WinCondition | null>(null);
    const [mlPrediction, setMLPrediction] = useState<MLPrediction | null>(null);
    const [dataSource, setDataSource] = useState<string>('mock');
    const [isVisible, setIsVisible] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const frameRef = useRef<number>(0);
    const lastMLQuery = useRef<number>(0);

    // ─── Init ──────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            await initDataDragon();
            setIsInitialized(true);
            startPolling();
        })();
    }, []);

    // ─── Alt+F10 Toggle ──────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'F10') { e.preventDefault(); setIsVisible((v) => !v); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ─── Subscribe ─────────────────────────────────────────────────
    useEffect(() => {
        if (!isInitialized) return;
        const unsub = subscribe((data: LiveGameData) => {
            setGameData(data);
            setDataSource(getSource());
            cancelAnimationFrame(frameRef.current);
            frameRef.current = requestAnimationFrame(() => processGameData(data));
        });
        return () => { unsub(); cancelAnimationFrame(frameRef.current); };
    }, [isInitialized]);

    const processGameData = useCallback((data: LiveGameData) => {
        try {
            // Gold
            const gap = calculateGoldGap(data);
            setGoldDiff(gap);

            // Threats + Items
            const detectedThreats = assessThreats(data);
            setThreats(detectedThreats);
            const user = data.allPlayers.find((p) => p.summonerName === data.activePlayer.summonerName);
            if (user) {
                setRecommendations(recommendItems(
                    detectedThreats, data.activePlayer.championName,
                    user.items.map((i) => i.itemID), getVersion(),
                ));
            }

            // Performance
            setPerformance(calculatePerformance(data));

            // Win Condition (rule-based — always runs)
            setWinCondition(analyzeWinCondition(data));

            // ML Prediction (every 30s — async, non-blocking)
            const now = Date.now();
            if (now - lastMLQuery.current > ML_QUERY_INTERVAL) {
                lastMLQuery.current = now;
                queryMLHub({
                    gameTime: data.gameData.gameTime,
                    gamePhase: data.gameData.gameTime < 840 ? 'EARLY' : data.gameData.gameTime < 1680 ? 'MID' : 'LATE',
                    allyGold: gap?.allyTeamGold?.reduce((s, p) => s + p.totalEstimatedGold, 0) ?? 0,
                    enemyGold: gap?.enemyTeamGold?.reduce((s, p) => s + p.totalEstimatedGold, 0) ?? 0,
                    goldDiff: gap?.teamGoldDiff ?? 0,
                    goldDiffPerMin: data.gameData.gameTime > 0 ? (gap?.teamGoldDiff ?? 0) / (data.gameData.gameTime / 60) : 0,
                    allyKills: data.allPlayers.filter(p => p.team === (user?.team ?? 'ORDER')).reduce((s, p) => s + p.scores.kills, 0),
                    enemyKills: data.allPlayers.filter(p => p.team !== (user?.team ?? 'ORDER')).reduce((s, p) => s + p.scores.kills, 0),
                    killDiff: 0, // Computed server-side
                    userKills: user?.scores.kills ?? 0,
                    userDeaths: user?.scores.deaths ?? 0,
                    userAssists: user?.scores.assists ?? 0,
                    userCS: user?.scores.creepScore ?? 0,
                    userLevel: data.activePlayer.level,
                    userItemCount: user?.items.length ?? 0,
                }).then((pred) => {
                    if (pred) setMLPrediction(pred);
                });
            }
        } catch (err) {
            console.error('[App] Engine error:', err);
        }
    }, []);

    // ─── Loading ───────────────────────────────────────────────────
    if (!isInitialized || !gameData) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="lol-panel rounded-md px-5 py-3 flex items-center gap-3 animate-fade-in">
                    <div className="w-2 h-2 rounded-full bg-lolteal animate-pulse" />
                    <div>
                        <p className="text-[10px] font-semibold text-gold-light/60">Waiting for game...</p>
                        <p className="text-[8px] text-gold-text/30">Listening on 127.0.0.1:2999 · Alt+F10 to toggle</p>
                    </div>
                </div>
            </div>
        );
    }

    // ─── HUD ───────────────────────────────────────────────────────
    return (
        <div className="w-full h-full relative pointer-events-none">

            {/* Status — always visible */}
            <div className="absolute bottom-3 left-3 z-50">
                <div className="lol-panel-dark rounded-sm px-2 py-1 flex items-center gap-1.5">
                    <div className={`w-1 h-1 rounded-full ${dataSource === 'live' ? 'bg-lolgreen' : 'bg-lolorange'} animate-pulse`} />
                    <span className="text-[7px] font-mono font-medium text-gold-text/25 uppercase">
                        {dataSource} · F9
                        {getSnapshotCount() > 0 && ` · 📊${getSnapshotCount()}`}
                    </span>
                </div>
            </div>

            {/* Main HUD — togglable */}
            {isVisible && (
                <>
                    {/* Top: Gold Diff */}
                    <div className="absolute top-0 left-0 right-0 flex justify-center z-50">
                        <GoldDiffBar goldDiff={goldDiff} gameTime={gameData.gameData.gameTime} />
                    </div>

                    {/* Right: Intel stack */}
                    <div className="absolute top-12 right-0 z-40 flex flex-col gap-1.5">

                        {/* ML Win Probability */}
                        <WinProbabilityMeter prediction={mlPrediction} isMLOnline={isMLOnline()} />

                        {/* Rule-based Win Condition */}
                        <WinConditionPanel condition={winCondition} />

                        {/* ML Comeback Insight (only shows when behind) */}
                        <StrategicInsight prediction={mlPrediction} />

                        {/* Threat + Items */}
                        <SituationalPanel threats={threats} recommendations={recommendations} />

                        {/* Performance */}
                        <div className="lol-panel rounded-l-md px-3 py-2 w-[220px] animate-slide-in">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-gold-dim">Perf</span>
                                <span className="text-[6px] text-gold-text/20">vs Challenger</span>
                            </div>
                            <PerformanceGauge benchmark={performance} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default App;
