const { createWriteStream } = require('fs');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { DOWNLOAD_PATHS } = require('../config/constants');
const alldebridService = require('./alldebridService');
const { Download } = require('../models');

const parseSizeInBytes = (sizeString) => {
    if (!sizeString || typeof sizeString !== 'string') return 0;
    const units = { 'B': 1, 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024, 'TB': 1024 * 1024 * 1024 * 1024 };
    const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    return Math.round(value * (units[unit] || 1));
};

class DownloadManager {
    constructor() {
        this.activeDownloads = new Map();
        this.transferStats = new Map();
        this.io = null;
    }

    setSocketIO(io) {
        this.io = io;
    }

    async queueDownload(userId, torrentInfo, magnetLink, fileType) {
        try {
            const download = await Download.create({
                user_id: userId,
                torrent_name: torrentInfo.name,
                magnet_link: magnetLink,
                file_type: fileType,
                file_size: parseSizeInBytes(torrentInfo.size),
                quality: torrentInfo.quality,
                status: 'queued',
                debriding_progress: 0.00,
                transfer_progress: 0.00,
                download_speed: 0
            });

            this.processDownload(download.id);
            return download;
        } catch (error) {
            console.error("Failed to create download record:", error);
            throw error;
        }
    }

    async processDownload(downloadId) {
        const download = await Download.findByPk(downloadId);
        if (!download) {
            console.error(`Download with ID ${downloadId} not found for processing.`);
            return;
        }

        try {
            console.log(`Starting to process download: ${download.torrent_name}`);
            await download.update({ status: 'debriding' });

            const magnetResponse = await alldebridService.addMagnet(download.magnet_link);

            if (magnetResponse.status !== 'success') {
                const errorMessage = magnetResponse.error?.message || 'Unknown AllDebrid error';
                console.error(`AllDebrid failed to add magnet for download ${downloadId}: ${errorMessage}`);
                await download.update({ status: 'failed' });

                if (this.io) {
                    this.io.to(`user_${download.user_id}`).emit('download:failed', {
                        downloadId: download.id,
                        error: errorMessage
                    });
                }
                return;
            }

            const magnetId = magnetResponse.data.magnets[0].id;
            console.log(`AllDebrid magnet added successfully. ID: ${magnetId}`);

            await download.update({ alldebrid_id: magnetId });
            this.monitorDownload(downloadId, magnetId);

        } catch (error) {
            console.error(`Critical error in processDownload for ID ${downloadId}:`, error);
            await download.update({ status: 'failed' });

            if (this.io) {
                this.io.to(`user_${download.user_id}`).emit('download:failed', {
                    downloadId: downloadId,
                    error: error.message
                });
            }
        }
    }

