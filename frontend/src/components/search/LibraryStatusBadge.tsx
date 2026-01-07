import React, { useState } from 'react';
import { TorrentResult } from '../../utils/torrentUtils';

interface Props {
    status: TorrentResult['libraryStatus'];
}

const LibraryStatusBadge: React.FC<Props> = ({ status }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!status || !status.exists) return null;

    const details = status.details;
    if (!details) return <span className="badge badge-success">On Plex</span>;

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}
             onMouseEnter={() => setShowTooltip(true)}
             onMouseLeave={() => setShowTooltip(false)}
        >
            <span className="badge badge-success" style={{ cursor: 'help', backgroundColor: '#2e7d32', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                On Plex
            </span>

            {showTooltip && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '8px',
                    padding: '10px',
                    backgroundColor: '#1f2937',
                    color: '#fff',
                    borderRadius: '8px',
                    width: '250px',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    fontSize: '0.85rem'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>In Library:</div>
                    <div style={{ marginBottom: '6px', fontStyle: 'italic', fontSize: '0.8rem', color: '#9ca3af' }}>{details.full_title}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                        {details.video_resolution && <div>📺 {details.video_resolution}</div>}
                        {details.video_codec && <div>🎞️ {details.video_codec}</div>}
                        {details.audio_codec && <div>🔊 {details.audio_codec}</div>}
                        {details.audio_channels && <div>🎛️ {details.audio_channels}</div>}
                        {details.container && <div>📁 {details.container}</div>}
                        {details.file_size && <div>💾 { (details.file_size / (1024*1024*1024)).toFixed(2) } GB</div>}
                    </div>

                    {/* Arrow */}
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        marginLeft: '-5px',
                        borderWidth: '5px',
                        borderStyle: 'solid',
                        borderColor: '#1f2937 transparent transparent transparent'
                    }}></div>
                </div>
            )}
        </div>
    );
};

export default LibraryStatusBadge;
