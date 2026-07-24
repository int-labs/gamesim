import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    specPattern: 'cypress/e2e/**/*.spec.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    downloadsFolder: 'cypress/downloads',
    
    env: {
      apiUrl: 'http://localhost:5000', // or 'http://localhost:5000' if backend is separate
    },

    // Video and screenshot settings
    video: true,
    screenshotOnRunFailure: true,
    
    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    
    // Test settings
    retries: {
      runMode: 2,
      openMode: 0,
    },
    
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});

