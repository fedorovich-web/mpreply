module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start",
      startServerReadyPattern: "Ready in|ready - started server|Local:",
      startServerReadyTimeout: 120000,
      url: [
        "http://127.0.0.1:3000/",
        "http://127.0.0.1:3000/features",
        "http://127.0.0.1:3000/marketplaces",
        "http://127.0.0.1:3000/pricing",
      ],
      numberOfRuns: 1,
      settings: { preset: "desktop", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.75 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
  },
};
