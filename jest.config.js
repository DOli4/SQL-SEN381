export default {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/server.js',
        '!src/**/index.js'
    ],
    coverageReporters: ['text', 'lcov']
}