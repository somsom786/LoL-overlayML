import React from 'react';
import type { ThreatAssessment } from '../types';

const COLORS: Record<string, { badge: string; text: string }> = {
    HIGH_MAGIC_THREAT: { badge: 'border-purple-400/60 bg-purple-500/10', text: 'text-purple-300' },
    HIGH_PHYSICAL_THREAT: { badge: 'border-lolerr-red/50 bg-lolerr-red/10', text: 'text-lolerr-red' },
    TANK_THREAT: { badge: 'border-lolteal/40 bg-lolteal/10', text: 'text-lolteal' },
    HEALING_THREAT: { badge: 'border-lolgreen/50 bg-lolgreen/10', text: 'text-lolgreen' },
    MIXED_THREAT: { badge: 'border-lolorange/50 bg-lolorange/10', text: 'text-lolorange' },
};

export const ThreatBadge: React.FC<{ threat: ThreatAssessment }> = ({ threat }) => {
    const c = COLORS[threat.type] || COLORS.MIXED_THREAT;
    const lvl = threat.level === 'critical' ? 'CRIT' : threat.level === 'high' ? 'HIGH' : 'MOD';
    const pulse = threat.level === 'critical' ? 'animate-pulse-glow' : '';

    return (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${c.badge} ${pulse}`}>
            <span className="text-[10px]">{threat.icon}</span>
            <span className={`text-[8px] font-bold uppercase tracking-widest ${c.text}`}>
                {threat.type.replace(/_/g, ' ').replace('HIGH ', '')}
            </span>
            <span className={`text-[7px] font-black uppercase px-1 rounded
        ${threat.level === 'critical' ? 'bg-lolerr-red/20 text-lolerr-red' :
                    threat.level === 'high' ? 'bg-lolorange/20 text-lolorange' :
                        'bg-white/5 text-gold-text'}`}>
                {lvl}
            </span>
        </div>
    );
};

export default ThreatBadge;
