
export default {
  testEnvironment: 'node', // default for backend tests
    setupFiles: ['<rootDir>/tests/setup-globals.js'], // <-- add this line
    roots: ['<rootDir>/tests'],
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/server.js',
        '!src/**/index.js'
    ],
    coverageReporters: ['text', 'lcov']
}
