import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Chart.js ecosystem in its own chunk — loaded lazily with PulseChart
            'chart': ['chart.js', 'react-chartjs-2', 'chartjs-plugin-annotation'],
            // Day.js + plugins together
            'dayjs': ['dayjs'],
          },
        },
      },
    },
});
