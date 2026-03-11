import React from 'react';
import type { JungleState } from '../engine/JungleTracker';

const URGENCY_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
    IMMINENT: { bg: 'bg-lolerr-red/15', border: 'border-lolerr-red/40', text: 'text-lolerr-red', label: '⚠️ GANK IMMINENT' },
    LIKELY: { bg: 'bg-lolorange/10', border: 'border-lolorange/30', text: 'text-lolorange', label: '⚠ GANK LIKELY' },
    POSSIBLE: { bg: 'bg-gold-dim/10', border: 'border-gold-dim/20', text: 'text-gold', label: '👁 GANK POSSIBLE' },
};

const THREAT_COLORS: Record<string, string> = {
    LOW: 'text-lolgreen',
    MEDIUM: 'text-lolorange',
    HIGH: 'text-lolerr-red',
    GANKING: 'text-lolerr-red',
};

const QUADRANT_LABELS: Record<string, string> = {
    TOP_BLUE: '↗ Top Blue',
    TOP_RED: '↗ Top Red',
    BOT_BLUE: '↘ Bot Blue',
    BOT_RED: '↘ Bot Red',
    UNKNOWN: '? Unknown',
};

export const JungleAlert: React.FC<{ jungle: JungleState | null }> = ({ jungle }) => {
    if (!jungle || !jungle.isTrackable) return null;

    return (
        <div className="lol-panel rounded-l-md w-[220px] animate-slide-in overflow-hidden">
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-gold-dim/20 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-lolerr-red to-lolerr-red/30" />
                    <h2 className="text-[8px] font-bold uppercase tracking-[0.2em] text-lolerr-red/80">
                        JG Track
                    </h2>
                </div>
                <span className={`text-[7px] font-bold uppercase ${THREAT_COLORS[jungle.threatLevel]}`}>
                    {jungle.threatLevel}
                </span>
            </div>

            <div className="px-3 py-2">
                {/* Jungler identity + position */}
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-semibold text-gold-light/80">{jungle.enemyJungler}</span>
                    <span className="text-[8px] font-mono text-gold-text/30">
                        {jungle.timeSinceSeen > 0 ? `${jungle.timeSinceSeen}s ago` : '—'}
                    </span>
                </div>

                {/* Estimated position */}
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[8px] text-gold-text/40">Position:</span>
                    <span className="text-[8px] font-semibold text-gold">
                        {QUADRANT_LABELS[jungle.estimatedQuadrant]}
                    </span>
                </div>

                {/* Pathing */}
                <p className="text-[7px] text-gold-text/30 leading-snug mb-1.5">
                    {jungle.pathing}
                </p>

                {/* Gank Warning */}
                {jungle.gankWarning && (
                    <div className={`
            px-2 py-1.5 rounded border
            ${URGENCY_STYLES[jungle.gankWarning.urgency].bg}
            ${URGENCY_STYLES[jungle.gankWarning.urgency].border}
            ${jungle.gankWarning.urgency === 'IMMINENT' ? 'animate-pulse-glow' : ''}
          `}>
                        <div className="flex items-center justify-between">
                            <span className={`text-[8px] font-black uppercase tracking-wider
                ${URGENCY_STYLES[jungle.gankWarning.urgency].text}`}>
                                {URGENCY_STYLES[jungle.gankWarning.urgency].label}
                            </span>
                            <span className="text-[7px] font-mono text-gold-text/30">
                                ~{jungle.gankWarning.eta}s
                            </span>
                        </div>
                        <p className="text-[7px] text-gold-text/40 mt-0.5">
                            {jungle.gankWarning.reason}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JungleAlert;
