/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Authentic League of Legends color palette
                lol: {
                    dark: '#010A13',
                    bg: '#0A1428',
                    panel: '#1E2328',
                    border: '#1E282D',
                    borderLight: '#3C3C41',
                },
                gold: {
                    DEFAULT: '#C89B3C',
                    light: '#F0E6D2',
                    dim: '#785A28',
                    bright: '#C8AA6E',
                    text: '#A09B8C',
                },
                lolteal: {
                    DEFAULT: '#0AC8B9',
                    dim: '#0397AB',
                    dark: '#005A82',
                },
                lolerr: {
                    red: '#E84057',
                    redDim: '#9B2335',
                },
                lolgreen: {
                    DEFAULT: '#0ACE83',
                    dim: '#08A468',
                },
                lolorange: {
                    DEFAULT: '#F5A623',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            animation: {
                'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
                'slide-in': 'slideIn 0.3s ease-out',
                'fade-in': 'fadeIn 0.25s ease-out',
                'gauge-fill': 'gaugeFill 1s ease-out forwards',
            },
            keyframes: {
                pulseGlow: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(12px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
            },
        },
    },
    plugins: [],
};
