const axios = require('axios');
const { TMDB_API_KEY, TMDB_READ_TOKEN } = require('../config/constants');

const BASE_URL = 'https://api.themoviedb.org/3';

class TmdbService {
    constructor() {
        this.client = axios.create({
            baseURL: BASE_URL,
            headers: {
                'Authorization': `Bearer ${TMDB_READ_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Determine the likely media types of a query.
     * Returns an object with boolean flags and top result metadata.
     */
    async classifyQuery(query) {
        if (!query) return { isMovie: false, isSeries: false, topResult: null };

        try {
            const response = await this.client.get('/search/multi', {
                params: {
                    query: query,
                    include_adult: false,
                    language: 'en-US',
                    page: 1
                }
            });

            const results = response.data.results || [];

            if (results.length === 0) {
                return { isMovie: false, isSeries: false, topResult: null };
            }

            // Analyze top 5 results to see what we have
            const topResults = results.slice(0, 5);
            const hasMovie = topResults.some(r => r.media_type === 'movie');
            const hasSeries = topResults.some(r => r.media_type === 'tv');

            // Enhance results
            const enhancedResults = results.map(r => ({
                ...r,
                poster_url: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
                backdrop_url: r.backdrop_path ? `https://image.tmdb.org/t/p/w780${r.backdrop_path}` : null,
                year: r.release_date ? r.release_date.substring(0, 4) : (r.first_air_date ? r.first_air_date.substring(0, 4) : 'Unknown')
            }));

            return {
                isMovie: hasMovie,
                isSeries: hasSeries,
                topResult: enhancedResults[0], // Still return the very top one for the header
                results: enhancedResults
            };

        } catch (error) {
            console.error('TMDB Search failed:', error.message);
            return { isMovie: false, isSeries: false, topResult: null };
        }
    }
}

module.exports = new TmdbService();
