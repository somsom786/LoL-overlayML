import React from 'react';
import type { MLPrediction } from '../services/MLService';

interface Props {
    prediction: MLPrediction | null;
    isMLOnline: boolean;
}

export const WinProbabilityMeter: React.FC<Props> = ({ prediction, isMLOnline }) => {
    const winProb = prediction?.win_prob ?? 0.5;
    const pct = Math.round(winProb * 100);

    // Color: red(0%) → gold(50%) → green(100%)
    const hue = winProb * 120; // 0=red, 60=yellow, 120=green
    const arcColor = `hsl(${hue}, 80%, 55%)`;

    // SVG arc: 180 degrees, centered
    const radius = 28;
    const cx = 34;
    const cy = 34;
    const circumference = Math.PI * radius;
    const strokeDashoffset = circumference * (1 - winProb);

    const confidence = prediction?.model_confidence ?? 0;
    const confLabel = confidence > 0.6 ? 'HIGH' : confidence > 0.3 ? 'MED' : 'LOW';

    return (
        <div className="lol-panel rounded-l-md w-[220px] animate-slide-in overflow-hidden">
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-gold-dim/20 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-lolgreen to-lolgreen/30" />
                    <h2 className="text-[8px] font-bold uppercase tracking-[0.2em] text-lolgreen/80">
                        Win Prob
                    </h2>
                </div>
                <div className="flex items-center gap-1">
                    <div className={`w-1 h-1 rounded-full ${isMLOnline ? 'bg-lolgreen' : 'bg-lolorange'} animate-pulse`} />
                    <span className="text-[6px] font-mono text-gold-text/20 uppercase">
                        {isMLOnline ? 'ML' : 'RULE'}
                    </span>
                </div>
            </div>

            <div className="px-3 py-2 flex items-center gap-3">
                {/* Arc gauge */}
                <div className="relative flex-shrink-0">
                    <svg width="68" height="40" viewBox="0 0 68 40">
                        {/* Background arc */}
                        <path
                            d={describeArc(cx, cy, radius, 180, 360)}
                            fill="none"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="4"
                            strokeLinecap="round"
                        />
                        {/* Value arc */}
                        <path
                            d={describeArc(cx, cy, radius, 180, 180 + 180 * winProb)}
                            fill="none"
                            stroke={arcColor}
                            strokeWidth="4"
                            strokeLinecap="round"
                            style={{
                                filter: `drop-shadow(0 0 4px ${arcColor})`,
                                transition: 'all 0.7s ease-out',
                            }}
                        />
                    </svg>
                    {/* Percentage text */}
                    <div className="absolute inset-0 flex items-end justify-center pb-0.5">
                        <span
                            className="text-[16px] font-black tabular-nums"
                            style={{ color: arcColor, transition: 'color 0.7s ease-out' }}
                        >
                            {pct}
                        </span>
                        <span className="text-[8px] font-bold text-gold-text/30 ml-0.5 mb-0.5">%</span>
                    </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    {/* Spike status */}
                    {prediction?.spike_status && prediction.spike_status !== 'none' && (
                        <div className={`flex items-center gap-1 mb-1 ${prediction.spike_status === 'active' ? 'text-lolgreen' :
                                prediction.spike_status === 'approaching' ? 'text-lolorange' :
                                    'text-gold-text/30'
                            }`}>
                            <span className="text-[7px] font-black uppercase tracking-wider">
                                {prediction.spike_status === 'active' ? '⚡ SPIKE ACTIVE' :
                                    prediction.spike_status === 'approaching' ? '📈 SPIKE NEAR' :
                                        '📉 SPIKE PAST'}
                            </span>
                        </div>
                    )}

                    {/* Spike window */}
                    {prediction?.spike_window && prediction?.spike_window !== 'N/A' && (
                        <p className="text-[7px] text-gold-text/30 leading-snug truncate">
                            {prediction.spike_window}
                        </p>
                    )}

                    {/* Confidence */}
                    <div className="flex items-center gap-1 mt-1">
                        <span className="text-[6px] text-gold-text/15">CONF:</span>
                        <span className={`text-[6px] font-bold ${confidence > 0.6 ? 'text-lolgreen/60' : 'text-gold-text/25'
                            }`}>{confLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── SVG Arc Helper ──────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default WinProbabilityMeter;
