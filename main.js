const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 6969;

app.use(express.json());
app.use(express.static('.'));

let requestCount = 0;
let lastSecond = Math.floor(Date.now() / 1000);
let currentRPS = 0;
let rpsHistory = [];
let totalRequests = 0;
let requestsBlocked = 0;
let requestsBypassed = 0;

const requestMethods = {};
const ipAddresses = {};
const userAgents = {};
const statusCodes = {};
const trafficSources = {};

setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    if (now !== lastSecond) {
        currentRPS = requestCount;
        requestCount = 0;
        lastSecond = now;
        
        rpsHistory.push(currentRPS);
        if (rpsHistory.length > 20) {
            rpsHistory.shift();
        }
        
        if (currentRPS > 50) {
            const blocked = Math.floor(currentRPS * 0.3);
            const bypassed = Math.floor(currentRPS * 0.1);
            requestsBlocked += blocked;
            requestsBypassed += bypassed;
        }
        
        const statsData = {
            type: 'stats',
            rps: currentRPS,
            totalRequests: totalRequests,
            requestsBlocked: requestsBlocked,
            requestsBypassed: requestsBypassed,
            methods: requestMethods,
            statusCodes: statusCodes,
            trafficSources: trafficSources,
            ips: Object.keys(ipAddresses).length,
            timestamp: new Date().toISOString()
        };
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(statsData));
            }
        });
    }
}, 100);

app.use((req, res, next) => {
    const startTime = Date.now();
    
    requestMethods[req.method] = (requestMethods[req.method] || 0) + 1;
    
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    ipAddresses[ip] = (ipAddresses[ip] || 0) + 1;
    
    const ua = req.get('User-Agent') || 'Unknown';
    userAgents[ua] = (userAgents[ua] || 0) + 1;
    
    const referer = req.get('Referer') || 'Direct';
    trafficSources[referer] = (trafficSources[referer] || 0) + 1;
    
    requestCount++;
    totalRequests++;
    
    const requestData = {
        type: 'request',
        method: req.method,
        url: req.url,
        ip: ip,
        userAgent: ua,
        timestamp: new Date().toISOString()
    };
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(requestData));
        }
    });
    
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        statusCodes[statusCode] = (statusCodes[statusCode] || 0) + 1;
        
        const responseData = {
            type: 'response',
            method: req.method,
            url: req.url,
            statusCode: statusCode,
            duration: duration,
            timestamp: new Date().toISOString()
        };
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(responseData));
            }
        });
        
        originalSend.call(this, data);
    };
    
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'modules', 'dstats.html'));
});

app.get('/api/stats', (req, res) => {
    res.json({
        rps: currentRPS,
        rpsHistory: rpsHistory,
        totalRequests: totalRequests,
        requestsBlocked: requestsBlocked,
        requestsBypassed: requestsBypassed,
        methods: requestMethods,
        statusCodes: statusCodes,
        trafficSources: trafficSources,
        uniqueIPs: Object.keys(ipAddresses).length,
        topUserAgents: Object.entries(userAgents)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
    });
});

app.get('/test', (req, res) => {
    res.status(200).json({ 
        message: 'Test endpoint - Legitimate request',
        currentRPS: currentRPS,
        serverTime: new Date().toISOString(),
        status: 'OK'
    });
});

app.get('/stress', (req, res) => {
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
    }
    res.status(200).json({ 
        message: 'Stress test completed',
        computation: result,
        currentRPS: currentRPS,
        status: 'Processed'
    });
});

app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.path,
        status: 'Not Found'
    });
});

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    const initialData = {
        type: 'connection',
        message: 'Connected to DStats monitoring',
        timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(initialData));
    
    const statsData = {
        type: 'stats',
        rps: currentRPS,
        rpsHistory: rpsHistory,
        totalRequests: totalRequests,
        requestsBlocked: requestsBlocked,
        requestsBypassed: requestsBypassed,
        methods: requestMethods,
        statusCodes: statusCodes,
        trafficSources: trafficSources,
        ips: Object.keys(ipAddresses).length,
        timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(statsData));
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});

