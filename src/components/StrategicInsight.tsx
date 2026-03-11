import React from 'react';
import type { MLPrediction } from '../services/MLService';

const COMEBACK_LABELS: Record<string, { icon: string; label: string }> = {
    focus_baron: { icon: '🐲', label: 'Force Baron' },
    pick_carry: { icon: '🎯', label: 'Catch their carry' },
    split_push: { icon: '🗡️', label: 'Split-push pressure' },
    teamfight_at_objective: { icon: '⚔️', label: 'Fight at objective' },
    stall_and_scale: { icon: '📈', label: 'Stall & outscale' },
};

interface Props {
    prediction: MLPrediction | null;
}

export const StrategicInsight: React.FC<Props> = ({ prediction }) => {
    if (!prediction) return null;

    const { comeback_path, comeback_prob, win_prob } = prediction;

    // Only show when behind
    if (!comeback_path || win_prob > 0.45) return null;

    const action = COMEBACK_LABELS[comeback_path] || { icon: '💡', label: comeback_path };
    const cbPct = Math.round(comeback_prob * 100);

    return (
        <div className="lol-panel rounded-l-md w-[220px] animate-slide-in overflow-hidden">
            <div className="px-3 py-1.5 border-b border-gold-dim/20 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-lolorange to-lolorange/30" />
                    <h2 className="text-[8px] font-bold uppercase tracking-[0.2em] text-lolorange/80">
                        Comeback
                    </h2>
                </div>
                <span className="text-[7px] font-mono text-gold-text/25">
                    {cbPct}% chance
                </span>
            </div>

            <div className="px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{action.icon}</span>
                    <span className="text-[9px] font-bold text-gold-light/80">{action.label}</span>
                </div>

                {/* Comeback probability bar */}
                <div className="w-full h-1 bg-white/5 rounded-full">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-lolerr-red to-lolorange transition-all duration-1000"
                        style={{ width: `${cbPct}%` }}
                    />
                </div>
                <p className="text-[7px] text-gold-text/25 mt-1">
                    {comeback_prob > 0.3
                        ? 'Comeback is realistic — execute the plan'
                        : comeback_prob > 0.15
                            ? 'Difficult but possible — play perfectly'
                            : 'Very low odds — minimize losses'}
                </p>
            </div>
        </div>
    );
};

export default StrategicInsight;
