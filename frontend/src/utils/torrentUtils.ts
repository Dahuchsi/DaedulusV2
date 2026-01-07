// frontend/src/utils/torrentUtils.ts

export interface TorrentResult {
    name: string;
    size: string;
    seeders: number;
    leechers: number;
    link: string;
    provider: string;
    magnetLink?: string;
    // New metadata fields from backend
    season?: number | null;
    episode?: number | null;
    quality?: string;
    isCompleteSeason?: boolean;
    relevance?: number;

    // TMDB Metadata
    tmdb?: {
        name?: string;
        title?: string;
        poster_url?: string | null;
        backdrop_url?: string | null;
        media_type?: string;
        year?: string;
        overview?: string;
    };

    // Library Status
    libraryStatus?: {
        exists: boolean;
        isSeriesMatch?: boolean;
        details?: {
            video_resolution?: string;
            video_codec?: string;
            audio_codec?: string;
            audio_channels?: string;
            container?: string;
            file_size?: number;
            full_title?: string;
        };
    };
}

export interface EpisodeGroup {
    episode: number;
    torrents: TorrentResult[];
    selectedTorrent: TorrentResult | null;
}

export interface SeasonBundle {
    season: number;
    episodes: EpisodeGroup[]; // Sparse array or map, index = episode number
    completePacks: TorrentResult[]; // "Full Season" single torrents
}

export interface SearchResultGroup {
    movies: TorrentResult[];
    seasons: { [key: number]: SeasonBundle }; // Keyed by Season Number
    misc: TorrentResult[]; // Uncategorized
    tmdbMetadata?: TorrentResult['tmdb']; // Top level metadata
}

const QUALITY_RANKING = ['2160p', '1080p', '720p', '480p', 'Unknown'];

const normalizeQuality = (q: string | undefined): string => {
    if (!q) return 'Unknown';
    const lower = q.toLowerCase();
    if (lower.includes('2160') || lower.includes('4k')) return '2160p';
    if (lower.includes('1080')) return '1080p';
    if (lower.includes('720')) return '720p';
    if (lower.includes('480')) return '480p';
    return 'Unknown';
};

// Helper to compare qualities
export const compareQuality = (q1: string | undefined, q2: string | undefined) => {
    const norm1 = normalizeQuality(q1);
    const norm2 = normalizeQuality(q2);

    const idx1 = QUALITY_RANKING.indexOf(norm1);
    const idx2 = QUALITY_RANKING.indexOf(norm2);
    return idx1 - idx2; // Lower index = Better quality (0 is best)
};

export const isBetterQuality = (newQuality: string | undefined, currentQuality: string | undefined): boolean => {
    if (!currentQuality) return false; // Can't upgrade from nothing (or unknown)
    const comparison = compareQuality(newQuality, currentQuality);
    return comparison < 0; // Negative means newQuality index is lower (better) than current
};

// Main grouping function
export const organizeResults = (results: TorrentResult[]): SearchResultGroup => {
    const groups: SearchResultGroup = {
        movies: [],
        seasons: {},
        misc: [],
        tmdbMetadata: results.length > 0 ? results[0].tmdb : undefined
    };

    results.forEach(result => {
        // 1. Check if it looks like a Movie (no season/episode info)
        if (result.season === null || result.season === undefined) {
             groups.movies.push(result);
             return;
        }

        const seasonNum = result.season;

        // Initialize Season Bundle if not exists
        if (!groups.seasons[seasonNum]) {
            groups.seasons[seasonNum] = {
                season: seasonNum,
                episodes: [],
                completePacks: []
            };
        }

        const bundle = groups.seasons[seasonNum];

        // 2. Is it a Complete Season Pack?
        if (result.isCompleteSeason) {
            bundle.completePacks.push(result);
        } else if (result.episode !== null && result.episode !== undefined) {
            // 3. It's an Episode
            const epNum = result.episode;

            let epGroup = bundle.episodes.find(g => g.episode === epNum);
            if (!epGroup) {
                epGroup = {
                    episode: epNum,
                    torrents: [],
                    selectedTorrent: null
                };
                bundle.episodes.push(epGroup);
            }

            epGroup.torrents.push(result);
        } else {
             bundle.completePacks.push(result);
        }
    });

    // Post-processing: Sort and Select Defaults

    // Sort Movies/Misc by Seeders/Relevance
    groups.movies.sort((a, b) => (b.relevance || 0) - (a.relevance || 0) || b.seeders - a.seeders);

    // Process each Season
    Object.values(groups.seasons).forEach(season => {
        // Sort Complete Packs
        season.completePacks.sort((a, b) => b.seeders - a.seeders);

        // Sort Episodes by number
        season.episodes.sort((a, b) => a.episode - b.episode);

        // For each episode, sort torrents by Quality then Seeders, and pick default
        season.episodes.forEach(ep => {
            ep.torrents.sort((a, b) => {
                const qDiff = compareQuality(a.quality, b.quality);
                if (qDiff !== 0) return qDiff; // Better quality first
                return b.seeders - a.seeders; // Then seeders
            });

            if (ep.torrents.length > 0) {
                ep.selectedTorrent = ep.torrents[0];
            }
        });
    });

    return groups;
};
