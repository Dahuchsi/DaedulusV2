import React, { useState } from 'react';
import { SeasonBundle, TorrentResult, EpisodeGroup } from '../../utils/torrentUtils';
import EpisodeRow from './EpisodeRow';
import LibraryStatusBadge from './LibraryStatusBadge';

interface SeasonBundleItemProps {
    bundle: SeasonBundle;
    onDownloadBundle: (torrents: TorrentResult[]) => void;
    onDownloadSingle: (torrent: TorrentResult) => void;
}

const SeasonBundleItem: React.FC<SeasonBundleItemProps> = ({ bundle, onDownloadBundle, onDownloadSingle }) => {
    const [expanded, setExpanded] = useState(false);
    const [episodeSelections, setEpisodeSelections] = useState<{ [epNum: number]: TorrentResult }>({});

    const getSelectedTorrent = (epGroup: EpisodeGroup) => {
        return episodeSelections[epGroup.episode] || epGroup.selectedTorrent;
    };

    const handleSelectionChange = (epNum: number, torrent: TorrentResult) => {
        setEpisodeSelections(prev => ({
            ...prev,
            [epNum]: torrent
        }));
    };

    const handleDownloadAllEpisodes = () => {
        const torrentsToDownload = bundle.episodes
            .map(ep => getSelectedTorrent(ep))
            .filter((t): t is TorrentResult => t !== null);

        if (torrentsToDownload.length === 0) return;
        onDownloadBundle(torrentsToDownload);
    };

    return (
        <div className="season-bundle" style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            marginBottom: '1rem',
            overflow: 'hidden',
            backgroundColor: '#fff'
        }}>
            {/* Header */}
            <div className="bundle-header" style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
            }} onClick={() => setExpanded(!expanded)}>
                <div>
                    <h3 style={{ margin: 0 }}>Season {bundle.season}</h3>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        {bundle.completePacks.length > 0
                            ? `Found ${bundle.completePacks.length} Complete Packs`
                            : 'No Complete Packs (Building from Episodes)'}
                        {' • '}
                        {bundle.episodes.length} Individual Episodes Found
                    </div>
                </div>
                <div>
                    <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                        {expanded ? '▲' : '▼'}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="bundle-content" style={{ padding: '1rem' }}>

                    {/* Section 1: Complete Packs (Priority) */}
                    {bundle.completePacks.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: '#888' }}>
                                Full Season Packs (Recommended)
                            </h4>
                            {bundle.completePacks.slice(0, 3).map((pack, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    borderBottom: '1px solid #eee'
                                }}>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <strong>{pack.name}</strong>
                                        <LibraryStatusBadge status={pack.libraryStatus} />
                                        <div style={{ fontSize: '0.8rem' }}>
                                            Size: {pack.size} • S: {pack.seeders} • L: {pack.leechers} • {pack.quality}
                                        </div>
                                    </div>
                                    <button
                                        className="download-btn"
                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                        onClick={() => onDownloadSingle(pack)}
                                    >
                                        Download Pack
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Section 2: Episode Builder */}
                    {bundle.episodes.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: '#888', margin: 0 }}>
                                    Episode Builder
                                </h4>
                                <button
                                    className="btn-primary"
                                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                    onClick={handleDownloadAllEpisodes}
                                >
                                    Download All Selected Episodes
                                </button>
                            </div>

                            <div style={{ border: '1px solid #eee', borderRadius: '4px' }}>
                                {bundle.episodes.map(epGroup => {
                                    const selected = getSelectedTorrent(epGroup);

                                    // Determine Row Color
                                    // Green: On Plex
                                    // Orange: Upgrade (if we had comparison logic, assuming naive for now)
                                    // Red: Missing (Not on Plex)

                                    let borderColor = 'transparent'; // Default
                                    let bgColor = 'transparent';

                                    // Check if ANY torrent for this episode is on plex? Or just the selected one?
                                    // The user said: "Green if in the season pack that already exists"
                                    // If we have "Power S02E01" in library, then this row is Green.
                                    // Our `libraryStatus` is attached to the TorrentResult.
                                    // So we check the selected torrent's status.

                                    if (selected?.libraryStatus?.exists) {
                                        // It exists.
                                        borderColor = '#4caf50'; // Green
                                        bgColor = '#e8f5e9';
                                    } else {
                                        // Missing
                                        borderColor = '#ef5350'; // Red
                                        bgColor = '#ffebee';
                                    }

                                    return (
                                        <div key={epGroup.episode} style={{ borderLeft: `4px solid ${borderColor}`, backgroundColor: bgColor }}>
                                            <EpisodeRow
                                                group={{...epGroup, selectedTorrent: selected}}
                                                onSelectionChange={handleSelectionChange}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SeasonBundleItem;
