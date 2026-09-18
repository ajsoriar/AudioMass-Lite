#!/usr/bin/env node
'use strict';

/*
 * AudioMass dev server -- Node port of audiomass-server.go
 * Zero dependencies. Run from the `src` dir:  node audiomass-server.js
 *
 * Extras over the Go version: cross-platform browser launch, HTTP Range
 * support (so scrubbing the sample mp3s does not refetch them whole) and
 * proper MIME types for the fonts/media this app loads.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const args = process.argv.slice(2);
const PORT = Number(process.env.PORT) || 5055;
const ROOT = path.resolve(args.find(function (a) { return a[0] !== '-'; }) || '.');
const OPEN = !args.includes('--no-open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.appcache': 'text/cache-manifest',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject'
};

// the files you actually edit while developing -- never let the browser hold on to them
const NO_CACHE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.wasm', '.appcache', '.webmanifest']);

function send(req, res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function resolveSafe(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    return null;
  }
  const full = path.resolve(ROOT, '.' + path.posix.normalize(rel.replace(/\\/g, '/')));
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;

  let start, end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix <= 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return 'invalid';
  return { start: start, end: end };
}

async function listDir(res, dir, pathname) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const rows = entries
    .sort(function (a, b) { return a.name.localeCompare(b.name); })
    .map(function (e) {
      const slash = e.isDirectory() ? '/' : '';
      return '<li><a href="' + encodeURIComponent(e.name) + slash + '">' + e.name + slash + '</a></li>';
    })
    .join('\n');
  const html = '<!doctype html><meta charset="utf-8"><title>' + pathname + '</title>' +
    '<h1>' + pathname + '</h1><ul>' + rows + '</ul>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function handle(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  console.log('Req:', req.headers.host, pathname);

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(req, res, 405, { 'Allow': 'GET, HEAD', 'Content-Type': 'text/plain' }, 'Method Not Allowed');
  }

  let file = resolveSafe(pathname);
  if (!file) return send(req, res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');

  let stat;
  try {
    stat = await fsp.stat(file);
  } catch (e) {
    return send(req, res, 404, { 'Content-Type': 'text/plain' }, '404 page not found');
  }

  if (stat.isDirectory()) {
    if (!pathname.endsWith('/')) {
      return send(req, res, 301, { 'Location': pathname + '/' }, '');
    }
    const index = path.join(file, 'index.html');
    try {
      stat = await fsp.stat(index);
      file = index;
    } catch (e) {
      return listDir(res, file, pathname);
    }
  }

  const ext = path.extname(file).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Last-Modified': stat.mtime.toUTCString()
  };

  if (NO_CACHE.has(ext)) {
    headers['Cache-Control'] = 'no-cache, no-store, private, max-age=0';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = new Date(0).toUTCString();
    headers['X-Accel-Expires'] = '0';
  }

  const size = stat.size;
  let start = 0;
  let end = size - 1;
  let status = 200;

  if (req.headers.range && size > 0) {
    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') {
      headers['Content-Range'] = 'bytes */' + size;
      return send(req, res, 416, headers, '');
    }
    if (range) {
      start = range.start;
      end = range.end;
      status = 206;
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
    }
  }

  headers['Content-Length'] = size === 0 ? 0 : end - start + 1;
  res.writeHead(status, headers);

  if (req.method === 'HEAD' || size === 0) return res.end();

  const stream = fs.createReadStream(file, { start: start, end: end });
  stream.on('error', function () { res.destroy(); });
  req.on('close', function () { stream.destroy(); });
  stream.pipe(res);
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
      : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
  } catch (e) { /* no browser, no problem */ }
}

const server = http.createServer(function (req, res) {
  handle(req, res).catch(function (err) {
    console.error('Error:', err && err.message);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  });
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('\nPort ' + PORT + ' is already in use. Try:  PORT=5056 node audiomass-server.js\n');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, function () {
  console.log('\nServing ' + ROOT + '\nListening on http://localhost:' + PORT + ' \n');
  if (OPEN) openBrowser('http://localhost:' + PORT + '/');
});
