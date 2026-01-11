import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0F172A',
                surface: '#1E293B',
                primary: {
                    DEFAULT: '#6366F1', // Indigo 500
                    foreground: '#FFFFFF',
                },
                secondary: {
                    DEFAULT: '#22C55E', // Green 500
                    foreground: '#FFFFFF',
                }
            },
            fontFamily: {
                sans: ['var(--font-inter)'],
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                'glass': 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                'glow': '0 0 20px rgba(99, 102, 241, 0.5)',
            }
        },
    },
    plugins: [],
};
export default config;
