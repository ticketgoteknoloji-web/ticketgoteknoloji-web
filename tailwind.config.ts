import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        canvas: 'var(--bg-page)',
        surface: 'var(--bg-surface)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        line: 'var(--border-color)',
        brand: {
          50: '#FBF8F3',
          100: '#F3EDE3',
          200: '#E8DFD0',
          300: '#D5BD8A',
          400: '#C4A574',
          500: '#B08D57',
          600: '#7A3340',
          700: '#5E2832',
        },
        premium: 'var(--color-premium)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        warning: 'var(--color-warning)',
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        soft: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};

export default config;
