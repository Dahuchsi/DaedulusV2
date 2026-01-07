const axios = require('axios');
const { TMDB_READ_TOKEN, WATCHMODE_API_KEY } = require('../config/constants');
const { TrendingCache } = require('../models');
const tautulliService = require('./tautulliService');

const BASE_URL = 'https://api.themoviedb.org/3';
const CACHE_TTL_HOURS = 24;

// Service Configuration with IDs and Colors
const SERVICES = [
    { id: 'netflix', name: 'Netflix', tmdbId: 8, color: '#E50914', textColor: '#ffffff' },
    { id: 'prime', name: 'Amazon Prime Video', tmdbId: 9, color: '#00A8E1', textColor: '#ffffff' },
    { id: 'max', name: 'Max (HBO)', tmdbId: 1899, color: '#002BE7', textColor: '#ffffff' },
    { id: 'disney', name: 'Disney+', tmdbId: 337, color: '#113CCF', textColor: '#ffffff' },
    { id: 'apple', name: 'Apple TV+', tmdbId: 350, color: '#000000', textColor: '#ffffff' },
    { id: 'hulu', name: 'Hulu', tmdbId: 15, color: '#1CE783', textColor: '#000000' },
    { id: 'peacock', name: 'Peacock', tmdbId: 386, color: '#000000', textColor: '#ffffff' },
    { id: 'paramount', name: 'Paramount+', tmdbId: 531, color: '#0064FF', textColor: '#ffffff' },
    { id: 'amc', name: 'AMC+', tmdbId: 528, color: '#000000', textColor: '#ffffff' }, // Often bundled
    { id: 'shudder', name: 'Shudder', tmdbId: 99, color: '#BA0000', textColor: '#ffffff' },
    { id: 'tubi', name: 'Tubi', tmdbId: 73, color: '#272727', textColor: '#ffffff' },
    { id: 'crunchyroll', name: 'Crunchyroll', tmdbId: 283, color: '#F47521', textColor: '#000000' },
    { id: 'starz', name: 'Starz', tmdbId: 43, color: '#000000', textColor: '#ffffff' },
    { id: 'mgm', name: 'MGM+', tmdbId: 34, color: '#D4AF37', textColor: '#000000' }
];

class TrendingService {
    constructor() {
        this.client = axios.create({
            baseURL: BASE_URL,
            headers: {
                'Authorization': `Bearer ${TMDB_READ_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
    }

    getServices() {
        return SERVICES;
    }

    /**
     * Get trending content for a specific service.
     * Uses cache to minimize API calls.
     */
    async getServiceContent(serviceId, page = 1) {
        const service = SERVICES.find(s => s.id === serviceId);
        if (!service) throw new Error('Service not found');

        const cacheKey = `trending:${serviceId}:${page}`;

        // 1. Check Cache
        try {
            const cached = await TrendingCache.findOne({ where: { key: cacheKey } });
            if (cached) {
                const now = new Date();
                if (cached.expires_at > now) {
                    console.log(`Serving ${serviceId} from cache`);
                    return cached.data;
                }
            }
        } catch (err) {
            console.warn('Cache check failed:', err.message);
        }

        // 2. Fetch from TMDB (Discover)
        // We fetch Movies and TV shows separately and merge/interleave?
        // Or just fetch "Popular" regardless of type?
        // TMDB Discover is separated by /movie or /tv.
        // Let's fetch Top 10 Movies and Top 10 TV and merge.

        try {
            console.log(`Fetching ${serviceId} from TMDB`);
            const [movies, shows] = await Promise.all([
                this.client.get('/discover/movie', {
                    params: {
                        with_watch_providers: service.tmdbId,
                        watch_region: 'US',
                        sort_by: 'popularity.desc',
                        page: page
                    }
                }),
                this.client.get('/discover/tv', {
                    params: {
                        with_watch_providers: service.tmdbId,
                        watch_region: 'US',
                        sort_by: 'popularity.desc',
                        page: page
                    }
                })
            ]);

            // Process and Normalize
            const movieResults = (movies.data.results || []).map(r => ({
                id: r.id,
                title: r.title,
                media_type: 'movie',
                poster_path: r.poster_path,
                backdrop_path: r.backdrop_path,
                release_date: r.release_date,
                overview: r.overview,
                popularity: r.popularity,
                vote_average: r.vote_average
            }));

            const showResults = (shows.data.results || []).map(r => ({
                id: r.id,
                title: r.name,
                media_type: 'tv',
                poster_path: r.poster_path,
                backdrop_path: r.backdrop_path,
                release_date: r.first_air_date,
                overview: r.overview,
                popularity: r.popularity,
                vote_average: r.vote_average
            }));

            // Merge and Sort by Popularity
            const merged = [...movieResults, ...showResults].sort((a, b) => b.popularity - a.popularity);

            // Enrich with Plex Status (Batch check is hard without titles list)
            // We will check Plex status for the top 20 items to keep it fast
            const topItems = merged.slice(0, 40);

            const enriched = await Promise.all(topItems.map(async (item) => {
                try {
                    // Check Tautulli
                    const plexResults = await tautulliService.searchLibrary(item.title);

                    // Simple Match Logic
                    const match = plexResults.find(p => {
                        // Strict check on media type?
                        const plexType = p.media_type === 'show' ? 'tv' : 'movie';
                        return p.title.toLowerCase() === item.title.toLowerCase();
                    });

                    return {
                        ...item,
                        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
                        libraryStatus: match ? { exists: true, details: match } : { exists: false }
                    };
                } catch (e) {
                    return {
                        ...item,
                        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                        libraryStatus: { exists: false }
                    };
                }
            }));

            // 3. Save to Cache
            try {
                const expires = new Date();
                expires.setHours(expires.getHours() + CACHE_TTL_HOURS);

                // Upsert
                await TrendingCache.upsert({
                    key: cacheKey,
                    data: enriched,
                    expires_at: expires
                });
            } catch (err) {
                console.warn('Cache save failed:', err.message);
            }

            return enriched;

        } catch (error) {
            console.error('TMDB Trending Fetch failed:', error.message);
            throw new Error('Failed to fetch trending content');
        }
    }
}

module.exports = new TrendingService();
