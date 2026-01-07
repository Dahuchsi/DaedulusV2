import React from 'react';
import { TorrentResult, EpisodeGroup } from '../../utils/torrentUtils';

interface EpisodeRowProps {
    group: EpisodeGroup;
    onSelectionChange: (episodeNum: number, torrent: TorrentResult) => void;
}

const EpisodeRow: React.FC<EpisodeRowProps> = ({ group, onSelectionChange }) => {
    const { episode, torrents, selectedTorrent } = group;

    return (
        <div className="episode-row" style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem',
            borderBottom: '1px solid #eee',
            gap: '1rem'
        }}>
            <div style={{ minWidth: '80px', fontWeight: 'bold' }}>
                Ep {episode}
            </div>

            <div style={{ flex: 1 }}>
                <select
                    value={selectedTorrent?.link || ''} // Use link as unique ID
                    onChange={(e) => {
                        const selected = torrents.find(t => t.link === e.target.value);
                        if (selected) onSelectionChange(episode, selected);
                    }}
                    style={{ width: '100%', padding: '0.25rem' }}
                >
                    {torrents.map((t, idx) => (
                        <option key={idx} value={t.link}>
                            [{t.quality || 'UNK'}] {t.seeders} S / {t.leechers} L - {t.name.substring(0, 60)}... ({t.size})
                        </option>
                    ))}
                </select>
            </div>

            <div style={{ width: '100px', fontSize: '0.8rem', textAlign: 'right' }}>
                {selectedTorrent ? `${selectedTorrent.size}` : '-'}
            </div>
        </div>
    );
};

export default EpisodeRow;
