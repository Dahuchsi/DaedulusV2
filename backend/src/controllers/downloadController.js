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
            res.status(500).json({ error: 'Failed to fetch downloads', detail: error.message });
        }
    },

    async queueDownload(req, res, next) {
        try {
            const { torrentInfo, fileType } = req.body;

            if (!torrentInfo || !fileType) {
                return res.status(400).json({ error: 'Torrent information and file type are required.' });
            }

            let magnetLink = torrentInfo.magnetLink;

            if (!magnetLink || magnetLink.length === 0) {
                console.log(`Magnet link not found for "${torrentInfo.name}", attempting to fetch...`);
                magnetLink = await torrentSearchService.getMagnet(torrentInfo);
            }

            if (!magnetLink) {
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
            res.status(500).json({ message: 'Failed to queue download', detail: error.parent?.detail || error.message });
        }
    },

    // --- NEW: Auto Download for Trending Items ---
    async autoQueue(req, res, next) {
        try {
            const { title, year, media_type } = req.body; // media_type: 'movie' | 'tv'

            if (!title) return res.status(400).json({ error: 'Title is required' });

            console.log(`Auto-Download requested for: ${title} (${year}) [${media_type}]`);

            // 1. Search
            const query = `${title} ${year || ''}`;
            const results = await torrentSearchService.search(query);

            if (results.length === 0) {
                return res.status(404).json({ error: 'No torrents found for this title.' });
            }

            // 2. Filter & Pick Best
            // We trust the search service sorting (Relevance > Seeders)
            // But we should check type match if possible

            // If TV: Prefer Complete Season > S01 > Single Ep?
            // Actually, if it's a trending NEW show, maybe we want S01E01?
            // But usually "Trending" means "Popular right now".
            // If it's a new show, S01 is safest.
            // If it's a movie, pick top result.

            let bestMatch = results[0];

            // Refine for TV
            if (media_type === 'tv') {
                // Try to find a "Complete Season" or "Season 1" pack first?
                // The search results are already sorted by relevance, which prioritizes Seasons.
                // So result[0] is likely the best bet.

                // Only override if top result looks like a Movie (no season info) and we want TV
                if (bestMatch.season === null && !bestMatch.isCompleteSeason) {
                    const tvMatch = results.find(r => r.season !== null || r.isCompleteSeason);
                    if (tvMatch) bestMatch = tvMatch;
                }
            } else if (media_type === 'movie') {
                 // Ensure we don't pick a Season pack for a movie
                 if (bestMatch.season !== null || bestMatch.isCompleteSeason) {
                     const movieMatch = results.find(r => r.season === null && !r.isCompleteSeason);
                     if (movieMatch) bestMatch = movieMatch;
                 }
            }

            console.log(`Auto-Selected: ${bestMatch.name}`);

            // 3. Queue
            let magnetLink = bestMatch.magnetLink;
            if (!magnetLink) {
                magnetLink = await torrentSearchService.getMagnet(bestMatch);
            }

            if (!magnetLink) {
                return res.status(400).json({ error: 'Found torrent but could not retrieve magnet link.' });
            }

            const fileType = media_type === 'tv' ? 'series' : 'movie';

            const download = await downloadManager.queueDownload(
                req.user.id,
                bestMatch,
                magnetLink,
                fileType
            );

            res.status(201).json({ message: 'Auto-download queued', download, torrent: bestMatch });

        } catch (error) {
            console.error('❌ Auto-Queue error:', error.message);
            res.status(500).json({ error: 'Failed to auto-queue download' });
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
            res.status(500).json({ error: 'Failed to delete download', detail: error.message });
        }
    },

    async cancelDownload(req, res, next) {
        try {
            const { id } = req.params;
            const download = await Download.findOne({ where: { id, user_id: req.user.id } });
            if (!download) return res.status(404).json({ error: 'Download not found' });
            
            const result = await downloadManager.cancelDownload(download.id);
            if (result.success) {
                res.json({ message: result.message });
            } else {
                res.status(400).json({ error: result.message });
            }
        } catch (error) {
            console.error('❌ Cancel download error:', error.message);
            res.status(500).json({ error: 'Failed to cancel download', detail: error.message });
        }
    },

    async retryDownload(req, res, next) {
        try {
            const { id } = req.params;
            const download = await Download.findOne({ where: { id, user_id: req.user.id } });
            if (!download) return res.status(404).json({ error: 'Download not found' });

            await download.update({
                status: 'queued',
                debriding_progress: 0.00,
                transfer_progress: 0.00,
                download_speed: 0,
                alldebrid_id: null
            });
            downloadManager.processDownload(download.id);
            res.json({ message: 'Download retry initiated', download });
        } catch (error) {
            console.error('❌ Retry download error:', error.message);
            res.status(500).json({ error: 'Failed to retry download', detail: error.message });
        }
    },

    async checkAllDebridStatus(req, res, next) {
        try {
            const { id } = req.params;
            const download = await Download.findOne({ where: { id, user_id: req.user.id } });
            if (!download) return res.status(404).json({ error: 'Download not found' });
            if (!download.alldebrid_id) return res.status(400).json({ error: 'No AllDebrid ID found.' });

            const statusResponse = await alldebridService.getMagnetStatus(download.alldebrid_id);

            if (statusResponse.status === 'success') {
                const magnetStatus = statusResponse.data.magnets;
                if (magnetStatus.status === 'Ready') {
                    await download.update({ status: 'transferring', debriding_progress: 100.00 });
                    downloadManager.continueTransfer(download.id, download.alldebrid_id);
                } else if (magnetStatus.status === 'Downloading') {
                    const progress = magnetStatus.size > 0 ? (magnetStatus.downloaded / magnetStatus.size * 100) : 0;
                    await download.update({ status: 'debriding', debriding_progress: parseFloat(progress.toFixed(2)) });
                    downloadManager.monitorDownload(download.id, download.alldebrid_id);
                } else if (magnetStatus.status === 'Error') {
                    await download.update({ status: 'failed' });
                }
                await download.reload();
                res.json({ message: 'Status check completed', download });
            } else {
                res.status(500).json({ error: 'Failed to check AllDebrid status' });
            }
        } catch (error) {
            console.error('❌ Check AllDebrid status error:', error.message);
            res.status(500).json({ error: 'Failed to check AllDebrid status', detail: error.message });
        }
    }
};

module.exports = downloadController;