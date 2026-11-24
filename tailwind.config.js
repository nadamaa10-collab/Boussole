/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: v("background"),
        foreground: v("foreground"),
        card: v("card"),
        muted: { DEFAULT: v("muted"), foreground: v("muted-foreground") },
        border: v("border"),
        primary: { DEFAULT: v("primary"), foreground: v("primary-foreground") },
        secondary: v("secondary"),
        accent: { DEFAULT: v("accent"), foreground: v("accent-foreground") },
        ink: { DEFAULT: v("ink"), foreground: v("ink-foreground"), muted: v("ink-muted"), soft: v("ink-soft") },
        danger: v("danger"),
        warning: v("warning"),
        success: v("success"),
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        num: ['"Fraunces"', "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgb(20 32 31 / 0.18)",
        float: "0 30px 60px -20px rgb(20 32 31 / 0.45)",
      },
    },
  },
};
