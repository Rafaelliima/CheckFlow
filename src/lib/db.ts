import Dexie, { Table } from 'dexie';
import { Analysis, AnalysisItem } from '../types';

export interface SyncOperation {
  id?: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'analyses' | 'analysis_items';
  recordId: string;
  payload: any;
  timestamp: number;
  retryCount?: number;
}

export class RondaDB extends Dexie {
  analyses!: Table<Analysis, string>;
  analysis_items!: Table<AnalysisItem, string>;
  sync_queue!: Table<SyncOperation, number>;

  constructor() {
    super('RondaDB');
    this.version(1).stores({
      analyses: 'id, user_id, created_at',
      analysis_items: 'id, analysis_id, created_at',
      sync_queue: '++id, timestamp'
    });
  }
}

export const db = new RondaDB();
