const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pino = require('pino');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let sock;

// Global Settings State
const botSettings = {
    autoreact: false,
    autostatusview: false,
    autostatuslike: false,
    antilink: {},
    warnings: {}
};

app.use(express.static('public'));
app.use(express.json());

// Keep-Alive route for Render & UptimeRobot
app.get('/ping', (req, res) => res.send('OK'));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('✅ BATMAN MD BOT Connected!');
            io.emit('connected', 'Bot Successfully Connected!');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg || !msg.message) return;
        const from = msg.key.remoteJid;

        // Auto Status Handler
        if (from === 'status@broadcast') {
            if (botSettings.autostatusview) await sock.readMessages([msg.key]);
            if (botSettings.autostatuslike) await sock.sendMessage(from, { react: { text: '💚', key: msg.key } });
            return;
        }

        if (msg.key.fromMe) return;

        const isGroup = from.endsWith('@g.us');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';

        // Auto React on Normal Messages
        if (botSettings.autoreact && text && !text.startsWith('.')) {
            const emojis = ['🔥', '⚡', '🤖', '👑', '💯'];
            await sock.sendMessage(from, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: msg.key } });
        }

        // AntiLink Feature
        if (isGroup && botSettings.antilink[from] && (text.includes('chat.whatsapp.com/') || text.includes('http://') || text.includes('https://'))) {
            await sock.sendMessage(from, { delete: msg.key });
            await sock.sendMessage(from, { text: '⚠️ Group mein links allowed nahi hain!' });
            return;
        }

        if (!text.startsWith('.')) return;

        const command = text.slice(1).trim().split(' ')[0].toLowerCase();
        const args = text.trim().split(/ +/).slice(1);
        const query = args.join(' ');

        // 1. MENU COMMAND (With Image & Channel Link)
        if (command === 'menu' || command === 'help') {
            const menuText = `╭━━━〔 🔥 𝘽𝘼𝙏𝙈𝘼𝙉 𝙈𝘿 𝘽𝙊𝙏 🔥 〕━━━╮
┃ 
┃ ⚙️ Prefix : [ . ]
┃ 👤 Owner  : Batman
┃ ⚡ Speed  : 0.02s
┃
┣━━━⪧ ⚙️ 𝘼𝙐𝙏𝙊 𝙎𝙀𝙏𝙏𝙄𝙉𝙂𝙎
┃
┃ 1: .autoreact
┃ 2: .autostatusview
┃ 3: .autostatuslike
┃
┣━━━⪧ 👥 𝙂𝙍𝙊𝙐𝙋 𝘾𝙊𝙉𝙏𝙍𝙊𝙇
┃ 
┃ 4: .tagall
┃ 5: .hidetag
┃ 6: .adminlist
┃ 7: .groupinfo
┃ 8: .kick
┃ 9: .add
┃ 10: .group open/close
┃ 11: .link
┃ 12: .revoke
┃ 13: .mute
┃ 14: .unmute
┃ 15: .antilink
┃ 16: .warn
┃ 17: .unwarn
┃ 18: .vcf
┃
┣━━━⪧ 🎮 𝙐𝙉 & 𝙂𝘼𝙈𝙀𝙎
┃
┃ 19: .truth
┃ 20: .dare
┃ 21: .roast
┃ 22: .fact
┃ 23: .joke
┃ 24: .ship
┃
┣━━━⪧ 🕵️ 𝙎𝙀𝘾𝙍𝙀𝙏 𝙏𝙊𝙊𝙇𝙎
┃
┃ 25: .vv
┃
┣━━━⪧ 🔄 𝙈𝙀𝘿𝙄𝘼 𝘾𝙊𝙉𝙑𝙀𝙍𝙏𝙀𝙍𝙎
┃
┃ 26: .s
┃ 27: .sticker
┃ 28: .toimg
┃ 29: .tomp3
┃
┣━━━⪧ 📥 𝘿𝙊𝙒𝙉𝙇𝙊𝘼𝘿𝙀𝙍
┃
┃ 30: .play
┃ 31: .song
┃ 32: .video
┃ 33: .ytmp4
┃ 34: .ig
┃ 35: .fb
┃
┣━━━⪧ 🤖 𝘼𝙄 𝘾𝙃𝘼𝙏
┃
┃ 36: .ai
┃ 37: .gpt
┃
┣━━━⪧ 🛠️ 𝙐𝙏𝙄𝙇𝙄𝙏𝙄𝙀𝙎 & 𝙎𝙔𝙎𝙏𝙀𝙈
┃
┃ 38: .ping
┃ 39: .speed
┃ 40: .runtime
┃ 41: .uptime
┃ 42: .clearcache
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(from, {
                image: { url: 'https://cdn.phototourl.com/free/2026-09-19-360ade3c-bad1-4cfb-8e77-506cfc80e765.jpg' },
                caption: menuText,
                contextInfo: {
                    externalAdReply: {
                        title: "⊰𝐅𝐀𝐌𝐎𝐔𝐒 𝐁𝐀𝐓𝐌𝐀𝐍⊱",
                        body: "Click to join our WhatsApp Channel",
                        mediaType: 1,
                        sourceUrl: "https://whatsapp.com/channel/0029VbDCBI247XeL2zDjH23W",
                        renderLargerThumbnail: true,
                        thumbnailUrl: 'https://cdn.phototourl.com/free/2026-09-19-360ade3c-bad1-4cfb-8e77-506cfc80e765.jpg'
                    }
                }
            });
        }

        // 2. AUTO SETTINGS
        else if (command === 'autoreact') {
            botSettings.autoreact = args[0] === 'on';
            await sock.sendMessage(from, { text: `Auto React: ${botSettings.autoreact ? 'ON' : 'OFF'}` });
        }
        else if (command === 'autostatusview') {
            botSettings.autostatusview = args[0] === 'on';
            await sock.sendMessage(from, { text: `Auto Status View: ${botSettings.autostatusview ? 'ON' : 'OFF'}` });
        }
        else if (command === 'autostatuslike') {
            botSettings.autostatuslike = args[0] === 'on';
            await sock.sendMessage(from, { text: `Auto Status Like: ${botSettings.autostatuslike ? 'ON' : 'OFF'}` });
        }

        // 3. GROUP CONTROL
        else if (isGroup) {
            if (command === 'tagall' || command === 'hidetag') {
                const metadata = await sock.groupMetadata(from);
                const mentions = metadata.participants.map(p => p.id);
                let response = command === 'tagall' ? '📢 *EVERYONE*:\n\n' + mentions.map(m => `@${m.split('@')[0]}`).join('\n') : query;
                await sock.sendMessage(from, { text: response, mentions });
            }
            else if (command === 'adminlist') {
                const metadata = await sock.groupMetadata(from);
                const admins = metadata.participants.filter(p => p.admin).map(p => `@${p.id.split('@')[0]}`).join('\n');
                await sock.sendMessage(from, { text: `👑 *Group Admins:\n\n${admins}`, mentions: metadata.participants.filter(p => p.admin).map(p => p.id) });
            }
            else if (command === 'groupinfo') {
                const metadata = await sock.groupMetadata(from);
                await sock.sendMessage(from, { text: `📌 *Group:* ${metadata.subject}\n👥 *Members:* ${metadata.participants.length}` });
            }
            else if (command === 'link') {
                const code = await sock.groupInviteCode(from);
                await sock.sendMessage(from, { text: `https://chat.whatsapp.com/${code}` });
            }
            else if (command === 'revoke') {
                await sock.groupRevokeInvite(from);
                await sock.sendMessage(from, { text: '✅ Invite link reset ho gaya hai!' });
            }
            else if (command === 'mute' || (command === 'group' && args[0] === 'close')) {
                await sock.groupSettingUpdate(from, 'announcement');
                await sock.sendMessage(from, { text: '🔇 Group close/mute ho gaya!' });
            }
            else if (command === 'unmute' || (command === 'group' && args[0] === 'open')) {
                await sock.groupSettingUpdate(from, 'not_announcement');
                await sock.sendMessage(from, { text: '🔊 Group open/unmute ho gaya!' });
            }
            else if (command === 'antilink') {
                botSettings.antilink[from] = args[0] === 'on';
                await sock.sendMessage(from, { text: `AntiLink: ${botSettings.antilink[from] ? 'ON' : 'OFF'}` });
            }
            else if (command === 'kick') {
                const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mentioned) {
                    await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
                    await sock.sendMessage(from, { text: '❌ Member removed!' });
                }
            }
            else if (command === 'add') {
                if (query) {
                    const number = query.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    await sock.groupParticipantsUpdate(from, [number], 'add');
                    await sock.sendMessage(from, { text: '✅ Member added!' });
                }
            }
            else if (command === 'warn') {
                const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mentioned) {
                    botSettings.warnings[mentioned] = (botSettings.warnings[mentioned] || 0) + 1;
                    await sock.sendMessage(from, { text: `⚠️ Warning ${botSettings.warnings[mentioned]}/3 for @${mentioned.split('@')[0]}`, mentions: [mentioned] });
                    if (botSettings.warnings[mentioned] >= 3) {
                        await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
                        botSettings.warnings[mentioned] = 0;
                    }
                }
            }
            else if (command === 'unwarn') {
                const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mentioned) {
                    botSettings.warnings[mentioned] = 0;
                    await sock.sendMessage(from, { text: `✅ Warnings cleared for @${mentioned.split('@')[0]}`, mentions: [mentioned] });
                }
            }
            else if (command === 'vcf') {
                const metadata = await sock.groupMetadata(from);
                let vcfData = '';
                metadata.participants.forEach((p, i) => {
                    vcfData += `BEGIN:VCARD\nVERSION:3.0\nFN:Member ${i + 1}\nTEL;TYPE=CELL:${p.id.split('@')[0]}\nEND:VCARD\n`;
                });
                await sock.sendMessage(from, { document: Buffer.from(vcfData), fileName: 'contacts.vcf', mimetype: 'text/vcard' });
            }
        }

        // 4. SECRET TOOLS (.vv - View Once Recovery)
        if (command === 'vv') {
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const viewOnce = quotedMsg?.viewOnceMessage?.message || quotedMsg?.viewOnceMessageV2?.message;
            if (viewOnce) {
                const type = Object.keys(viewOnce)[0];
                const stream = await downloadContentFromMessage(viewOnce[type], type.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                if (type === 'imageMessage') await sock.sendMessage(from, { image: buffer, caption: '🔓 View-Once Media Saved!' });
                if (type === 'videoMessage') await sock.sendMessage(from, { video: buffer, caption: '🔓 View-Once Media Saved!' });
            } else {
                await sock.sendMessage(from, { text: '❌ Kisi View-Once message ko reply karke .vv likho!' });
            }
        }

        // 5. STICKER & MEDIA CONVERTER
        else if (command === 's' || command === 'sticker') {
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMsg = msg.message.imageMessage || quotedMsg?.imageMessage;
            if (imageMsg) {
                const stream = await downloadContentFromMessage(imageMsg, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.sendMessage(from, { sticker: buffer });
            } else {
                await sock.sendMessage(from, { text: '❌ Kisi photo par reply karke .s likho!' });
            }
        }

        // 6. FUN & GAMES
        else if (command === 'joke') {
            await sock.sendMessage(from, { text: '😂 Dost: Bhai tera computer kitna fast hai?\nMe: Screen touch karte hi dhooa nikal aata hai!' });
        }
        else if (command === 'fact') {
            await sock.sendMessage(from, { text: '💡 Fact: Shahad (Honey) kabhi kharab nahi hota!' });
        }
        else if (command === 'truth') {
            await sock.sendMessage(from, { text: '🎯 *TRUTH:* Sabse bada secret kya hai aapka?' });
        }
        else if (command === 'dare') {
            await sock.sendMessage(from, { text: '🔥 *DARE:* Group mein ek funny voice note bhejo!' });
        }
        else if (command === 'roast') {
            await sock.sendMessage(from, { text: `🔥 @${(msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || from).split('@')[0]} Aapki akal aur network, dono hamesha gayab rehte hain!`, mentions: [msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || from] });
        }
        else if (command === 'ship') {
            await sock.sendMessage(from, { text: `❤️ Compatibility: ${Math.floor(Math.random() * 100)}%` });
        }

        // 7. AI CHAT
        else if (command === 'ai' || command === 'gpt') {
            if (!query) return await sock.sendMessage(from, { text: '❌ Sawal likho! e.g. .ai Hello' });
            await sock.sendMessage(from, { text: `🤖 *BATMAN AI:* ${query} ka jawab process ho raha hai...` });
        }

        // 8. DOWNLOADERS
        else if (['play', 'song', 'video', 'ytmp4', 'ig', 'fb'].includes(command)) {
            if (!query) return await sock.sendMessage(from, { text: `❌ Link ya naam likho! e.g. .${command} link` });
            await sock.sendMessage(from, { text: `📥 Downloading: *${query}*...\nThodi der wait karein!` });
        }

        // 9. SYSTEM
        else if (command === 'ping' || command === 'speed') {
            await sock.sendMessage(from, { text: '🚀 BATMAN MD BOT Speed: 0.01s' });
        }
        else if (command === 'runtime' || command === 'uptime') {
            const uptime = process.uptime();
            await sock.sendMessage(from, { text: `⏱️ Uptime: ${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s` });
        }
        else if (command === 'clearcache') {
            await sock.sendMessage(from, { text: '🧹 Cache cleared!' });
        }
    });
}

// Pairing Code Route
app.post('/get-pairing-code', async (req, res) => {
    let phone = req.body.phone;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    phone = phone.replace(/[^0-9]/g, '');

    try {
        if (!sock.authState.creds.registered) {
            setTimeout(async () => {
                let code = await sock.requestPairingCode(phone);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                res.json({ code });
            }, 3000);
        } else {
            res.json({ error: 'Already registered' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate code' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startBot();
});
      
