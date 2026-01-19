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

// Media streaming proxy
app.get('/webapi/*', async (req, res) => {
    try {
        const targetUrl = `https://v2.protogen.fr${req.url}`;
        console.log(`[MEDIA PROXY] ${targetUrl}`);

        const response = await fetch(targetUrl);

        // Forward headers
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        response.body.pipe(res);
    } catch (error) {
        console.error('[MEDIA ERROR]', error.message);
        res.status(500).send('Media proxy error');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 ProtoMusic Proxy running on port ${PORT}`);
});
