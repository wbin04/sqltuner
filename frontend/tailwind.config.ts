import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic colors that work for both light and dark modes
        background: {
          DEFAULT: '#f8fafc', // Light: slate-50
          dark: '#020617',    // Dark: slate-950
        },
        surface: {
          DEFAULT: '#ffffff',   // Light: white
          dark: '#0F172A',      // Dark: slate-900
          highlight: {
            light: '#e2e8f0', // Light: slate-200
            dark: '#1E293B',    // Dark: slate-800
          }
        },
        border: {
          DEFAULT: '#e2e8f0',   // Light: slate-200
          dark: '#1E293B',      // Dark: slate-800
        },
        // Legacy midnight colors (kept for backwards compatibility)
        midnight: {
          950: '#020617',
          900: '#0F172A',
          800: '#1E293B',
        },
        primary: {
          DEFAULT: '#2563EB', // Light: blue-600 (darker for contrast)
          hover: '#1d4ed8',   // Light: blue-700
          dark: '#3B82F6',    // Dark: blue-500
          'dark-hover': '#2563EB', // Dark: blue-600
        },
        secondary: {
          DEFAULT: '#8B5CF6', // purple-500
          hover: '#7C3AED',   // purple-600
          dark: '#A78BFA',    // Dark: purple-400
          'dark-hover': '#8B5CF6', // Dark: purple-500
        },
        text: {
          main: {
            DEFAULT: '#0f172a', // Light: slate-900
            dark: '#F8FAFC',    // Dark: slate-50
          },
          muted: {
            DEFAULT: '#64748b', // Light: slate-500
            dark: '#94A3B8',    // Dark: slate-400
          }
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
