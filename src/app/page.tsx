// frontend/src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';

type VideoFormat = {
  format_id: string;
  resolution: string;
  filesize: number | null;
  hasAudio?: boolean;
};

type VideoInfo = {
  title: string;
  thumbnail: string;
  duration: number;
  formats: VideoFormat[];
};

type ProgressData = {
  percent: number;
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [downloadStatus, setDownloadStatus] = useState<
    'idle' | 'downloading' | 'merging' | 'done' | 'error'
  >('idle');
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [esRef, setEsRef] = useState<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (esRef) esRef.close();
    };
  }, [esRef]);

  const fetchInfo = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setError('');
    setVideoInfo(null);
    try {
      const res = await fetch('http://localhost:3001/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch info');
      setVideoInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const closeProgress = () => {
    if (esRef) {
      esRef.close();
      setEsRef(null);
    }
    setDownloadStatus('idle');
    setProgress(null);
  };

  const startDownload = async (formatId: string) => {
    setError('');
    setDownloadStatus('downloading');
    setProgress({ percent: 0, downloaded: 0, total: 0, speed: 0, eta: 0 });

    try {
      const res = await fetch('http://localhost:3001/api/download/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format_id: formatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start download');

      const { jobId } = data;
      const es = new EventSource(
        `http://localhost:3001/api/download/progress/${jobId}`
      );
      setEsRef(es);

      es.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'progress' || msg.type === 'init') {
          setProgress({
            percent: msg.percent || 0,
            downloaded: msg.downloaded || 0,
            total: msg.total || 0,
            speed: msg.speed || 0,
            eta: msg.eta || 0,
          });
          setDownloadStatus(msg.status === 'merging' ? 'merging' : 'downloading');
        } else if (msg.type === 'status' && msg.status === 'merging') {
          setDownloadStatus('merging');
        } else if (msg.type === 'done') {
          setDownloadStatus('done');
          setProgress((p) => (p ? { ...p, percent: 100 } : p));
          es.close();
          setEsRef(null);
          const a = document.createElement('a');
          a.href = `http://localhost:3001${msg.downloadUrl}`;
          a.click();
          setTimeout(() => {
            setDownloadStatus('idle');
            setProgress(null);
          }, 4000);
        } else if (msg.type === 'error') {
          setError(msg.error || 'Download failed');
          setDownloadStatus('error');
          es.close();
          setEsRef(null);
          // Auto-close the progress box after 3s (error stays in banner)
          setTimeout(() => {
            setDownloadStatus('idle');
            setProgress(null);
          }, 3000);
        }
      };

      es.onerror = () => {
        setError('Lost connection to server');
        setDownloadStatus('idle');
        setProgress(null);
        es.close();
        setEsRef(null);
      };
    } catch (err: any) {
      setError(err.message);
      setDownloadStatus('idle');
      setProgress(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes || bytes === 0) return '—';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatSpeed = (bps: number) => {
    if (!bps) return '—';
    if (bps >= 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
    return `${(bps / 1024).toFixed(0)} KB/s`;
  };

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased">
      {/* ============ NAVBAR ============ */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-zinc-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-sm font-bold text-white">
              V
            </div>
            <span className="text-lg font-semibold tracking-tight">VidGrab</span>
          </div>
          <div className="hidden sm:flex items-center gap-8 text-sm text-zinc-600">
            <a href="#features" className="hover:text-zinc-900 transition">Features</a>
            <a href="#how" className="hover:text-zinc-900 transition">How it works</a>
            <a href="#faq" className="hover:text-zinc-900 transition">FAQ</a>
          </div>
          <button className="text-sm px-4 py-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition font-medium">
            Sign in
          </button>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs text-zinc-700 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Blazing fast · No watermarks · 4K ready
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-zinc-900">
          Download any video.
          <br />
          <span className="bg-gradient-to-r from-zinc-900 to-zinc-500 bg-clip-text text-transparent">
            Instantly.
          </span>
        </h1>

        <p className="text-lg text-zinc-600 max-w-2xl mx-auto mb-10">
          Paste a link. Pick a quality. Get your file. Powered by yt-dlp with
          live speed, ETA, and multi-threaded downloads.
        </p>

        {/* Input card */}
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-zinc-200 shadow-sm p-1.5 flex flex-col sm:flex-row gap-1.5">
          <input
            type="text"
            placeholder="Paste video URL (YouTube, TikTok, Instagram…)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
            className="flex-1 px-4 py-3 rounded-xl bg-transparent text-zinc-900 placeholder-zinc-400 focus:outline-none text-sm"
          />
          <button
            onClick={fetchInfo}
            disabled={fetching || !url.trim()}
            className="px-6 py-3 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {fetching ? 'Analyzing…' : 'Fetch Info'}
          </button>
        </div>

        {error && (
          <div className="mt-4 max-w-2xl mx-auto p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-left">
            {error}
          </div>
        )}

        {/* Video info + formats */}
        {videoInfo && (
          <div className="mt-10 max-w-2xl mx-auto bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 text-left animate-fade-in">
            <div className="flex gap-4 items-start mb-6">
              <img
                src={videoInfo.thumbnail}
                alt="thumbnail"
                className="w-28 h-20 object-cover rounded-lg border border-zinc-200"
              />
              <div className="min-w-0">
                <h2 className="font-semibold text-lg leading-snug line-clamp-2 text-zinc-900">
                  {videoInfo.title}
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {videoInfo.duration
                    ? `${Math.floor(videoInfo.duration / 60)}:${(videoInfo.duration % 60)
                        .toString()
                        .padStart(2, '0')}`
                    : ''}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {videoInfo.formats.map((f) => (
                <div
                  key={f.format_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-zinc-900">{f.resolution}</span>
                    <span className="text-xs text-zinc-500">
                      {formatFileSize(f.filesize)}
                    </span>
                    {f.hasAudio === false && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                        + Audio
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => startDownload(f.format_id)}
                    disabled={downloadStatus === 'downloading' || downloadStatus === 'merging'}
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="border-y border-zinc-200 bg-zinc-50/50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Built for speed and privacy</h2>
            <p className="text-zinc-600">Everything you need. Nothing you don't.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: 'Multi-threaded speed',
                desc: '8 parallel fragment downloads saturate your connection for maximum throughput.',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                ),
              },
              {
                title: 'Private by design',
                desc: 'Files stream through your own backend and are deleted immediately after download.',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ),
              },
              {
                title: 'Real-time stats',
                desc: 'Live speed, downloaded size, ETA, and merge status via Server-Sent Events.',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                ),
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-xl border border-zinc-200 p-6 hover:shadow-sm transition"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-1 text-zinc-900">{f.title}</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { n: '01', t: 'Paste link', d: 'Copy any video URL and drop it in the box.' },
            { n: '02', t: 'Pick quality', d: 'See resolutions and estimated file sizes.' },
            { n: '03', t: 'Download', d: 'Watch live progress and get your file.' },
          ].map((s) => (
            <div key={s.n}>
              <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-semibold mx-auto mb-4">
                {s.n}
              </div>
              <h3 className="font-semibold mb-1 text-zinc-900">{s.t}</h3>
              <p className="text-sm text-zinc-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="border-y border-zinc-200 bg-zinc-50/50">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-2">
            {[
              {
                q: 'Is this legal?',
                a: 'Only download content you own or have permission to download. Respect copyright and platform Terms of Service.',
              },
              {
                q: 'Why does it show "+ Audio"?',
                a: 'Some HD formats ship video and audio separately. yt-dlp downloads both and merges them automatically with FFmpeg.',
              },
              {
                q: 'How fast is it?',
                a: 'Downloads use 8 concurrent fragments. Real speed depends on the source CDN and your connection.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group bg-white rounded-xl border border-zinc-200 p-4 cursor-pointer"
              >
                <summary className="font-medium text-sm list-none flex justify-between items-center text-zinc-900">
                  {item.q}
                  <svg className="w-4 h-4 text-zinc-500 group-open:rotate-180 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-500">
        VidGrab MVP · Built with Next.js, Express & yt-dlp
      </footer>

      {/* ============ PROGRESS TOAST ============ */}
      {downloadStatus !== 'idle' && (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-2rem)] max-w-[360px] bg-white border border-zinc-200 rounded-2xl shadow-xl p-5 animate-slide-up">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {downloadStatus === 'merging'
                  ? 'Merging with FFmpeg…'
                  : downloadStatus === 'done'
                  ? 'Download complete'
                  : downloadStatus === 'error'
                  ? 'Download failed'
                  : 'Downloading…'}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {Math.round(progress?.percent || 0)}% complete
              </p>
            </div>
            <button
              onClick={closeProgress}
              className="text-zinc-400 hover:text-zinc-700 transition -mt-1 -mr-1 p-1"
              aria-label="Close"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden mb-4">
            <div
              className={`h-full transition-all duration-300 ${
                downloadStatus === 'error' ? 'bg-red-500' : 'bg-zinc-900'
              }`}
              style={{ width: `${progress?.percent || 0}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                Speed
              </span>
              <span className="text-zinc-900 font-medium">{formatSpeed(progress?.speed || 0)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                ETA
              </span>
              <span className="text-zinc-900 font-medium">{formatEta(progress?.eta || 0)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                Downloaded
              </span>
              <span className="text-zinc-900 font-medium">{formatFileSize(progress?.downloaded || 0)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                Total
              </span>
              <span className="text-zinc-900 font-medium">{formatFileSize(progress?.total || 0)}</span>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </main>
  );
}