    async monitorDownload(downloadId, magnetId) {
        if (this.activeDownloads.has(downloadId)) {
            clearInterval(this.activeDownloads.get(downloadId));
        }

        console.log(`Starting to monitor download ${downloadId} with magnet ID ${magnetId}`);

        const interval = setInterval(async () => {
            try {
                const download = await Download.findByPk(downloadId);
                if (!download || ['completed', 'failed'].includes(download.status)) {
                    console.log(`Download ${downloadId} finished monitoring (status: ${download?.status})`);
                    clearInterval(interval);
                    this.activeDownloads.delete(downloadId);
                    return;
                }

                const statusResponse = await alldebridService.getMagnetStatus(magnetId);

                if (statusResponse.status !== 'success') {
                    console.error(`AllDebrid status check failed for magnet ${magnetId}:`, statusResponse.error?.message);
                    return;
                }

                const magnetStatus = statusResponse.data.magnets;
                console.log(`Download ${download.torrent_name} status: ${magnetStatus.status}`);

                if (magnetStatus.status === 'Ready') {
                    console.log(`Download ${download.torrent_name} is ready for transfer`);
                    clearInterval(interval);
                    this.activeDownloads.delete(downloadId);

                    await download.update({
                        status: 'transferring',
                        debriding_progress: 100.00
                    });

                    if (this.io) {
                        this.io.to(`user_${download.user_id}`).emit('download:progress', {
                            downloadId: download.id,
                            progress: 100,
                            speed: 0,
                            status: 'transferring'
                        });
                    }

                    this.continueTransfer(downloadId, magnetId);

                } else if (magnetStatus.status === 'Error') {
                    console.error(`Download ${download.torrent_name} failed on AllDebrid`);
                    clearInterval(interval);
                    this.activeDownloads.delete(downloadId);
                    await download.update({ status: 'failed' });

                    if (this.io) {
                        this.io.to(`user_${download.user_id}`).emit('download:failed', {
                            downloadId: download.id,
                            error: 'AllDebrid processing failed'
                        });
                    }

                } else if (magnetStatus.status === 'Downloading') {
                    const progress = magnetStatus.size > 0 ? (magnetStatus.downloaded / magnetStatus.size * 100) : 0;
                    const speed = magnetStatus.downloadSpeed || 0;

                    console.log(`Download ${download.torrent_name} progress: ${progress.toFixed(2)}% (${speed} B/s)`);

                    await download.update({
                        debriding_progress: parseFloat(progress.toFixed(2)),
                        download_speed: parseInt(speed)
                    });

                    if (this.io) {
                        this.io.to(`user_${download.user_id}`).emit('download:progress', {
                            downloadId: download.id,
                            progress: parseFloat(progress.toFixed(2)),
                            speed: parseInt(speed),
                            status: 'debriding'
                        });
                    }
                } else {
                    console.log(`Download ${download.torrent_name} status: ${magnetStatus.status} (waiting)`);
                }
            } catch (error) {
                console.error('Monitor error:', error);
            }
        }, 8000);

        this.activeDownloads.set(downloadId, interval);
    }

    async supportsPartialDownload(url) {
        try {
            const response = await axios.head(url, { timeout: 10000 });
            return response.headers['accept-ranges'] === 'bytes';
        } catch (error) {
            console.log('Could not check partial download support:', error.message);
            return false;
        }
    }

    async getExistingFiles(downloadPath, expectedFiles) {
        try {
            const existingFiles = new Map();

            try {
                await fs.access(downloadPath);
            } catch {
                return existingFiles;
            }

            const getAllFiles = async (dir) => {
                const files = [];
                const entries = await fs.readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        files.push(...await getAllFiles(fullPath));
                    } else {
                        const stats = await fs.stat(fullPath);
                        files.push({
                            name: entry.name,
                            path: fullPath,
                            size: stats.size
                        });
                    }
                }
                return files;
            };

            const existingFileList = await getAllFiles(downloadPath);

            for (const expectedFile of expectedFiles) {
                const cleanExpectedName = this.cleanFileName(expectedFile.filename);
                const existingFile = existingFileList.find(f =>
                    this.cleanFileName(f.name) === cleanExpectedName ||
                    f.name === expectedFile.filename
                );

                if (existingFile) {
                    const expectedSize = expectedFile.size || 0;
                    const actualSize = existingFile.size;

                    const isComplete = actualSize >= expectedSize * 0.99;
                    const isPartial = actualSize > 0 && actualSize < expectedSize * 0.99;

                    existingFiles.set(expectedFile.filename, {
                        path: existingFile.path,
                        size: actualSize,
                        exists: true,
                        isComplete: isComplete,
                        isPartial: isPartial,
                        expectedSize: expectedSize,
                        canResume: isPartial && expectedSize > 0
                    });

                    if (isComplete) {
                        console.log(`✅ Complete file: ${expectedFile.filename} (${actualSize} bytes)`);
                    } else if (isPartial) {
                        console.log(`⏸️  Partial file: ${expectedFile.filename} (${actualSize}/${expectedSize} bytes, ${((actualSize/expectedSize)*100).toFixed(1)}%)`);
                    }
                } else {
                    existingFiles.set(expectedFile.filename, {
                        exists: false,
                        expectedSize: expectedFile.size || 0
                    });
                }
            }

