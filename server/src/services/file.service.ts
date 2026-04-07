import { FileEntry, StorageSummary } from '../types';
import { adbService } from './adb.service';
import { config } from '../config';

class FileService {
  async listFiles(serial: string, path: string = '/sdcard', minSize: number = 0): Promise<FileEntry[]> {
    const result = await adbService.shell(serial, `ls -la "${path}" 2>/dev/null`);
    const lines = result.stdout.split('\n').filter((l) => l.trim() && !l.startsWith('total'));

    const entries: FileEntry[] = [];
    for (const line of lines) {
      const entry = this.parseLsLine(line, path);
      if (entry && entry.sizeBytes >= minSize) {
        entries.push(entry);
      }
    }

    return entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  async getLargeFiles(serial: string, path: string = '/sdcard', limit: number = 50): Promise<FileEntry[]> {
    const result = await adbService.shell(
      serial,
      `find "${path}" -type f -size +1M -exec ls -la {} \\; 2>/dev/null | sort -k5 -rn | head -${limit}`
    );

    const entries: FileEntry[] = [];
    for (const line of result.stdout.split('\n').filter((l) => l.trim())) {
      const entry = this.parseLsFullPath(line);
      if (entry) entries.push(entry);
    }

    return entries;
  }

  private parseLsLine(line: string, parentPath: string): FileEntry | null {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 7) return null;

    const permissions = parts[0];
    const isDirectory = permissions.startsWith('d');
    const name = parts.slice(6).join(' ');

    if (name === '.' || name === '..') return null;

    const sizeStr = parts[3];
    const sizeBytes = parseInt(sizeStr, 10) || 0;

    const dateStr = `${parts[4]} ${parts[5]}`;

    return {
      path: `${parentPath}/${name}`.replace(/\/+/g, '/'),
      name,
      sizeBytes: isDirectory ? 0 : sizeBytes,
      isDirectory,
      modifiedAt: dateStr,
    };
  }

  private parseLsFullPath(line: string): FileEntry | null {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 7) return null;

    const sizeBytes = parseInt(parts[4], 10) || 0;
    const fullPath = parts.slice(7).join(' ');
    const name = fullPath.split('/').pop() || fullPath;

    return {
      path: fullPath,
      name,
      sizeBytes,
      isDirectory: false,
      modifiedAt: `${parts[5]} ${parts[6]}`,
    };
  }

  async getStorageSummary(serial: string): Promise<StorageSummary> {
    const result = await adbService.shell(serial, 'df /data');
    const lines = result.stdout.split('\n').filter((l) => l.trim() && !l.startsWith('Filesystem'));

    if (lines.length === 0) {
      return { totalBytes: 0, usedBytes: 0, freeBytes: 0 };
    }

    const parts = lines[0].trim().split(/\s+/);
    const totalBytes = (parseInt(parts[1], 10) || 0) * 1024;
    const usedBytes = (parseInt(parts[2], 10) || 0) * 1024;
    const freeBytes = (parseInt(parts[3], 10) || 0) * 1024;

    return { totalBytes, usedBytes, freeBytes };
  }

  async pushFile(serial: string, localPath: string, devicePath: string): Promise<boolean> {
    const result = await adbService.executeForDevice(
      serial,
      ['push', localPath, devicePath],
      config.uploadTimeout
    );
    const output = result.stdout + result.stderr;
    return output.includes('pushed') || output.includes('file pushed');
  }

  async pullFile(serial: string, devicePath: string, localPath: string): Promise<boolean> {
    const result = await adbService.executeForDevice(
      serial,
      ['pull', devicePath, localPath],
      config.uploadTimeout
    );
    const output = result.stdout + result.stderr;
    return output.includes('pulled') || output.includes('file pulled');
  }

  async deleteFile(serial: string, filePath: string): Promise<boolean> {
    const result = await adbService.shell(serial, `rm -f "${filePath}"`);
    return result.exitCode === 0;
  }

  async deleteDirectory(serial: string, dirPath: string): Promise<boolean> {
    const result = await adbService.shell(serial, `rm -rf "${dirPath}"`);
    return result.exitCode === 0;
  }
}

export const fileService = new FileService();
