describe('tracing bootstrap', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('does not initialize SDK when OTEL is disabled', async () => {
    process.env = { ...originalEnv, OTEL_ENABLED: 'false' };

    const start = jest.fn();
    jest.doMock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest.fn().mockImplementation(() => ({ start })),
    }));

    await import('./tracing');
    expect(start).not.toHaveBeenCalled();
  });

  it('initializes SDK when OTEL is enabled', async () => {
    process.env = { ...originalEnv, OTEL_ENABLED: 'true', NODE_ENV: 'test' };
    const start = jest.fn();
    const shutdown = jest.fn().mockResolvedValue(undefined);

    jest.doMock('@opentelemetry/sdk-node', () => ({
      NodeSDK: jest.fn().mockImplementation(() => ({ start, shutdown })),
    }));
    jest.doMock('@opentelemetry/api', () => ({
      diag: { setLogger: jest.fn() },
      DiagConsoleLogger: class {},
      DiagLogLevel: { ERROR: 0 },
    }));
    jest.doMock('@opentelemetry/auto-instrumentations-node', () => ({
      getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
    }));
    jest.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
      OTLPTraceExporter: jest.fn().mockImplementation(() => ({})),
    }));

    await import('./tracing');
    expect(start).toHaveBeenCalledTimes(1);
  });
});
