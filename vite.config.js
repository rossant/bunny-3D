import { defineConfig } from 'vite';

// Babylon has many internal dynamic imports. A compact single runtime file is
// faster and more reliable for a small static game than hundreds of requests.
export default defineConfig({
  // GitHub Pages serves this project under /bunny-3D/.
  base: '/bunny-3D/',
  build: {
    rolldownOptions: {
      output: { codeSplitting: false }
    }
  }
});
