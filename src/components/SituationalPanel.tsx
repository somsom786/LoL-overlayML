import React from 'react';
import type { ThreatAssessment, ItemRecommendation } from '../types';
import { ThreatBadge } from './ThreatBadge';

interface Props {
    threats: ThreatAssessment[];
    recommendations: ItemRecommendation[];
}

const REASON_COLORS: Record<string, string> = {
    'Magic Resist': 'text-purple-300 bg-purple-500/10 border-purple-500/25',
    'Armor': 'text-lolerr-red bg-lolerr-red/10 border-lolerr-red/25',
    'Armor Pen': 'text-lolteal bg-lolteal/10 border-lolteal/25',
    'Anti-Heal': 'text-lolgreen bg-lolgreen/10 border-lolgreen/25',
    'Counter': 'text-lolorange bg-lolorange/10 border-lolorange/25',
};

export const SituationalPanel: React.FC<Props> = ({ threats, recommendations }) => {
    if (threats.length === 0 && recommendations.length === 0) return null;

    return (
        <div className="lol-panel rounded-l-md w-[220px] animate-slide-in overflow-hidden">
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-gold-dim/20 flex items-center gap-1.5">
                <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-gold to-gold-dim/30" />
                <h2 className="text-[8px] font-bold uppercase tracking-[0.2em] text-gold">Intel</h2>
            </div>

            {/* Threats */}
            {threats.length > 0 && (
                <div className="px-3 py-2 border-b border-lol-border/50">
                    <div className="flex flex-wrap gap-1 mb-1.5">
                        {threats.map((t, i) => <ThreatBadge key={i} threat={t} />)}
                    </div>
                    <div className="space-y-0.5">
                        {threats.map((t, i) => (
                            <p key={i} className="text-[8px] text-gold-text/35 leading-snug">
                                {t.icon} {t.description}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* Items */}
            {recommendations.length > 0 && (
                <div className="px-3 py-2">
                    <h3 className="text-[7px] font-bold uppercase tracking-[0.2em] text-gold-text/25 mb-1.5">Build</h3>
                    <div className="space-y-1">
                        {recommendations.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                                <div className="relative w-7 h-7 rounded-sm overflow-hidden border border-gold-dim/30 bg-lol-panel flex-shrink-0">
                                    <img src={item.iconUrl} alt="" className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    <div className="absolute -top-px -right-px w-3 h-3 rounded-bl-sm bg-gold flex items-center justify-center">
                                        <span className="text-[6px] font-black text-lol-dark">{item.priority}</span>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-semibold text-gold-light/80 truncate">{item.itemName}</span>
                                        <span className="text-[8px] font-mono font-medium text-gold-dim flex-shrink-0">{item.goldCost}g</span>
                                    </div>
                                    <span className={`inline-block text-[6px] font-bold uppercase tracking-wider px-1 py-px rounded border mt-0.5
                    ${REASON_COLORS[item.reason] || REASON_COLORS['Counter']}`}>
                                        {item.reason}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SituationalPanel;
