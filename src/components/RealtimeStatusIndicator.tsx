import { AlertTriangle, LoaderCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { RealtimeStatus } from '../hooks/useRealtimeSync';

interface RealtimeStatusIndicatorProps {
  status: RealtimeStatus;
  retryCount?: number;
}

const STATUS_CONFIG: Record<Exclude<RealtimeStatus, 'idle'>, { label: string; className: string; icon: typeof Wifi }> = {
  connecting: {
    label: 'Conectando realtime',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: LoaderCircle,
  },
  connected: {
    label: 'Realtime conectado',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Wifi,
  },
  reconnecting: {
    label: 'Reconectando realtime',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: RefreshCw,
  },
  disconnected: {
    label: 'Realtime desconectado',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: WifiOff,
  },
  offline: {
    label: 'Sem internet',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: WifiOff,
  },
  error: {
    label: 'Erro no realtime',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: AlertTriangle,
  },
};

export function RealtimeStatusIndicator({ status, retryCount = 0 }: RealtimeStatusIndicatorProps) {
  if (status === 'idle') return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isAnimated = status === 'connecting' || status === 'reconnecting';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs sm:text-sm font-medium ${config.className}`}
      aria-live="polite"
      data-testid="realtime-status-indicator"
    >
      <Icon className={`w-4 h-4 ${isAnimated ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
      {status === 'reconnecting' && retryCount > 0 && (
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
          tentativa {retryCount}
        </span>
      )}
    </div>
  );
}
