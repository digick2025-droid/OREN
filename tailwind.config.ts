import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/* =============================================================
   OREN — Design System · Tailwind
   Les couleurs pointent vers les variables CSS de globals.css.
   ============================================================= */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        surface: "hsl(var(--surface))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Couleurs sémantiques (base + surface teintée + texte lisible)
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          surface: "hsl(var(--success-surface))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          surface: "hsl(var(--warning-surface))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
          surface: "hsl(var(--error-surface))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          surface: "hsl(var(--info-surface))",
        },
        // --- Alias rétro-compat repointés vers OREN ---
        navy: "hsl(var(--primary))",
        // Navy fixe pour surfaces toujours sombres (ne s'inverse pas).
        "brand-navy": "hsl(var(--brand-navy))",
        coral: "hsl(var(--accent))",
        danger: "hsl(var(--error))",
        whatsapp: "#25D366",
      },
      borderRadius: {
        // Échelle sémantique OREN
        field: "var(--radius)", // inputs & boutons — 14px
        card: "var(--radius-card)", // cards — 18px
        dialog: "var(--radius-dialog)", // modals/drawers — 24px
        // Alias shadcn dérivés du radius de base
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Échelle typographique OREN (Inter)
        "display": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "h1": ["2rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        "h2": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        "h3": ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
      },
      boxShadow: {
        // Ombres très discrètes — jamais lourdes
        xs: "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
        sm: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        md: "0 4px 12px -2px rgba(15, 23, 42, 0.06)",
        lg: "0 8px 24px -4px rgba(15, 23, 42, 0.08)",
        xl: "0 16px 40px -8px rgba(15, 23, 42, 0.10)",
        none: "none",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        // Micro-animations 150–200ms
        "fade-in": "fade-in 180ms ease-out",
        "fade-in-up": "fade-in-up 200ms ease-out",
        "scale-in": "scale-in 160ms ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
