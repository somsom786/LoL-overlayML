import React, { useEffect, useState } from 'react';
import type { PerformanceBenchmark } from '../types';

export const PerformanceGauge: React.FC<{ benchmark: PerformanceBenchmark | null }> = ({ benchmark }) => {
    if (!benchmark) return null;

    return (
        <div className="flex items-center gap-3">
            <MiniGauge label="CS" value={benchmark.csPerMin} score={benchmark.csScore} />
            <MiniGauge label="G/m" value={benchmark.goldPerMin} score={benchmark.goldScore} />
        </div>
    );
};

const MiniGauge: React.FC<{ label: string; value: number; score: number }> = ({ label, value, score }) => {
    const [anim, setAnim] = useState(0);
    useEffect(() => {
        const start = performance.now(), s = anim, dur = 900;
        function run(now: number) {
            const p = Math.min((now - start) / dur, 1);
            setAnim(Math.round(s + (score - s) * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(run);
        }
        requestAnimationFrame(run);
    }, [score]);

    const sz = 44, sw = 3.5, r = (sz - sw) / 2;
    const circ = 2 * Math.PI * r;
    const off = circ - (anim / 100) * circ;
    const col = anim >= 67 ? '#0ACE83' : anim >= 34 ? '#F5A623' : '#E84057';
    const tag = anim >= 67 ? 'AHEAD' : anim >= 34 ? 'AVG' : 'LOW';

    return (
        <div className="flex flex-col items-center gap-0.5">
            <div className="relative" style={{ width: sz, height: sz }}>
                <svg width={sz} height={sz} className="transform -rotate-90">
                    <circle cx={sz / 2} cy={sz / 2} r={r} className="gauge-track" />
                    <circle cx={sz / 2} cy={sz / 2} r={r} className="gauge-fill"
                        stroke={col} strokeDasharray={circ} strokeDashoffset={off}
                        style={{ filter: `drop-shadow(0 0 3px ${col}40)` }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black font-mono text-gold-light">{value}</span>
                </div>
            </div>
            <span className="text-[7px] font-bold uppercase tracking-wider text-gold-text/40">{label}</span>
            <span className="text-[6px] font-black uppercase" style={{ color: col }}>{tag}</span>
        </div>
    );
};

export default PerformanceGauge;
