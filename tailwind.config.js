/** @type {import('tailwindcss').Config} */
export default {
  content: ["./**/*.{html,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#d4a373",
        "primary-dark": "#b08554",
        "background-light": "#fafaf9",
        "background-dark": "#1c1917",
        "heat-0": "var(--heat-0)",
        "heat-1": "var(--heat-1)",
        "heat-2": "var(--heat-2)",
        "heat-3": "var(--heat-3)",
        "heat-4": "var(--heat-4)",
        "heat-5": "var(--heat-5)"
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        display: ["Outfit", "sans-serif"]
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.05)"
      }
    }
  }
};