            return existingFiles;
        } catch (error) {
            console.error('Error checking existing files:', error);
            return new Map();
        }
    }

    async continueTransfer(downloadId, magnetId) {
        try {
            const download = await Download.findByPk(downloadId);
            if (!download) {
                console.error(`Download ${downloadId} not found for transfer`);
                return;
            }

            console.log(`Starting smart resume transfer for: ${download.torrent_name}`);

            const statusResponse = await alldebridService.getMagnetStatus(magnetId);

            if (statusResponse.status !== 'success' || statusResponse.data.magnets.status !== 'Ready') {
                console.error(`Download ${downloadId} is not ready for transfer`);
                await download.update({ status: 'failed' });
                return;
            }

            const magnetStatus = statusResponse.data.magnets;
            const allFiles = magnetStatus.links;
            const downloadPath = DOWNLOAD_PATHS[download.file_type];

            if (!downloadPath) {
                console.error(`No download path configured for file type: ${download.file_type}`);
                await download.update({ status: 'failed' });
                return;
            }

            const existingFiles = await this.getExistingFiles(downloadPath, allFiles);

            const completeFiles = [];
            const partialFiles = [];
            const missingFiles = [];

            for (const file of allFiles) {
                const existing = existingFiles.get(file.filename);
                if (!existing || !existing.exists) {
                    missingFiles.push(file);
                } else if (existing.isComplete) {
                    completeFiles.push(file);
                } else if (existing.isPartial) {
                    partialFiles.push({ ...file, existing });
                } else {
                    missingFiles.push(file);
                }
            }

            const totalFiles = allFiles.length;
            const filesToProcess = [...missingFiles, ...partialFiles];

            console.log(`📊 Transfer resume summary for ${download.torrent_name}:`);
            console.log(`   Total files: ${totalFiles}`);
            console.log(`   ✅ Complete: ${completeFiles.length}`);
            console.log(`   ⏸️  Partial: ${partialFiles.length}`);
            console.log(`   ❌ Missing: ${missingFiles.length}`);
            console.log(`   🔄 To process: ${filesToProcess.length}`);

            if (filesToProcess.length === 0) {
                console.log(`🎉 All files already downloaded for: ${download.torrent_name}`);
                await download.update({
                    status: 'completed',
                    completed_at: new Date(),
                    transfer_progress: 100.00,
                    download_speed: 0
                });

                if (this.io) {
                    this.io.to(`user_${download.user_id}`).emit('download:complete', {
                        downloadId: download.id,
                        name: download.torrent_name
                    });
                }
                return;
            }

            this.transferStats.set(downloadId, {
                startTime: Date.now(),
                bytesDownloaded: 0,
                totalBytes: filesToProcess.reduce((sum, file) => sum + (file.size || 0), 0),
                currentSpeed: 0
            });

            const initialProgress = (completeFiles.length / totalFiles) * 100;
            await download.update({
                transfer_progress: parseFloat(initialProgress.toFixed(2))
            });

            const transferInterval = setInterval(async () => {
                const stats = this.transferStats.get(downloadId);
                if (!stats) {
                    clearInterval(transferInterval);
                    return;
                }

                const currentDownload = await Download.findByPk(downloadId);
                if (!currentDownload || currentDownload.status !== 'transferring') {
                    clearInterval(transferInterval);
                    this.transferStats.delete(downloadId);
                    return;
                }

                if (this.io) {
                    this.io.to(`user_${currentDownload.user_id}`).emit('download:progress', {
                        downloadId: currentDownload.id,
                        progress: parseFloat(currentDownload.transfer_progress),
                        speed: stats.currentSpeed,
                        status: 'transferring',
                        transfer_progress: parseFloat(currentDownload.transfer_progress)
                    });
                }
            }, 2000);

            let completedFiles = completeFiles.length;

            for (let i = 0; i < filesToProcess.length; i++) {
                const file = filesToProcess[i];
                const isPartialResume = file.existing && file.existing.isPartial;

                if (isPartialResume) {
                    console.log(`🔄 Resuming partial file ${i + 1}/${filesToProcess.length}: ${file.filename} (from ${file.existing.size} bytes)`);
                } else {
                    console.log(`⬇️  Downloading file ${i + 1}/${filesToProcess.length}: ${file.filename}`);
                }

                const unlockedLinkResponse = await alldebridService.unlockLink(file.link);
                if (unlockedLinkResponse.status === 'success') {
                    if (isPartialResume) {
                        const resumed = await this.resumePartialFile(
                            download,
                            unlockedLinkResponse.data.link,
                            file.filename,
                            file.existing,
                            downloadId
                        );

                        if (!resumed) {
                            console.log(`⚠️  Partial resume failed for ${file.filename}, downloading from start`);
                            await this.downloadFileWithSpeed(
                                download,
                                unlockedLinkResponse.data.link,
                                file.filename,
                                downloadId,
                                true
                            );
                        }
                    } else {
                        await this.downloadFileWithSpeed(
                            download,
                            unlockedLinkResponse.data.link,
                            file.filename,
                            downloadId
                        );
                    }

                    completedFiles++;

                    const transferProgress = (completedFiles / totalFiles) * 100;
                    await download.update({
                        transfer_progress: parseFloat(transferProgress.toFixed(2))
                    });

                    console.log(`✅ File completed. Overall progress: ${transferProgress.toFixed(2)}% (${completedFiles}/${totalFiles} files)`);

                } else {
                    console.error(`❌ Failed to unlock link: ${file.link}`);
                }
            }

            clearInterval(transferInterval);
            this.transferStats.delete(downloadId);

            await download.update({
                status: 'completed',
                completed_at: new Date(),
                transfer_progress: 100.00,
                download_speed: 0
            });

            console.log(`🎉 Download completed: ${download.torrent_name}`);

            if (this.io) {
                this.io.to(`user_${download.user_id}`).emit('download:complete', {
                    downloadId: download.id,
                    name: download.torrent_name
                });
            }

        } catch (error) {
            console.error(`Transfer error for download ${downloadId}:`, error);
            const download = await Download.findByPk(downloadId);
            if (download) {
                await download.update({ status: 'failed' });
            }
            this.transferStats.delete(downloadId);
        }
    }

    async resumePartialFile(download, fileUrl, filename, existingFileInfo, downloadId) {
        try {
            const cleanFilename = this.cleanFileName(filename);
            const downloadPath = DOWNLOAD_PATHS[download.file_type];
            const filePath = path.join(downloadPath, cleanFilename);

            const startByte = existingFileInfo.size;
            const expectedSize = existingFileInfo.expectedSize;

            console.log(`🔄 Attempting to resume ${cleanFilename} from byte ${startByte} (${((startByte/expectedSize)*100).toFixed(1)}% already downloaded)`);

            const supportsPartial = await this.supportsPartialDownload(fileUrl);
            if (!supportsPartial) {
                console.log(`⚠️  Server doesn't support partial downloads for ${cleanFilename}`);
                return false;
            }

            const writer = createWriteStream(filePath, { flags: 'a' });

            const response = await axios({
                method: 'GET',
                url: fileUrl,
                responseType: 'stream',
                timeout: 300000,
                headers: {
                    'Range': `bytes=${startByte}-`
                }
            });

            if (response.status !== 206) {
                console.log(`⚠️  Server didn't return partial content (status: ${response.status})`);
                writer.destroy();
                return false;
            }

            console.log(`✅ Server supports partial download, resuming ${cleanFilename} from ${startByte} bytes`);

            let bytesDownloaded = 0;
            let lastUpdate = Date.now();
            let lastBytes = 0;

            const stats = this.transferStats.get(downloadId);

            response.data.on('data', (chunk) => {
                bytesDownloaded += chunk.length;

                if (stats) {
                    stats.bytesDownloaded += chunk.length;

                    const now = Date.now();
                    if (now - lastUpdate >= 1000) {
                        const timeDiff = (now - lastUpdate) / 1000;
                        const bytesDiff = bytesDownloaded - lastBytes;
                        const currentSpeed = Math.round(bytesDiff / timeDiff);

                        stats.currentSpeed = currentSpeed;
                        lastUpdate = now;
                        lastBytes = bytesDownloaded;

                        const totalDownloaded = startByte + bytesDownloaded;
                        const percentComplete = ((totalDownloaded / expectedSize) * 100).toFixed(1);
                        console.log(`🔄 Resuming ${cleanFilename}: ${percentComplete}% (${this.formatSpeed(currentSpeed)})`);
                    }
                }
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    const totalSize = startByte + bytesDownloaded;
                    console.log(`✅ Successfully resumed: ${cleanFilename} (${bytesDownloaded} new bytes, ${totalSize} total)`);
                    resolve(true);
                });
                writer.on('error', (err) => {
                    console.error(`❌ Error resuming file ${cleanFilename}:`, err);
                    resolve(false);
                });
            });

        } catch (error) {
            console.error(`❌ Failed to resume file ${filename}:`, error);
            return false;
        }
    }

    async downloadFileWithSpeed(download, fileUrl, filename, downloadId, overwrite = false) {
        try {
            const cleanFilename = this.cleanFileName(filename);
            const downloadPath = DOWNLOAD_PATHS[download.file_type];
            const filePath = path.join(downloadPath, cleanFilename);

            await fs.mkdir(downloadPath, { recursive: true });

            if (!overwrite) {
                try {
                    const existingStats = await fs.stat(filePath);
                    if (existingStats.size > 0) {
                        console.log(`File ${cleanFilename} already exists (${existingStats.size} bytes), skipping download`);
                        return existingStats.size;
                    }
                } catch {
                    // File doesn't exist, proceed with download
                }
            }

            console.log(`⬇️  Downloading file to: ${filePath}`);

            const writer = createWriteStream(filePath);
            const response = await axios({
                method: 'GET',
                url: fileUrl,
                responseType: 'stream',
                timeout: 300000
            });

            let bytesDownloaded = 0;
            let lastUpdate = Date.now();
            let lastBytes = 0;

            const stats = this.transferStats.get(downloadId);

            response.data.on('data', (chunk) => {
                bytesDownloaded += chunk.length;

                if (stats) {
                    stats.bytesDownloaded += chunk.length;

                    const now = Date.now();
                    if (now - lastUpdate >= 1000) {
                        const timeDiff = (now - lastUpdate) / 1000;
                        const bytesDiff = bytesDownloaded - lastBytes;
                        const currentSpeed = Math.round(bytesDiff / timeDiff);

                        stats.currentSpeed = currentSpeed;
                        lastUpdate = now;
                        lastBytes = bytesDownloaded;
                    }
                }
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`✅ Successfully downloaded: ${cleanFilename} (${bytesDownloaded} bytes)`);
                    resolve(bytesDownloaded);
                });
                writer.on('error', (err) => {
                    console.error(`❌ Error writing file ${cleanFilename}:`, err);
                    reject(err);
                });
            });
        } catch (error) {
            console.error(`❌ Failed to download file from ${fileUrl}:`, error);
            throw error;
        }
    }

    cleanFileName(fileName) {
        return fileName.replace(/[<>:"/\\|?*]/g, '').toLowerCase().trim();
    }

    formatSpeed(bytesPerSecond) {
        if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s';
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const index = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
        return `${(bytesPerSecond / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
    }

    cleanup() {
        console.log('Cleaning up download manager...');
        this.activeDownloads.forEach((interval, downloadId) => {
            clearInterval(interval);
        });
        this.activeDownloads.clear();
        this.transferStats.clear();
    }
}

module.exports = new DownloadManager();