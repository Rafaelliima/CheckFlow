export type DebugLogLevel = 'info' | 'warn' | 'error';

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  level: DebugLogLevel;
  message: string;
  details?: string;
}

type Listener = () => void;

const MAX_LOGS = 50;
const listeners = new Set<Listener>();
let logs: DebugLogEntry[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

export function addDebugLog(level: DebugLogLevel, message: string, details?: unknown) {
  const entry: DebugLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
    details: details ? formatDetails(details) : undefined,
  };

  logs = [entry, ...logs].slice(0, MAX_LOGS);
  emit();
}

function formatDetails(details: unknown) {
  if (details instanceof Error) {
    return `${details.name}: ${details.message}`;
  }

  if (typeof details === 'string') return details;

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export function getDebugLogs() {
  return logs;
}

export function subscribeDebugLogs(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function shouldEnableDebugLogger() {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === 'true';
}

export function clearDebugLogs() {
  logs = [];
  emit();
}
