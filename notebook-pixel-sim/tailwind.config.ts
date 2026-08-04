import type { Config } from 'tailwindcss';

/**
 * Minimal pixel design system.
 * One restrained palette, one ink color, one outline color, soft semantic accents.
 * All colors flow from CSS variables defined in styles/index.css for easy themeing.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // `text-success` / `text-warning` / `text-danger` / `text-info` resolve to
      // the darker -ink weights, while `border-*` and `bg-*` keep the bright
      // pastels from `colors` below. Same class names, correct value for the
      // property — so no call site has to remember which weight to reach for,
      // and a green number is readable without stopping being green.
      textColor: {
        success: 'var(--c-success-ink)',
        warning: 'var(--c-warning-ink)',
        danger: 'var(--c-danger-ink)',
        info: 'var(--c-info-ink)',
        'fin-revenue': 'var(--c-fin-revenue-ink)',
        'fin-cost': 'var(--c-fin-cost-ink)',
        'fin-profit': 'var(--c-fin-profit-ink)',
        'fin-cash': 'var(--c-fin-cash-ink)',
        'fin-inventory': 'var(--c-fin-inventory-ink)',
        'fin-demand': 'var(--c-fin-demand-ink)',
      },
      fontFamily: {
        body: ['Inter', 'system-ui', 'sans-serif'],
        pixel: ['"Pixelify Sans"', 'system-ui', 'sans-serif'],
        hud: ['"Press Start 2P"', '"Pixelify Sans"', 'system-ui'],
      },
      colors: {
        // Background / surfaces
        bg: 'var(--c-bg)',
        surface: 'var(--c-surface)',
        'surface-2': 'var(--c-surface-2)',
        'surface-muted': 'var(--c-surface-muted)',
        // Borders / outlines
        border: 'var(--c-border)',
        'border-soft': 'var(--c-border-soft)',
        // Text
        text: 'var(--c-text)',
        'text-2': 'var(--c-text-2)',
        'text-3': 'var(--c-text-3)',
        // Brand / actions
        primary: 'var(--c-primary)',
        'primary-soft': 'var(--c-primary-soft)',
        'primary-strong': 'var(--c-primary-strong)',
        secondary: 'var(--c-secondary)',
        'secondary-soft': 'var(--c-secondary-soft)',
        'secondary-strong': 'var(--c-secondary-strong)',
        // Semantic
        success: 'var(--c-success)',
        'success-soft': 'var(--c-success-soft)',
        warning: 'var(--c-warning)',
        'warning-soft': 'var(--c-warning-soft)',
        danger: 'var(--c-danger)',
        'danger-soft': 'var(--c-danger-soft)',
        'danger-strong': 'var(--c-danger-strong)',
        info: 'var(--c-info)',
        'info-soft': 'var(--c-info-soft)',
        // Finance
        'fin-revenue': 'var(--c-fin-revenue)',
        'fin-cost': 'var(--c-fin-cost)',
        'fin-profit': 'var(--c-fin-profit)',
        'fin-cash': 'var(--c-fin-cash)',
        'fin-inventory': 'var(--c-fin-inventory)',
        'fin-demand': 'var(--c-fin-demand)',

        // ----- Legacy aliases kept so existing components still compile.
        // These will gradually be replaced by the new tokens above.
        cream: {
          50: '#FBF6E9',
          100: '#F5EED8',
          200: '#EEE3C2',
          300: '#E2D2A2',
          400: '#D2BC83',
        },
        ink: {
          900: '#2A2017',
          800: '#3F3325',
          700: '#5A4A37',
          600: '#7A6750',
          500: '#9A866B',
          400: '#BFAE90',
        },
        leather: { DEFAULT: '#7a4a2b', light: '#a06a44', dark: '#5a3520' },
        kraft: { DEFAULT: '#cba87a', light: '#e6c898', dark: '#9a7a55' },
        cloth: { DEFAULT: '#cfc4ad', light: '#e8dec7', dark: '#a89c84' },
        ui: {
          primary: 'var(--c-primary)',
          'primary-dark': '#3F8A59',
          secondary: 'var(--c-secondary)',
          'secondary-dark': '#3E6299',
          danger: 'var(--c-danger)',
          'danger-dark': '#A13A30',
          warm: 'var(--c-warning)',
          warmsoft: 'var(--c-warning-soft)',
        },
        warn: { DEFAULT: 'var(--c-warning)', soft: 'var(--c-warning-soft)' },
        error: { DEFAULT: 'var(--c-danger)', soft: 'var(--c-danger-soft)' },
        // Chart palette uses semantic tokens
        chart: {
          1: 'var(--c-fin-revenue)',
          2: 'var(--c-fin-cash)',
          3: 'var(--c-fin-demand)',
          4: 'var(--c-fin-cost)',
          5: 'var(--c-fin-profit)',
          6: 'var(--c-secondary)',
        },
        brand: { 500: '#9b56c8', 400: '#c87bd9', 300: '#e29bd2' },
      },
      boxShadow: {
        // Softer, more restrained pixel shadows
        'pixel-1': '2px 2px 0 0 var(--c-shadow)',
        'pixel-2': '3px 3px 0 0 var(--c-shadow)',
        'pixel-3': '4px 4px 0 0 var(--c-shadow)',
        'pixel-4': '6px 6px 0 0 var(--c-shadow)',
        'pixel-soft': '2px 2px 0 0 rgba(42, 32, 23, 0.18)',
        'pixel-warn': '3px 3px 0 0 var(--c-danger)',
        'pixel-success': '3px 3px 0 0 var(--c-success)',
      },
      borderRadius: {
        none: '0',
        pixel: '2px',
      },
      keyframes: {
        popIn: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        bounceY: {
          '0%,100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-6px)' },
          '70%': { transform: 'translateY(-2px)' },
        },
        shakeX: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-3px)' },
          '50%': { transform: 'translateX(3px)' },
          '75%': { transform: 'translateX(-1px)' },
        },
        pulseStep: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(95,178,122,0.0)' },
          '50%': { boxShadow: '0 0 0 4px rgba(95,178,122,0.4)' },
        },
        sparkle: {
          '0%': { transform: 'scale(0.4) rotate(0deg)', opacity: '0' },
          '50%': { transform: 'scale(1.1) rotate(20deg)', opacity: '1' },
          '100%': { transform: 'scale(0.8) rotate(40deg)', opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(14px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        floatY: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        flashHi: {
          '0%': { backgroundColor: 'var(--c-success-soft)' },
          '100%': { backgroundColor: 'transparent' },
        },
        countUp: {
          '0%': { transform: 'translateY(4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        popIn: 'popIn 220ms cubic-bezier(.2,1.6,.4,1) both',
        bounceY: 'bounceY 320ms steps(6) both',
        shakeX: 'shakeX 220ms steps(4) both',
        pulseStep: 'pulseStep 1.6s steps(8) infinite',
        sparkle: 'sparkle 600ms steps(8) both',
        slideUp: 'slideUp 240ms cubic-bezier(.2,1.4,.4,1) both',
        floatY: 'floatY 2.4s ease-in-out infinite',
        flashHi: 'flashHi 900ms ease-out both',
        countUp: 'countUp 220ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
