/** @type {import('tailwindcss').Config} */
export default {
  content: ["./**/*.{html,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#2b8cee",
        "primary-dark": "#1d4ed8",
        "background-light": "#f8fafc",
        "background-dark": "#101922",
        "heat-0": "var(--heat-0)",
        "heat-1": "var(--heat-1)",
        "heat-2": "var(--heat-2)",
        "heat-3": "var(--heat-3)",
        "heat-4": "var(--heat-4)",
        "heat-5": "var(--heat-5)"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.05)"
      }
    }
  }
};