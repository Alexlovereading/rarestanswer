/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

const displayStack = 'Fraunces, "Iowan Old Style", Palatino, Georgia, serif';
const sansStack = [
  '"Source Sans 3"',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'sans-serif',
];

export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--border))',
        ring: 'hsl(var(--brand))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        nav: {
          DEFAULT: 'hsl(var(--brand-text))',
          light: 'hsl(var(--brand-light))',
        },
        gold: 'hsl(var(--gold) / <alpha-value>)',
        tier: {
          1: 'hsl(var(--tier-1) / <alpha-value>)',
          2: 'hsl(var(--tier-2) / <alpha-value>)',
          3: 'hsl(var(--tier-3) / <alpha-value>)',
          4: 'hsl(var(--tier-4) / <alpha-value>)',
          5: 'hsl(var(--tier-5) / <alpha-value>)',
          6: 'hsl(var(--tier-6) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--background))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(0 84% 60%)',
          foreground: 'hsl(var(--background))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius, 0.875rem)',
        md: 'calc(var(--radius, 0.875rem) - 2px)',
        sm: 'calc(var(--radius, 0.875rem) - 4px)',
      },
      fontFamily: {
        sans: sansStack,
        display: displayStack.split(', '),
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'hsl(var(--foreground))',
            '--tw-prose-headings': 'hsl(var(--foreground))',
            '--tw-prose-links': 'hsl(var(--brand-text))',
            '--tw-prose-bold': 'hsl(var(--foreground))',
            '--tw-prose-quotes': 'hsl(var(--foreground))',
            '--tw-prose-quote-borders': 'hsl(var(--brand-text))',
            maxWidth: '42rem',
            fontFamily: sansStack.join(', '),
            lineHeight: '1.7',
            a: {
              textDecoration: 'none',
              fontWeight: '600',
              '&:hover': { textDecoration: 'underline' },
            },
            'h1, h2, h3, h4': {
              fontFamily: displayStack,
              letterSpacing: '-0.02em',
            },
            h2: { fontWeight: '700' },
            h3: { fontWeight: '600' },
          },
        },
      },
    },
  },
  plugins: [typography],
};
