import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

type Entry = { key: string; value: number };

/** Normaliza los formatos de payload compatibles con ThingsBoard:
 *  - {"temperature": 23.5}
 *  - [{"temperature": 23.5}, {"humidity": 54}]
 *  - {"ts": 1690000000000, "values": {"temperature": 23.5}}
 */
function normalizePayload(payload: unknown): Entry[] {
  const entries: Entry[] = [];
  const collect = (obj: Record<string, unknown>) => {
    const values = obj["values"];
    if (values && typeof values === "object" && !Array.isArray(values)) {
      collect(values as Record<string, unknown>);
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "number" && Number.isFinite(val)) {
        entries.push({ key, value: val });
      } else if (typeof val === "boolean") {
        entries.push({ key, value: val ? 1 : 0 });
      }
    }
  };
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (item && typeof item === "object") collect(item as Record<string, unknown>);
    }
  } else if (payload && typeof payload === "object") {
    collect(payload as Record<string, unknown>);
  }
  return entries;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** POST /api/v1/{token}/telemetry — ingesta de telemetría por token de acceso. */
const telemetry = httpAction(async (ctx, req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","v1",token,"telemetry"]
  const token = parts.length >= 3 ? parts[2] : "";
  if (!token || parts[3] !== "telemetry") {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const device = await ctx.runQuery(internal.devices.getByToken, { token });
  if (!device) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const entries = normalizePayload(payload);
  if (entries.length === 0) {
    return new Response(JSON.stringify({ error: "no_values" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const ts = Date.now();
  await ctx.runMutation(internal.devices.ingestInternal, {
    deviceId: device._id,
    values: entries,
    ts,
  });

  return new Response(JSON.stringify({ status: "ok", count: entries.length }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

const telemetryOptions = httpAction(async () => new Response(null, { status: 204, headers: corsHeaders }));

const http = httpRouter();

// Rutas de autenticación (email OTP) del template
auth.addHttpRoutes(http);

// Ingesta de telemetría compatible con ThingsBoard
// El token va en medio del path (/api/v1/{token}/telemetry), por lo que se
// registra por prefijo y se extrae dentro del handler.
http.route({
  pathPrefix: "/api/v1/",
  method: "POST",
  handler: telemetry,
});

http.route({
  pathPrefix: "/api/v1/",
  method: "OPTIONS",
  handler: telemetryOptions,
});

export default http;
