const TorrentSearchApi = require('torrent-search-api');

// Enable providers - Ensure these are consistently enabled.
// It's generally good practice to put this logic where the service is initialized or in a config.
TorrentSearchApi.enableProvider('1337x');
TorrentSearchApi.enableProvider('ThePirateBay');
TorrentSearchApi.enableProvider('Torrentz2');
TorrentSearchApi.enableProvider('Yts');
TorrentSearchApi.enableProvider('Eztv');

class TorrentSearchService {
    async search(query, sortBy = 'seeders') {
        try {
            // Using 'All' categories and limiting to 50 results.
            const torrents = await TorrentSearchApi.search(query, 'All', 50);
            if (!torrents || torrents.length === 0) return [];

            const formattedTorrents = torrents.map(torrent => ({
                name: torrent.title,
                size: torrent.size,
                seeders: torrent.seeds || 0,
                leechers: torrent.peers || 0,
                link: torrent.desc, // This is often the torrent detail page URL
                provider: torrent.provider,
                magnetLink: torrent.magnet || '' // Some providers might directly return magnet here
            }));

            // Sort by seeders in descending order
            return formattedTorrents.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
        } catch (error) {
            console.error('Torrent search API error:', error);
            return [];
        }
    }

    // FIX & IMPROVEMENT: Properly implement the getMagnet function and handle cases
    async getMagnet(torrent) {
        // First, check if the magnet link is already available in the passed torrent object.
        // This avoids unnecessary API calls.
        if (torrent.magnetLink && torrent.magnetLink.length > 0) { // Check for non-empty string
            return torrent.magnetLink;
        }
        if (torrent.magnet && torrent.magnet.length > 0) { // Check for non-empty string
            return torrent.magnet;
        }

        try {
            console.log(`Attempting to fetch magnet for: "${torrent.name}" from provider: "${torrent.provider}"`);
            // The `torrent` object passed to `TorrentSearchApi.getMagnet` should be the raw
            // torrent object returned by `TorrentSearchApi.search` (or at least have the necessary fields
            // like `link` and `provider`).
            // Your `formattedTorrents` map renames `torrent.title` to `name` and `torrent.desc` to `link`.
            // The `getMagnet` method of the library expects the original structure, or at least `link` and `provider`.
            // Ensure `torrent` here has `link` and `provider` properties.
            const magnet = await TorrentSearchApi.getMagnet(torrent);
            return magnet;
        } catch (error) {
            console.error(`Failed to get magnet link for "${torrent.name}" from "${torrent.provider}":`, error.message);
            // It's good to return an empty string or null consistently on failure
            return '';
        }
    }
}

module.exports = new TorrentSearchService();