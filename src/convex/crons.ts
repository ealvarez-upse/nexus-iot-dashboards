import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Mantiene los sensores demo emitiendo telemetría para que los dashboards se vean vivos
crons.interval("demo-telemetry", { minutes: 1 }, internal.demo.simulateTick, {});

export default crons;