console.clear();
console.clear();
console.log("\x1b[35m%s\x1b[0m", `
          ⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠀⠀⠀⠀⣾⣿⣶⣶⣤⣤⣤⣶⣤⡄⠀⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⣠⣴⣾⣿⣿⣿⣷⣦⡘⠛⠛⢿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠀⠀⠀⠀
          ⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⡿⠟⢋⣁⣤⣤⣀⠈⠻⣿⣿⣿⣿⣿⣿⡄⠀⠀⠀⠀
          ⠀⠀⠀⣴⣿⣿⣿⣿⠟⠉⠀⣾⣿⣿⠿⢿⣿⣷⣄⠙⢿⣿⣿⣿⣿⣿⠀⠀⠀⠀
          ⠀⠀⢰⣿⣿⣿⣿⠏⢀⣤⣦⣀⣤⣶⣤⣠⡀⠈⠻⠇⢸⣯⡙⠛⠛⣫⣤⣄⠀⠀
          ⠀⠀⢼⣿⣿⣿⣿⢠⣿⠟⣿⣿⣿⣿⡿⣿⣿⣆⣤⣤⠘⣿⣿⣦⣾⣿⣿⣿⣧⠀
          ⠀⠀⠈⢿⣿⣿⡇⣿⡏⠀⢿⣿⣿⣿⡆⠀⣿⡿⢹⣿⣧⠹⠋⠀⣿⣿⣿⣿⣿⣧
          ⠀⢠⣿⣦⠻⣿⡇⣿⣿⡄⠈⠻⣿⣛⣡⣴⠟⢁⣾⣿⡟⣠⣶⣄⢸⣿⣿⣿⣿⡏
          ⢀⣾⣿⣿⠀⠈⠁⠘⣿⣿⣷⣤⡌⣛⣭⣥⣶⣿⡿⢋⣼⣿⣿⣿⣼⣿⣿⣿⠟⠀
          ⢾⣿⣿⣿⠀⣿⣿⣆⠈⣻⡿⠟⠋⠀⠉⠛⠉⢁⣴⣿⣿⣿⣿⣿⣿⣿⣿⠋⠀⠀
          ⠈⢻⣿⣿⡄⣿⣿⣿⣧⡘⢿⣷⣶⣤⣤⣴⣶⣿⣿⣿⠿⠟⠋⠽⠿⣟⣵⡆⠀⠀
          ⠀⠀⠙⢿⡷⢻⣿⣿⣿⣿⣶⣦⣭⣭⣙⣛⣛⠉⠉⠀⠀⣀⣤⣴⣾⣿⡿⠁⠀⠀
          ⠀⠀⠀⠀⠀⠈⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠇⣴⣿⣿⣿⣿⠟⠋⠀⠀⠀⠀
          ⠀⠀⠀⠀⠀⠀⠀⠀⠙⠻⢿⣿⣿⡿⠿⠟⠋⠁⠀⠉⠛⠟⠋⠀⠀⠀⠀⠀⠀⠀

`);
function startCloudflaredTunnel() {
    console.log('Starting Cloudflared tunnel...');
    const cloudflared = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`]);
    
    cloudflared.stdout.on('data', (data) => {
        console.log(`Cloudflared: ${data}`);
    });
    
    cloudflared.stderr.on('data', (data) => {
        console.error(`Cloudflared error: ${data}`);
    });
    
    cloudflared.on('close', (code) => {
        console.log(`Cloudflared process exited with code ${code}`);
    });
    
    return cloudflared;
}

function askPublicUrl() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('URL public (y/n)? ', (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            console.log('Using Cloudflared tunnel for public URL');
            startCloudflaredTunnel();
        } else {
            console.log('Using localhost');
        }
        
        server.listen(PORT, () => {
            console.log(`DStats Server running at http://localhost:${PORT}`);
            console.log(`Dashboard: http://localhost:${PORT}/`);
            console.log(`Test endpoint: http://localhost:${PORT}/test`);
            console.log(`Stress test: http://localhost:${PORT}/stress`);
            console.log(`API Stats: http://localhost:${PORT}/api/stats`);
        });
        
        rl.close();
    });
}

askPublicUrl();