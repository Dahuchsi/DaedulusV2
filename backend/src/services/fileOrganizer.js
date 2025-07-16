const path = require('path');
const fs = require('fs').promises;
const { DOWNLOAD_PATHS } = require('../config/constants');

class FileOrganizer {
    async organizeFile(filePath, fileType, torrentName) {
        try {
            const destinationDir = DOWNLOAD_PATHS[fileType];
            
            if (!destinationDir) {
                throw new Error(`Invalid file type: ${fileType}`);
            }
            
            // Ensure destination directory exists
            await fs.mkdir(destinationDir, { recursive: true });
            
            // Clean up filename
            const cleanedName = this.cleanFileName(torrentName);
            
            // For series, try to create season folders
            if (fileType === 'series') {
                const seasonFolder = this.extractSeasonFolder(torrentName);
                if (seasonFolder) {
                    const seriesName = this.extractSeriesName(torrentName);
                    const seriesPath = path.join(destinationDir, seriesName, seasonFolder);
                    await fs.mkdir(seriesPath, { recursive: true });
                    return seriesPath;
                }
            }
            
            // For music, try to create artist/album folders
            if (fileType === 'music') {
                const { artist, album } = this.extractMusicInfo(torrentName);
                if (artist && album) {
                    const musicPath = path.join(destinationDir, artist, album);
                    await fs.mkdir(musicPath, { recursive: true });
                    return musicPath;
                }
            }
            
            return destinationDir;
            
        } catch (error) {
            console.error('File organization error:', error);
            throw error;
        }
    }
    
    cleanFileName(fileName) {
        // Remove illegal characters for Windows file system
        return fileName.replace(/[<>:"/\\|?*]/g, '');
    }
    
    extractSeasonFolder(torrentName) {
        // Match patterns like S01, Season 1, etc.
        const seasonMatch = torrentName.match(/S(\d{1,2})|Season\s*(\d{1,2})/i);
        if (seasonMatch) {
            const seasonNumber = seasonMatch[1] || seasonMatch[2];
            return `Season ${parseInt(seasonNumber).toString().padStart(2, '0')}`;
        }
        return null;
    }
    
    extractSeriesName(torrentName) {
        // Try to extract series name before season info
        const cleanName = torrentName
            .replace(/S\d{1,2}E\d{1,2}/i, '')
            .replace(/Season\s*\d{1,2}/i, '')
            .replace(/\.\d{4}\./g, '.')
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/\./g, ' ')
            .trim();
            
        return this.cleanFileName(cleanName);
    }
    
    extractMusicInfo(torrentName) {
        // Try to extract artist and album from patterns like "Artist - Album"
        const match = torrentName.match(/^(.+?)\s*[-–]\s*(.+?)(?:\s*\[|\s*\(|$)/);
        if (match) {
            return {
                artist: this.cleanFileName(match[1].trim()),
                album: this.cleanFileName(match[2].trim())
            };
        }
        
        return { artist: null, album: null };
    }
    
    async moveFile(sourcePath, destinationPath) {
        try {
            await fs.rename(sourcePath, destinationPath);
        } catch (error) {
            // If rename fails (e.g., different drives), copy and delete
            if (error.code === 'EXDEV') {
                await this.copyFile(sourcePath, destinationPath);
                await fs.unlink(sourcePath);
            } else {
                throw error;
            }
        }
    }
    
    async copyFile(source, destination) {
        const readStream = fs.createReadStream(source);
        const writeStream = fs.createWriteStream(destination);
        
        return new Promise((resolve, reject) => {
            readStream.on('error', reject);
            writeStream.on('error', reject);
            writeStream.on('finish', resolve);
            readStream.pipe(writeStream);
        });
    }
}

module.exports = new FileOrganizer();