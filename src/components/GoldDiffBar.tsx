import React, { useEffect, useState, useRef } from 'react';
import type { GoldDifferential } from '../types';

interface Props {
    goldDiff: GoldDifferential | null;
    gameTime: number;
}

export const GoldDiffBar: React.FC<Props> = ({ goldDiff, gameTime }) => {
    const [teamGold, setTeamGold] = useState(0);
    const [laneGold, setLaneGold] = useState(0);
    const prevT = useRef(0);
    const prevL = useRef(0);

    useEffect(() => {
        if (!goldDiff) return;
        const tgt = goldDiff.teamGoldDiff, ltgt = goldDiff.laneGoldDiff;
        const sT = prevT.current, sL = prevL.current;
        const start = performance.now();
        const dur = 350;
        function anim(now: number) {
            const p = Math.min((now - start) / dur, 1);
            const e = 1 - Math.pow(1 - p, 3);
            setTeamGold(Math.round(sT + (tgt - sT) * e));
            setLaneGold(Math.round(sL + (ltgt - sL) * e));
            if (p < 1) requestAnimationFrame(anim);
            else { prevT.current = tgt; prevL.current = ltgt; }
        }
        requestAnimationFrame(anim);
    }, [goldDiff?.teamGoldDiff, goldDiff?.laneGoldDiff]);

    const fmt = (v: number) => { const a = Math.abs(v); return a >= 1000 ? `${(a / 1000).toFixed(1)}k` : String(a); };
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const ahead = teamGold >= 0;
    const lAhead = laneGold >= 0;

    return (
        <div className="animate-fade-in">
            <div className="lol-panel lol-accent-top rounded-b-md px-4 py-1.5 flex items-center gap-6 min-w-[380px]">
                {/* Timer */}
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-lolteal animate-pulse" />
                    <span className="text-[10px] font-mono font-medium text-gold-text/60">{fmtTime(gameTime)}</span>
                </div>

                {/* Team Gold */}
                <div className="flex items-center gap-2 flex-1 justify-center">
                    <span className={`text-[9px] uppercase tracking-widest font-semibold text-gold-dim`}>Team</span>
                    <span className={`text-sm font-black font-mono tracking-tight
            ${ahead ? 'text-gold' : 'text-lolerr-red'}`}>
                        {ahead ? '▲' : '▼'} {ahead ? '+' : '-'}{fmt(teamGold)}
                    </span>
                    {/* Mini bar */}
                    <div className="w-12 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500
              ${ahead ? 'bg-gradient-to-r from-gold-dim to-gold ml-1/2' : 'bg-gradient-to-l from-lolerr-redDim to-lolerr-red mr-auto'}`}
                            style={{ width: `${Math.min(Math.abs(teamGold) / 5000 * 100, 100)}%` }} />
                    </div>
                </div>

                {/* Lane Gap */}
                <div className="flex items-center gap-1.5">
                    {goldDiff?.laneOpponentGold && (
                        <span className="text-[8px] text-gold-text/30 font-medium">
                            vs {goldDiff.laneOpponentGold.championName}
                        </span>
                    )}
                    <span className={`text-xs font-bold font-mono ${lAhead ? 'text-lolgreen' : 'text-lolerr-red'}`}>
                        {lAhead ? '+' : '-'}{fmt(laneGold)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default GoldDiffBar;
