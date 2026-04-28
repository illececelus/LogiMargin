import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        profit: { DEFAULT: 'hsl(142 71% 45%)', foreground: 'hsl(142 71% 95%)', muted: 'hsl(142 71% 45% / 0.15)' },
        warning: { DEFAULT: 'hsl(38 92% 50%)', foreground: 'hsl(38 92% 95%)', muted: 'hsl(38 92% 50% / 0.15)' },
        danger: { DEFAULT: 'hsl(0 84% 60%)', foreground: 'hsl(0 84% 95%)', muted: 'hsl(0 84% 60% / 0.15)' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'pulse-slow': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
