// src/controllers/downloadController.js

const { Download } = require('../models');
const downloadManager = require('../services/downloadManager');
const torrentSearchService = require('../services/torrentSearchService');
const alldebridService = require('../services/alldebridService');

const downloadController = {
    async getDownloads(req, res, next) {
        try {
            const downloads = await Download.findAll({
                where: { user_id: req.user.id },
                order: [['created_at', 'DESC']]
            });
            res.json(downloads);
        } catch (error) {
            console.error('❌ Sequelize error in getDownloads:', error.message);
            console.error('Full error:', error);
            res.status(500).json({ error: 'Failed to fetch downloads', detail: error.message });
        }
    },

    async queueDownload(req, res, next) {
        try {
            const { torrentInfo, fileType } = req.body;

            if (!torrentInfo || !fileType) {
                return res.status(400).json({ error: 'Torrent information and file type are required.' });
            }

            // Check for an existing magnet link in the data from the frontend.
            let magnetLink = torrentInfo.magnetLink;

            // If no magnet link is found, use the search service to fetch it.
            if (!magnetLink || magnetLink.length === 0) {
                console.log(`Magnet link not found for "${torrentInfo.name}", attempting to fetch...`);
                magnetLink = await torrentSearchService.getMagnet(torrentInfo);
            }

            // If after all that, we still don't have a magnet link, return a clear error.
            if (!magnetLink) {
                console.error(`Could not retrieve magnet link for ${torrentInfo.name}`);
                return res.status(400).json({ error: 'Unable to retrieve magnet link for this torrent.' });
            }

            const download = await downloadManager.queueDownload(
                req.user.id,
                torrentInfo,
                magnetLink,
                fileType
            );

            res.status(201).json(download);

        } catch (error) {
            console.error('❌ Queue download error:', error.message);
            console.error('Full error:', error);
            res.status(500).json({ message: 'Failed to queue download', detail: error.parent?.detail || error.message });
        }
    },

    async getDownloadStatus(req, res, next) {
        try {
            const { id } = req.params;
            const download = await Download.findOne({ where: { id, user_id: req.user.id } });
            if (!download) return res.status(404).json({ error: 'Download not found' });
            res.json(download);
        } catch (error) {
            console.error('❌ Sequelize error in getDownloadStatus:', error.message);
            console.error('Full error:', error);
            res.status(500).json({ error: 'Failed to get download status', detail: error.message });
        }
    },

    async deleteDownload(req, res, next) {
        try {
            const { id } = req.params;
            const download = await Download.findOne({ where: { id, user_id: req.user.id } });
            if (!download) return res.status(404).json({ error: 'Download not found' });
            await download.destroy();
            res.json({ message: 'Download deleted successfully' });
        } catch (error) {
            console.error('❌ Sequelize error in deleteDownload:', error.message);
            console.error('Full error:', error);
            res.status(500).json({ error: 'Failed to delete download', detail: error.message });
        }
    },

    // NEW: Retry failed downloads
    async retryDownload(req, res, next) {
        try {
            const { id } = req.params;
            const download = await Download.findOne({ where: { id, user_id: req.user.id } });

            if (!download) {
                return res.status(404).json({ error: 'Download not found' });
            }

            console.log(`Retrying download: ${download.torrent_name}`);

            // Reset the download status and progress
            await download.update({
                status: 'queued',
                debriding_progress: 0.00,
                transfer_progress: 0.00,
                download_speed: 0,
                alldebrid_id: null
            });

            // Restart the download process
            downloadManager.processDownload(download.id);

            res.json({ message: 'Download retry initiated', download });
        } catch (error) {
            console.error('❌ Retry download error:', error.message);
            console.error('Full error:', error);
            res.status(500).json({ error: 'Failed to retry download', detail: error.message });
        }
    },

    // NEW: Check AllDebrid status manually
    async checkAllDebridStatus(req, res, next) {
        try {
            const { id } = req.params;
            const download = await Download.findOne({ where: { id, user_id: req.user.id } });

            if (!download) {
                return res.status(404).json({ error: 'Download not found' });
            }

            if (!download.alldebrid_id) {
                return res.status(400).json({ error: 'No AllDebrid ID found for this download. Try retrying the download.' });
            }

            console.log(`Checking AllDebrid status for: ${download.torrent_name} (ID: ${download.alldebrid_id})`);

            // Force check AllDebrid status
            const statusResponse = await alldebridService.getMagnetStatus(download.alldebrid_id);

            if (statusResponse.status === 'success') {
                const magnetStatus = statusResponse.data.magnets;
                console.log(`AllDebrid status for ${download.torrent_name}:`, magnetStatus.status);

                if (magnetStatus.status === 'Ready') {
                    console.log(`Download ${download.torrent_name} is ready, switching to transferring`);
                    await download.update({
                        status: 'transferring',
                        debriding_progress: 100.00
                    });

                    // Restart the download process from transferring
                    downloadManager.continueTransfer(download.id, download.alldebrid_id);

                } else if (magnetStatus.status === 'Downloading') {
                    console.log(`Download ${download.torrent_name} is still processing, switching to debriding`);
                    const progress = magnetStatus.size > 0 ? (magnetStatus.downloaded / magnetStatus.size * 100) : 0;
                    await download.update({
                        status: 'debriding',
                        debriding_progress: parseFloat(progress.toFixed(2))
                    });

                    // Resume monitoring
                    downloadManager.monitorDownload(download.id, download.alldebrid_id);

                } else if (magnetStatus.status === 'Error') {
                    console.log(`Download ${download.torrent_name} failed on AllDebrid`);
                    await download.update({ status: 'failed' });
                }

                // Refresh the download object
                await download.reload();
                res.json({ message: 'Status check completed', download });
            } else {
                console.error('Failed to check AllDebrid status:', statusResponse.error);
                res.status(500).json({ error: 'Failed to check AllDebrid status', detail: statusResponse.error?.message });
            }

        } catch (error) {
            console.error('❌ Check AllDebrid status error:', error.message);
            console.error('Full error:', error);
            res.status(500).json({ error: 'Failed to check AllDebrid status', detail: error.message });
        }
    }
};

module.exports = downloadController;