// app.json plus build-time settings. EXPO_BASE_URL serves the browser build from a sub-folder (the preview on
// GitHub Pages lives at /recomp-tracker/preview).
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) }
});
