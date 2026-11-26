/**
 * OpenTelemetry tracing bootstrap — must load BEFORE the service code:
 *
 *   node --import ../utils/tracing.js server.js        (docker-compose sets NODE_OPTIONS)
 *
 * Auto-instruments incoming/outgoing HTTP (Express, axios, fetch), PostgreSQL (pg),
 * Redis (redis / ioredis → BullMQ) and Kafka (kafkajs — trace context travels in message
 * headers), and exports spans over OTLP/HTTP to Grafana Alloy → Tempo.
 *
 * Logs ↔ traces: while a sampled span is active, console output gets ` trace_id=<id>`
 * appended, so Grafana can jump from a Loki log line to its trace (and back).
 *
 * Env
 *   OTEL_EXPORTER_OTLP_ENDPOINT   e.g. http://alloy:4318 — tracing is OFF when unset
 *   OTEL_SERVICE_NAME             default: the service folder name (order-service …)
 *   OTEL_TRACES_SAMPLER(_ARG)     standard OTel sampler settings (default: always on)
 *   OTEL_SDK_DISABLED=true        turn tracing off
 */
import { register } from 'node:module';
import path from 'node:path';

const enabled = process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.OTEL_SDK_DISABLED !== 'true';

if (enabled) {
  // ESM: patch modules as they are imported (pg, express, kafkajs … are ES-imported here)
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

  const [{ NodeSDK }, { getNodeAutoInstrumentations }, { OTLPTraceExporter }, { resourceFromAttributes }, api] =
    await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@opentelemetry/auto-instrumentations-node'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/api')
    ]);

  const serviceName = process.env.OTEL_SERVICE_NAME || path.basename(process.cwd());
  const NOISY_PATHS = /^\/(metrics|health)(\/|$|\?)/;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': serviceName,
      'service.namespace': 'nexuscommerce',
      'deployment.environment.name': process.env.NODE_ENV || 'development'
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Too chatty to be useful here
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          // Prometheus scrapes and health probes would drown the real traffic
          ignoreIncomingRequestHook: (req) => NOISY_PATHS.test(req.url || ''),
          ignoreOutgoingRequestHook: (opts) => NOISY_PATHS.test(opts.path || '')
        },
        '@opentelemetry/instrumentation-undici': {
          ignoreRequestHook: (req) => NOISY_PATHS.test(req.path || '')
        },
        // Keep route handlers, drop one span per middleware (cors, json, auth …)
        '@opentelemetry/instrumentation-express': { ignoreLayersType: ['middleware', 'router'] },
        // DB / Redis spans only inside a request or consumer trace — background polling
        // (health checks, outbox relay, BullMQ) would otherwise create thousands of root traces
        '@opentelemetry/instrumentation-pg': {
          enhancedDatabaseReporting: false,
          requireParentSpan: true,
          ignoreConnectSpans: true
        },
        '@opentelemetry/instrumentation-redis': { requireParentSpan: true },
        '@opentelemetry/instrumentation-ioredis': { requireParentSpan: true }
      })
    ]
  });
  sdk.start();

  // ---- Log correlation: append trace_id to console lines written inside a sampled span
  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      const ctx = api.trace.getActiveSpan()?.spanContext();
      if (ctx && ctx.traceFlags & api.TraceFlags.SAMPLED) args.push(`trace_id=${ctx.traceId}`);
      original(...args);
    };
  }

  // Flush spans on shutdown (docker stop sends SIGTERM). A signal listener disables Node's
  // default "exit on signal", so exit ourselves unless the service has its own handler
  // (utils/events/lifecycle.js onShutdown), which exits after its cleanup.
  const onSignal = (signal) => {
    const serviceHandlesExit = process.listenerCount(signal) > 0;
    const flush = sdk.shutdown().catch(() => {});
    if (!serviceHandlesExit) {
      Promise.race([flush, new Promise((r) => setTimeout(r, 3000))]).then(() =>
        process.exit(signal === 'SIGTERM' ? 143 : 130)
      );
    }
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  process.once('beforeExit', () => sdk.shutdown().catch(() => {}));

  console.log(`[Tracing] OpenTelemetry → ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT} as "${serviceName}"`);
}
