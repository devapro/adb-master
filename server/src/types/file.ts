export interface FileEntry {
  path: string;
  name: string;
  sizeBytes: number;
  isDirectory: boolean;
  modifiedAt: string;
}

export interface StorageSummary {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}
