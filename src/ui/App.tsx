import React, { useEffect, useState } from 'react';
import { zip, Zippable } from 'fflate';
import { toToon } from '../toon';

interface ExportPayload {
    design: Record<string, unknown>;
    assets: { path: string; bytes: Uint8Array }[];
}

export const App: React.FC = () => {
    const [status, setStatus] = useState<string>('Preparing export...');
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            const message = event.data.pluginMessage;
            if (!message) return;

            if (message.type === 'export-progress') {
                setStatus(message.label);
                if (typeof message.current === 'number' && typeof message.total === 'number') {
                    setProgress(Math.round((message.current / message.total) * 100));
                } else if (typeof message.progress === 'number') {
                    setProgress(message.progress);
                }
            }

            if (message.type === 'export-payload') {
                setStatus('Generating TOON...');
                setProgress(90);

                try {
                    const payload = message.payload;
                    const toonString = toToon(payload.design || payload); // Fallback if structure varies

                    setStatus('Compressing...');

                    const assets: Zippable = {};
                    // Add design.toon
                    assets['design.toon'] = [new TextEncoder().encode(toonString), { level: 0 }];

                    // Add assets
                    if (Array.isArray(payload.assets)) {
                        payload.assets.forEach((asset: any) => {
                            // asset.bytes is usually an array from plugin, need Uint8Array
                            const data = (asset.bytes instanceof Uint8Array ? asset.bytes : new Uint8Array(asset.bytes)) as unknown as BlobPart;
                            const path = asset.path.startsWith('assets/') ? asset.path : `assets/${asset.path}`;
                            assets[path] = [data as unknown as Uint8Array, { level: 0 }];
                        });
                    }

                    zip(assets, (err, data) => {
                        if (err) {
                            throw err;
                        }
                        setStatus('Downloading...');
                        setProgress(100);

                        const blob = new Blob([data as unknown as BlobPart], { type: 'application/zip' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'figma-design-export.zip';
                        a.click();
                        URL.revokeObjectURL(url);

                        parent.postMessage({ pluginMessage: { type: 'export-done' } }, '*');
                    });

                } catch (e) {
                    console.error(e);
                    setError(String(e));
                    parent.postMessage({ pluginMessage: { type: 'export-failed', error: String(e) } }, '*');
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <>
            <style>
                {`
                    body { margin: 0; padding: 0; box-sizing: border-box; }
                    * { box-sizing: border-box; }
                `}
            </style>
            <div style={{
                fontFamily: 'Inter, sans-serif',
                padding: '16px',
                color: 'var(--figma-color-text, #333)',
                backgroundColor: 'var(--figma-color-bg, #fff)',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                overflow: 'hidden'
            }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>Exporting Selection</h3>
                <p style={{ margin: '0 0 12px', fontSize: '12px', opacity: 0.8 }}>{error ? `Error: ${error}` : status}</p>

                <div style={{
                    height: '6px',
                    width: '100%',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${progress}%`,
                        backgroundColor: '#18a0fb',
                        transition: 'width 0.3s ease-out'
                    }} />
                </div>
            </div>
        </>
    );
};
