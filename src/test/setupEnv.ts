// Runs before the test framework. jest-fixed-jsdom already exposes fetch/Request/Response/streams.
process.env.NODE_ENV = 'test';
