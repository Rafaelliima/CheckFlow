import React, { useState, useEffect } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { subscribeSyncStatus } from '../lib/sync';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPendingCount, setSyncPendingCount] = useState(0);
  
  const pendingCount = useLiveQuery(() => db.sync_queue.count()) || 0;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubscribeSyncStatus = subscribeSyncStatus((status) => {
      setIsSyncing(status.isProcessing);
      setSyncPendingCount(status.pendingCount);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeSyncStatus();
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-center text-sm font-medium shadow-md">
        <WifiOff className="w-4 h-4 mr-2" />
        <span>Modo Offline</span>
        {pendingCount > 0 && (
          <span className="ml-2 bg-white text-amber-600 px-2 py-0.5 rounded-full text-xs font-bold">
            {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }

  if (isSyncing && syncPendingCount > 0) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-cyan-600 text-white px-4 py-2 flex items-center justify-center text-sm font-medium shadow-md"
        data-testid="syncing-indicator"
      >
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        <span>Sincronizando {syncPendingCount} ite{syncPendingCount !== 1 ? 'ns' : 'm'}...</span>
      </div>
    );
  }

  return null;
}
