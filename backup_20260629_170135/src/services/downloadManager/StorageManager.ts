import * as LegacyFileSystem from 'expo-file-system/legacy';
import {
  getDownloadsDirectory,
  getContentDirectory,
  ensureDirectoryExists,
  initializeDownloadsDirectory,
} from '../../utils/downloadStorage';

class StorageManager {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await initializeDownloadsDirectory();
    this.initialized = true;
  }

  async downloadFile(url, destPath, options = {}) {
    const { headers = {}, onProgress } = options;

    try {
      const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);

      const downloadResumable = LegacyFileSystem.createDownloadResumable(
        url,
        destPath,
        { headers },
        (downloadProgress) => {
          if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
            const progress = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
            onProgress({
              progress,
              bytesWritten: downloadProgress.totalBytesWritten,
              totalBytes: downloadProgress.totalBytesExpectedToWrite,
            });
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      return {
        success: true,
        uri: result.uri,
        status: result.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async downloadFileSimple(url, destPath, headers = {}) {
    try {
      const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);

      const result = await LegacyFileSystem.downloadAsync(url, destPath, { headers });
      return {
        success: result.status >= 200 && result.status < 300,
        uri: result.uri,
        status: result.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async writeFile(filePath, content) {
    try {
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);
      await LegacyFileSystem.writeAsStringAsync(filePath, content);
      return true;
    } catch (error) {
      return false;
    }
  }

  async readFile(filePath) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(filePath);
      if (!info.exists) return null;
      return await LegacyFileSystem.readAsStringAsync(filePath);
    } catch (error) {
      return null;
    }
  }

  async deleteFile(filePath) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(filePath);
      if (info.exists) {
        await LegacyFileSystem.deleteAsync(filePath, { idempotent: true });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteDirectory(dirPath) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(dirPath);
      if (info.exists) {
        await LegacyFileSystem.deleteAsync(dirPath, { idempotent: true });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async fileExists(filePath) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(filePath);
      return info.exists;
    } catch (error) {
      return false;
    }
  }

  async getFileInfo(filePath) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(filePath, { size: true });
      if (!info.exists) return null;
      return {
        exists: info.exists,
        size: info.size || 0,
        uri: info.uri,
        isDirectory: false,
      };
    } catch (error) {
      return null;
    }
  }

  async getDirectoryContents(dirPath) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(dirPath);
      if (!info.exists) return [];
      return await LegacyFileSystem.readDirectoryAsync(dirPath);
    } catch (error) {
      return [];
    }
  }

  async getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      const contents = await this.getDirectoryContents(dirPath);

      for (const item of contents) {
        const itemPath = `${dirPath}/${item}`;
        try {
          const info = await LegacyFileSystem.getInfoAsync(itemPath, { size: true });
          if (info.isDirectory) {
            totalSize += await this.getDirectorySize(itemPath);
          } else if (info.exists) {
            totalSize += info.size || 0;
          }
        } catch (e) {
          // Skip items that can't be read
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  async getAvailableStorage() {
    try {
      const freeSpace = await LegacyFileSystem.getFreeDiskStorageAsync();
      return freeSpace;
    } catch (error) {
      return 0;
    }
  }

  async getTotalStorage() {
    try {
      const totalSpace = await LegacyFileSystem.getTotalDiskCapacityAsync();
      return totalSpace;
    } catch (error) {
      return 0;
    }
  }

  async copyFile(sourcePath, destPath) {
    try {
      const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);
      await LegacyFileSystem.copyAsync({ from: sourcePath, to: destPath });
      return true;
    } catch (error) {
      return false;
    }
  }

  async moveFile(sourcePath, destPath) {
    try {
      const dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
      await ensureDirectoryExists(dirPath);
      await LegacyFileSystem.moveAsync({ from: sourcePath, to: destPath });
      return true;
    } catch (error) {
      return false;
    }
  }

  getContentDirectory(mediaType, tmdbId, season = null, episode = null) {
    return getContentDirectory(mediaType, tmdbId, season, episode);
  }

  getDownloadsDirectory() {
    return getDownloadsDirectory();
  }
}

const storageManager = new StorageManager();
export default storageManager;