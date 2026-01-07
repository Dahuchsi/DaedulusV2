const axios = require('axios');
const { TAUTULLI_URL, TAUTULLI_API_KEY } = require('../config/constants');

class TautulliService {
    constructor() {
        this.baseUrl = TAUTULLI_URL;
        this.apiKey = TAUTULLI_API_KEY;
    }

    /**
     * Search Tautulli/Plex library for a term.
     * Returns detailed info about matches.
     */
    async searchLibrary(query) {
        if (!this.baseUrl || !this.apiKey) return [];

        try {
            // Tautulli's get_library_media_info or get_library_items might be useful,
            // but 'search' command is usually best for finding things.
            // Command: get_library_search
            const response = await axios.get(`${this.baseUrl}/api/v2`, {
                params: {
                    apikey: this.apiKey,
                    cmd: 'get_library_search',
                    query: query
                }
            });

            // Tautulli search returns simple info. We might need to fetch details for matches.
            // Response structure: { response: { data: { search: [ ... ] } } }
            const searchResults = response.data?.response?.data?.search || [];

            // Filter only valid media types (movie, show, episode, artist, album)
            // We are mostly interested in Shows and Movies.
            const matches = searchResults.filter(item =>
                ['movie', 'show', 'episode'].includes(item.media_type)
            );

            if (matches.length === 0) return [];

            // Fetch detailed metadata for the top matches to get file info (resolution, etc.)
            // We use 'get_library_media_info' using rating_key
            const detailedMatches = await Promise.all(matches.map(async (match) => {
                try {
                    const details = await this.getMediaDetails(match.rating_key);
                    return { ...match, ...details };
                } catch (e) {
                    return match;
                }
            }));

            return detailedMatches;

        } catch (error) {
            console.error('Tautulli search failed:', error.message);
            return [];
        }
    }

    async getMediaDetails(ratingKey) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v2`, {
                params: {
                    apikey: this.apiKey,
                    cmd: 'get_library_media_info',
                    rating_key: ratingKey
                }
            });

            const data = response.data?.response?.data;
            if (!data) return {};

            // Extract useful file info
            // Tautulli often returns file_size, width, audio_channels, video_codec, etc.
            return {
                file_size: data.file_size,
                width: data.width,
                height: data.height,
                video_resolution: data.video_resolution, // e.g. '4k', '1080p'
                video_codec: data.video_codec, // e.g. 'hevc', 'h264'
                audio_codec: data.audio_codec, // e.g. 'ac3', 'aac'
                audio_channels: data.audio_channels, // e.g. '5.1'
                container: data.container, // e.g. 'mkv'
                bitrate: data.bitrate,
                full_title: data.full_title || data.title
            };
        } catch (error) {
            return {};
        }
    }
}

module.exports = new TautulliService();
