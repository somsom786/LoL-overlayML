import React from 'react';
import type { WinCondition } from '../engine/WinConditionEngine';

const CONDITION_ICONS: Record<string, string> = {
    TEAMFIGHT: '⚔️',
    SPLIT_PUSH: '🗡️',
    PICK_COMP: '🎯',
    SCALE_LATE: '📈',
    EARLY_SNOWBALL: '🔥',
    OBJECTIVE_CONTROL: '🐉',
};

const CONDITION_LABELS: Record<string, string> = {
    TEAMFIGHT: 'Teamfight',
    SPLIT_PUSH: 'Split Push',
    PICK_COMP: 'Pick Comp',
    SCALE_LATE: 'Scale',
    EARLY_SNOWBALL: 'Snowball',
    OBJECTIVE_CONTROL: 'Objectives',
};

const PHASE_COLORS: Record<string, string> = {
    EARLY: 'text-lolgreen',
    MID: 'text-lolorange',
    LATE: 'text-purple-400',
};

const POWER_STYLES: Record<string, { text: string; label: string }> = {
    STRONGER: { text: 'text-lolgreen', label: 'STRONGER' },
    EVEN: { text: 'text-gold', label: 'EVEN' },
    WEAKER: { text: 'text-lolerr-red', label: 'WEAKER' },
};

export const WinConditionPanel: React.FC<{ condition: WinCondition | null }> = ({ condition }) => {
    if (!condition) return null;

    const power = POWER_STYLES[condition.teamPowerLevel] || POWER_STYLES.EVEN;

    return (
        <div className="lol-panel rounded-l-md w-[220px] animate-slide-in overflow-hidden">
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-gold-dim/20 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-lolteal to-lolteal/30" />
                    <h2 className="text-[8px] font-bold uppercase tracking-[0.2em] text-lolteal">Win Condition</h2>
                </div>
                <div className="flex items-center gap-1">
                    <span className={`text-[7px] font-bold uppercase ${PHASE_COLORS[condition.phase]}`}>
                        {condition.phase}
                    </span>
                    <span className="text-gold-text/15">·</span>
                    <span className={`text-[7px] font-bold ${power.text}`}>{power.label}</span>
                </div>
            </div>

            {/* Strategy */}
            <div className="px-3 py-2">
                {/* Primary condition */}
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm">{CONDITION_ICONS[condition.primary]}</span>
                    <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gold-light">
                                {CONDITION_LABELS[condition.primary]}
                            </span>
                            {condition.secondary && (
                                <>
                                    <span className="text-gold-text/15">+</span>
                                    <span className="text-[8px] font-medium text-gold-text/40">
                                        {CONDITION_LABELS[condition.secondary]}
                                    </span>
                                </>
                            )}
                        </div>
                        {/* Confidence bar */}
                        <div className="w-full h-0.5 bg-white/5 rounded-full mt-1">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-700"
                                style={{ width: `${condition.confidence}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Advice */}
                <p className="text-[9px] font-semibold text-gold-light/80 leading-snug">
                    {condition.advice}
                </p>
                <p className="text-[8px] text-gold-text/35 leading-snug mt-0.5">
                    {condition.subAdvice}
                </p>

                {/* Spike info */}
                {condition.spikeInfo && (
                    <div className="mt-1.5 px-2 py-1 rounded bg-lolteal/5 border border-lolteal/15">
                        <p className="text-[7px] font-semibold text-lolteal/70">
                            ⏱ {condition.spikeInfo}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WinConditionPanel;
