import { useEffect, useState, useSyncExternalStore } from 'react';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { addDebugLog, getDebugLogs, shouldEnableDebugLogger, subscribeDebugLogs } from '../lib/debug';

const LEVEL_STYLES = {
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
} as const;

export function DebugLogger() {
  const logs = useSyncExternalStore(subscribeDebugLogs, getDebugLogs, getDebugLogs);
  const [isExpanded, setIsExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const isEnabled = shouldEnableDebugLogger();
    setEnabled(isEnabled);

    if (isEnabled) {
      addDebugLog('info', 'Debug logger ativo');
    }
  }, []);

  if (!enabled) return null;

  return (
    <aside className="fixed right-3 top-3 z-[100] w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Bug className="h-4 w-4 text-indigo-600" />
          Debug do app
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {logs.length} logs
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {isExpanded && (
        <div className="max-h-[50vh] space-y-2 overflow-y-auto border-t border-slate-200 px-3 py-3 text-xs">
          {logs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-slate-500">
              Sem logs ainda.
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`rounded-xl border px-3 py-2 ${LEVEL_STYLES[log.level]}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="font-semibold">{log.message}</strong>
                  <span className="shrink-0 text-[10px] opacity-70">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                {log.details && (
                  <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] opacity-90">
                    {log.details}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
