import type { Config } from 'tailwindcss';

/**
 * A CSS-variable colour that ALSO honours Tailwind's `/NN` alpha modifier.
 *
 * Every token below used to be a bare `var(--c-…)` string. Tailwind cannot
 * inject an alpha into an opaque `var()`, so it emitted an INVALID colour for
 * any `/NN` suffix and the browser fell back to transparent. `bg-warning-soft`
 * painted; `bg-warning-soft/40` painted nothing — silently, with no build
 * warning and no console error. Around fifty call sites were written that way,
 * which is why assorted tiles and chips across the app looked like they had
 * simply lost their background: they had never had one.
 *
 * `color-mix()` gives the alpha back without changing how the variables are
 * declared (they stay readable hex in index.css, still usable from plain CSS).
 * Support matches the app's floor — Chrome 111 / Safari 16.2 / Firefox 113 —
 * and anything older lands on transparent, i.e. exactly today's behaviour.
 *
 * The guards matter: for a plain utility Tailwind passes `var(--tw-bg-opacity)`
 * rather than a number, so anything non-finite (or >= 1) must fall through to
 * the plain variable or every un-suffixed class would break instead.
 */
const alphaVar =
  (name: string) =>
  ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue === undefined) return `var(${name})`;
    const n = Number(opacityValue);
    if (!Number.isFinite(n) || n >= 1) return `var(${name})`;
    return `color-mix(in srgb, var(${name}) ${n * 100}%, transparent)`;
  };

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
        // Restores Tailwind's own `text-inherit`, which the wholesale `colors`
        // override below removes. It is the escape hatch for the trap in RULE 6:
        // the type classes paint, so a label inside a light-on-dark button needs
        // an explicit way to yield to its parent.
        inherit: 'inherit',
        success: alphaVar('--c-success-ink'),
        warning: alphaVar('--c-warning-ink'),
        danger: alphaVar('--c-danger-ink'),
        info: alphaVar('--c-info-ink'),
        'fin-revenue': alphaVar('--c-fin-revenue-ink'),
        'fin-cost': alphaVar('--c-fin-cost-ink'),
        'fin-profit': alphaVar('--c-fin-profit-ink'),
        'fin-cash': alphaVar('--c-fin-cash-ink'),
        'fin-inventory': alphaVar('--c-fin-inventory-ink'),
        'fin-demand': alphaVar('--c-fin-demand-ink'),
      },
      fontFamily: {
        body: ['Inter', 'system-ui', 'sans-serif'],
        pixel: ['"Pixelify Sans"', 'system-ui', 'sans-serif'],
        hud: ['"Press Start 2P"', '"Pixelify Sans"', 'system-ui'],
      },
      colors: {
        // Background / surfaces
        bg: alphaVar('--c-bg'),
        surface: alphaVar('--c-surface'),
        'surface-2': alphaVar('--c-surface-2'),
        'surface-muted': alphaVar('--c-surface-muted'),
        // Borders / outlines
        border: alphaVar('--c-border'),
        'border-soft': alphaVar('--c-border-soft'),
        // Text
        text: alphaVar('--c-text'),
        'text-2': alphaVar('--c-text-2'),
        'text-3': alphaVar('--c-text-3'),
        // Brand / actions
        primary: alphaVar('--c-primary'),
        'primary-soft': alphaVar('--c-primary-soft'),
        'primary-strong': alphaVar('--c-primary-strong'),
        secondary: alphaVar('--c-secondary'),
        'secondary-soft': alphaVar('--c-secondary-soft'),
        'secondary-strong': alphaVar('--c-secondary-strong'),
        // Semantic
        success: alphaVar('--c-success'),
        'success-soft': alphaVar('--c-success-soft'),
        warning: alphaVar('--c-warning'),
        'warning-soft': alphaVar('--c-warning-soft'),
        danger: alphaVar('--c-danger'),
        'danger-soft': alphaVar('--c-danger-soft'),
        'danger-strong': alphaVar('--c-danger-strong'),
        info: alphaVar('--c-info'),
        'info-soft': alphaVar('--c-info-soft'),
        // Finance
        'fin-revenue': alphaVar('--c-fin-revenue'),
        'fin-cost': alphaVar('--c-fin-cost'),
        'fin-profit': alphaVar('--c-fin-profit'),
        'fin-cash': alphaVar('--c-fin-cash'),
        'fin-inventory': alphaVar('--c-fin-inventory'),
        'fin-demand': alphaVar('--c-fin-demand'),

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
          primary: alphaVar('--c-primary'),
          'primary-dark': '#3F8A59',
          secondary: alphaVar('--c-secondary'),
          'secondary-dark': '#3E6299',
          danger: alphaVar('--c-danger'),
          'danger-dark': '#A13A30',
          warm: alphaVar('--c-warning'),
          warmsoft: alphaVar('--c-warning-soft'),
        },
        warn: { DEFAULT: 'var(--c-warning)', soft: 'var(--c-warning-soft)' },
        error: { DEFAULT: 'var(--c-danger)', soft: 'var(--c-danger-soft)' },
        // Chart palette uses semantic tokens
        chart: {
          1: alphaVar('--c-fin-revenue'),
          2: alphaVar('--c-fin-cash'),
          3: alphaVar('--c-fin-demand'),
          4: alphaVar('--c-fin-cost'),
          5: alphaVar('--c-fin-profit'),
          6: alphaVar('--c-secondary'),
        },
        brand: { 500: '#954CC5', 400: '#c87bd9', 300: '#e29bd2' },
      },
      boxShadow: {
        // Softer, more restrained pixel shadows.
        // `pixel-press` is the :active step of the interactive token
        // (rest pixel-1 → hover pixel-2 → active pixel-press). See the
        // affordance rule block in styles/index.css.
        'pixel-press': '1px 1px 0 0 var(--c-shadow)',
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
