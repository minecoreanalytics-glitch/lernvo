import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EEF4FB',
          100: '#D6E5F5',
          200: '#ACC9EB',
          300: '#7AADD9',
          400: '#4A8DC8',
          500: '#2B6CB0',
          600: '#1E4F8C',   // main CTA buttons
          700: '#163A6B',   // active nav, headers
          800: '#0F2849',
          900: '#091828',
        },
        gray: {
          50:  '#F7F8FA',   // page background
          100: '#F0F2F5',   // card alt bg
          200: '#E4E8EF',   // borders
          300: '#CDD3DE',
          400: '#9BA8BB',
          500: '#6B7A8D',   // secondary text
          600: '#4A5568',
          700: '#2D3748',
          800: '#1A202C',   // body text
          900: '#0F1923',
        },
        teal: {
          50:  '#E6F7F5',
          500: '#0EA5A0',
          600: '#0D8F8A',
        },
        success: { 50: '#ECFDF5', 500: '#10B981', 600: '#059669' },
        warning: { 50: '#FFFBEB', 500: '#F59E0B' },
        danger:  { 50: '#FEF2F2', 500: '#EF4444' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.08)',
        'card-lg': '0 8px 24px rgba(0,0,0,0.10)',
        'nav': '0 -1px 0 rgba(0,0,0,0.06)',
      },
      animation: {
        'slide-up':   'slideUp 0.25s ease-out',
        'fade-in':    'fadeIn 0.2s ease-out',
        'bounce-in':  'bounceIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275)',
        'pulse-soft': 'pulse 3s ease-in-out infinite',
        'shimmer':    'shimmer 1.5s infinite',
      },
      keyframes: {
        slideUp:   { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: '0' },                                to: { opacity: '1' } },
        bounceIn:  { '0%': { transform: 'scale(0.5)', opacity: '0' },      '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    }
  },
  plugins: []
} satisfies Config
