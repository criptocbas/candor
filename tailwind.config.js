/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: "#14141A",
        "surface-raised": "#1E1E26",
        border: "#25252E",
        primary: "#E8A838",
        "text-primary": "#F0EDEA",
        "text-secondary": "#999999",
        "text-tertiary": "#666666",
        success: "#4ADE80",
        error: "#EF4444",
      },
      fontFamily: {
        "display-medium": ["SpaceGrotesk_500Medium"],
        "display-semibold": ["SpaceGrotesk_600SemiBold"],
        "display-bold": ["SpaceGrotesk_700Bold"],
      },
    },
  },
  plugins: [],
};
