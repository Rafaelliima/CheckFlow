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

export interface FailedOperation {
  id?: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'analyses' | 'analysis_items';
  recordId: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  failedAt: number;
}

export class RondaDB extends Dexie {
  analyses!: Table<Analysis, string>;
  analysis_items!: Table<AnalysisItem, string>;
  sync_queue!: Table<SyncOperation, number>;
  failed_operations!: Table<FailedOperation, number>;

  constructor() {
    super('RondaDB');
    this.version(1).stores({
      analyses: 'id, user_id, created_at',
      analysis_items: 'id, analysis_id, created_at',
      sync_queue: '++id, timestamp'
    });
    this.version(2).stores({
      analyses: 'id, user_id, created_at',
      analysis_items: 'id, analysis_id, created_at',
      sync_queue: '++id, timestamp',
      failed_operations: '++id, failedAt, table, recordId'
    });
    this.version(3).stores({
      analyses: 'id, user_id, created_at',
      analysis_items: 'id, analysis_id, status, created_at',
      sync_queue: '++id, timestamp',
      failed_operations: '++id, failedAt, table, recordId'
    });
    this.version(4).stores({
      analyses: 'id, user_id, created_at',
      analysis_items: 'id, analysis_id, status, created_at, found_in_analysis_id',
      sync_queue: '++id, timestamp',
      failed_operations: '++id, failedAt, table, recordId'
    });
  }
}

export const db = new RondaDB();
