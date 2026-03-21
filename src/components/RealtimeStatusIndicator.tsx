import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { RealtimeStatus } from '../hooks/useRealtimeSync';

interface RealtimeStatusIndicatorProps {
  status: RealtimeStatus;
}

const STATUS_CONFIG: Record<Exclude<RealtimeStatus, 'idle'>, {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
}> = {
  connecting: {
    label: 'Conectando atualização em tempo real',
    className: 'text-amber-500',
    icon: RefreshCw,
  },
  connected: {
    label: 'Atualização em tempo real conectada',
    className: 'text-emerald-500',
    icon: CheckCircle2,
  },
  reconnecting: {
    label: 'Reconectando atualização em tempo real',
    className: 'text-amber-500',
    icon: RefreshCw,
  },
  disconnected: {
    label: 'Atualização em tempo real indisponível',
    className: 'text-rose-500',
    icon: AlertCircle,
  },
  offline: {
    label: 'Sem internet. Atualização em tempo real pausada',
    className: 'text-rose-500',
    icon: AlertCircle,
  },
  error: {
    label: 'Erro na atualização em tempo real',
    className: 'text-rose-500',
    icon: AlertCircle,
  },
};

export function RealtimeStatusIndicator({ status }: RealtimeStatusIndicatorProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const config = useMemo(() => {
    if (status === 'idle') return null;
    return STATUS_CONFIG[status];
  }, [status]);

  useEffect(() => {
    if (!isTooltipOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsTooltipOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isTooltipOpen]);

  if (!config) return null;

  const Icon = config.icon;
  const animated = status === 'connecting' || status === 'reconnecting';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-slate-200 bg-white/95 shadow-sm transition-colors hover:bg-slate-50 ${config.className}`}
        title={config.label}
        aria-label={config.label}
        aria-expanded={isTooltipOpen}
        aria-haspopup="dialog"
        data-testid="realtime-status-button"
        onClick={() => setIsTooltipOpen((current) => !current)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
            setIsTooltipOpen(false);
          }
        }}
      >
        <Icon className={`h-5 w-5 ${animated ? 'animate-spin' : ''}`} />
      </button>

      {isTooltipOpen && (
        <div
          role="dialog"
          aria-live="polite"
          className="absolute right-0 top-12 z-20 w-52 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-700 shadow-lg"
          data-testid="realtime-status-tooltip"
        >
          {config.label}
        </div>
      )}
    </div>
  );
}
