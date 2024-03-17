import 'dotenv/config';
import fastify from 'fastify';
import axios from 'axios';
import canvas from 'canvas';

import registerFonts from './util/registerFonts.js';
registerFonts();

const base = 'http://ws.audioscrobbler.com/2.0';
const port = Number(process.env.PORT || 3000);
const api_key = String(process.env.LASTFM_API_KEY);
const app = fastify({
    logger: true
});

if (api_key === 'undefined') {
    app.log.error('Last.fm API key not set. Define LASTFM_API_KEY in your environment variables. Exiting...');
    process.exit(1);
}

app.get('/', async (_request, reply) => {
    reply.code(200).send({
        message: 'Hello, world!'
    });
});

app.get('/nowplaying', async (request, reply) => {
    const query = request.query as
        | {
              username?: string;
              size?: string;
              show_username?: string;
              show_logo?: string;
              transparent?: string;
              light?: string;
          }
        | undefined;
    if (!query || !query.username) {
        await reply.code(400).send({
            message: 'Missing query parameters: username'
        });
        return;
    }
    const showUsername = String(query.show_username) === 'undefined' ? true : query.show_username === 'true' || query.show_username === '1';
    const showLogo = String(query.show_logo) === 'undefined' ? true : query.show_logo === 'true' || query.show_logo === '1';
    const transparent = String(query.transparent) === 'undefined' ? false : query.transparent === 'true' || query.transparent === '1';
    const light = String(query.light) === 'undefined' ? false : query.light === 'true' || query.light === '1';
    const width = Number(query.size || 80) * 5;
    const height = Number(query.size || 80);
    const { data } = await axios({
        url: `${base}/?method=user.getrecenttracks&user=${query.username}&api_key=${api_key}&format=json&nowplaying=true`
    });
    const track = data.recenttracks.track[0] || {};
    const nowPlaying = track['@attr']?.nowplaying;
    const can = canvas.createCanvas(width, height);
    const ctx = can.getContext('2d');
    if (!transparent) {
        if (light) ctx.fillStyle = 'white';
        else ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, can.width, can.height);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.roundRect(height * 0.1, height * 0.1, height * 0.8, height * 0.8, 16);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const albumArt = nowPlaying
        ? await canvas.loadImage(track.image.find((img: { size: string }) => img.size === 'extralarge')?.['#text'])
        : await canvas.loadImage(`https://placehold.co/${height * 0.8}x${height * 0.8}`);
    ctx.drawImage(albumArt, height * 0.1, height * 0.1, height * 0.8, height * 0.8);
    ctx.restore();

    ctx.font = `bold ${height * 0.2}px "Source Han Sans"`;
    const lineHeight = ctx.measureText('M').actualBoundingBoxAscent + ctx.measureText('M').actualBoundingBoxDescent;
    if (light) ctx.fillStyle = 'black';
    else ctx.fillStyle = 'white';
    let trackName = nowPlaying ? track.name : 'Nothing playing';
    if (ctx.measureText(trackName).width > width * 0.67) {
        while (ctx.measureText(`${trackName}...`).width > width * 0.67) trackName = trackName.slice(0, -1);
        trackName += '...';
    }
    ctx.fillText(trackName, height * 0.98, height * 0.5 - lineHeight);
    ctx.font = `normal ${height * 0.2}px "Source Han Sans"`;
    let artistName = nowPlaying ? `by ${track.artist['#text']}` : '';
    let albumName = nowPlaying ? `on ${track.album['#text']}` : '';
    if (ctx.measureText(artistName).width > width * 0.67) {
        while (ctx.measureText(`${artistName}...`).width > width * 0.67) artistName = artistName.slice(0, -1);
        artistName += '...';
    }
    if (ctx.measureText(albumName).width > width * 0.67) {
        while (ctx.measureText(`${albumName}...`).width > width * 0.67) albumName = albumName.slice(0, -1);
        albumName += '...';
    }
    if (nowPlaying) ctx.fillText(artistName, height * 0.98, height * 0.5 + lineHeight / 2);
    if (nowPlaying) ctx.fillText(albumName, height * 0.98, height * 0.5 + lineHeight * 2);
    if (showUsername) {
        ctx.font = `normal ${height * 0.1}px "Source Han Sans"`;
        const smallLineHeight = ctx.measureText('M').actualBoundingBoxAscent + ctx.measureText('M').actualBoundingBoxDescent;
        const userText = `@${data.recenttracks['@attr']?.user}`;
        const userTextLength = ctx.measureText(userText).width;
        ctx.fillText(userText, (width - userTextLength) * 0.98, height * 0.98 - smallLineHeight);
    }
    if (showLogo) {
        const logo = await canvas.loadImage('assets/Lastfm_logo.svg');
        const dh = height * 0.15;
        const dw = (dh / logo.height) * logo.width;
        ctx.drawImage(logo, (width - dw) * 0.98, height * 0.1, dw, dh);
    }
    const splitDataUrl = can.toDataURL().split(',')[1];
    if (!splitDataUrl) return await reply.code(500).send({ error: true, code: 500, message: 'Failed to generate image.' });
    await reply
        .code(200)
        .header('Cache-Control', 'must-revalidate, no-cache, no-store, post-check=0, pre-check=0, private')
        .type('image/png')
        .send(Buffer.from(splitDataUrl, 'base64'));
});

app.listen({ host: '0.0.0.0', port });

process.on('SIGTERM', () => process.exit());
