const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow GitHub Pages
app.use(cors({
    origin: ['https://sebitrollj.github.io', 'http://localhost:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ProtoMusic Proxy Running',
        timestamp: new Date().toISOString()
    });
});

// Proxy all /api requests to v2.protogen.fr/sys/XHR
app.use('/api', async (req, res) => {
    try {
        const targetUrl = `https://v2.protogen.fr/sys/XHR${req.url}`;
        console.log(`[PROXY] ${req.method} ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ProtoMusic/1.0'
            },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const data = await response.json();

        res.status(response.status).json(data);
    } catch (error) {
        console.error('[PROXY ERROR]', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Assets proxy (thumbnails, images)
app.get('/assets/*', async (req, res) => {
    try {
        const targetUrl = `https://v2.protogen.fr${req.url}`;
        console.log(`[ASSETS PROXY] ${targetUrl}`);

        const response = await fetch(targetUrl);

        if (!response.ok) {
            return res.status(response.status).send('Asset not found');
        }

        // Copy all headers
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', 'https://sebitrollj.github.io');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        // Stream the response
        response.body.pipe(res);
    } catch (error) {
        console.error('[ASSETS ERROR]', error.message);
        res.status(500).send('Assets proxy error');
    }
});

// Media streaming proxy (thumbnails, videos, streams)
app.get('/webapi/*', async (req, res) => {
    try {
        const targetUrl = `https://v2.protogen.fr${req.url}`;
        console.log(`[MEDIA PROXY] ${targetUrl}`);

        const response = await fetch(targetUrl);

        if (!response.ok) {
            return res.status(response.status).send('Media not found');
        }

        // Copy all headers
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        // Add CORS headers for media
        res.setHeader('Access-Control-Allow-Origin', 'https://sebitrollj.github.io');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        // Stream the response
        response.body.pipe(res);
    } catch (error) {
        console.error('[MEDIA ERROR]', error.message);
        res.status(500).send('Media proxy error');
    }
});

// Kikiskothèque API - scrape HTML and return JSON
app.get('/kikiskothek-api/*', async (req, res) => {
    try {
        const urlPath = req.url.replace('/kikiskothek-api', '');
        let targetUrl = `https://v2.protogen.fr/kikiskothek${urlPath}`;

        // Special handling for Kalandar
        if (urlPath.includes('season=kalandar')) {
            targetUrl = 'https://v2.protogen.fr/kikiskothek/kalandar?tab=kalandar&year=2025';
        }

        console.log(`[KIKISKOTHEK] Fetching: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
                'Referer': 'https://v2.protogen.fr/'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Failed to fetch Kikiskothek page'
            });
        }

        const html = await response.text();

        // Parse seasons from HTML
        const seasons = [];
        const seasonBlocks = html.match(/<a[^>]*href="\?season=[^"]*"[^>]*>[\s\S]*?<\/a>/gi) || [];

        seasonBlocks.forEach(block => {
            const idMatch = block.match(/season=([^"]+)/);
            const nameMatch = block.match(/Saison\s+(\d+)|(\bAutre\b)/i);
            const countMatch = block.match(/(\d+)\s*épisodes?/i);

            if (idMatch && (nameMatch || countMatch)) {
                const seasonNum = nameMatch ? (nameMatch[2] ? 'Autre' : `Saison ${nameMatch[1]}`) : 'Autre';
                seasons.push({
                    series_id: idMatch[1],
                    season_name: seasonNum,
                    episode_count: countMatch ? parseInt(countMatch[1]) : 0
                });
            }
        });

        // Parse episodes - match episode cards
        const episodes = [];
        const episodeBlocks = html.match(/<a[^>]*class="[^"]*episode-card[^"]*"[^>]*>[\s\S]*?<\/a>/gi) || [];

        episodeBlocks.forEach(block => {
            const idMatch = block.match(/href="\/watch\/([^"?]+)/);
            const epMatch = block.match(/Ep\.\s*(\d+)/i);
            const titleMatch = block.match(/<h3[^>]*>\s*([^<]+)\s*<\/h3>/i);
            const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
            const durationMatch = block.match(/class="[^"]*absolute bottom-2 right-2[^"]*"[^>]*>\s*([0-9:]+)\s*<\/div>/i);

            if (idMatch) {
                let thumb = imgMatch ? imgMatch[1] : null;
                if (thumb && !thumb.startsWith('http')) {
                    thumb = thumb.startsWith('/') ? `https://v2.protogen.fr${thumb}` : `https://v2.protogen.fr/${thumb}`;
                }

                // Decode HTML entities
                let title = titleMatch ? titleMatch[1].trim() : 'Sans titre';
                title = title.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

                episodes.push({
                    video_id: idMatch[1],
                    episode_number: epMatch ? parseInt(epMatch[1]) : 0,
                    title: title,
                    thumbnail: thumb,
                    duration: durationMatch ? durationMatch[1] : '00:00'
                });
            }
        });

        console.log(`[KIKISKOTHEK] Found ${seasons.length} seasons, ${episodes.length} episodes`);

        res.setHeader('Access-Control-Allow-Origin', 'https://sebitrollj.github.io');
        res.setHeader('Content-Type', 'application/json');
        res.json({
            success: true,
            seasons: seasons,
            episodes: episodes
        });
    } catch (error) {
        console.error('[KIKISKOTHEK ERROR]', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 ProtoMusic Proxy running on port ${PORT}`);
});
