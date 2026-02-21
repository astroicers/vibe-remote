/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // OLED Background scale
        bg: {
          primary: '#000000',
          secondary: '#0a0a0a',
          tertiary: '#121212',
          elevated: '#1a1a1a',
          surface: '#1e1e1e',
        },
        // Text colors
        text: {
          primary: '#e4e4e7',
          secondary: '#a1a1aa',
          muted: '#52525b',
        },
        // Accent
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#60a5fa',
          muted: '#1e3a5f',
        },
        // Status
        success: {
          DEFAULT: '#22c55e',
          muted: '#14532d',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: '#450a0a',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#451a03',
        },
        // Diff
        diff: {
          'add-bg': '#052e16',
          'add-text': '#4ade80',
          'add-line': '#166534',
          'del-bg': '#2a0a0a',
          'del-text': '#f87171',
          'del-line': '#7f1d1d',
        },
        // Border
        border: {
          DEFAULT: '#27272a',
          focus: '#3b82f6',
        },
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        glow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
        'glow-success': '0 0 0 3px rgba(34, 197, 94, 0.3)',
        'glow-danger': '0 0 0 3px rgba(239, 68, 68, 0.3)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.4' }],
        base: ['15px', { lineHeight: '1.5' }],
        lg: ['17px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.3' }],
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'msg-in-left': 'msg-in-left 0.2s ease-out',
        'msg-in-right': 'msg-in-right 0.2s ease-out',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'msg-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'msg-in-right': {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
