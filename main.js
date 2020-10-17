const Config = require("./config.json");
const Discord = require('discord.js');
const fetch = require('node-fetch');
const Imaps = require('imap-simple');
const MailParser = require('mailparser');
const TurndownService = require('turndown');
const { parse } = require("path");
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const _ = require('lodash');

function _u(u) { return u + "?rand=" + Math.random() + "-" + Date.now(); }

async function parseMessage(message) {
    const out = {};

    let all = _.find(message.parts, { "which": "" })

    const id = message.attributes.uid;
    const idHeader = "Imap-Id: " + id + "\r\n";

    const parsedBody = await MailParser.simpleParser(idHeader + all.body, {
        skipImageLinks: true,
        skipHtmlToText: false,
        skipTextToHtml: false,
        skipTextLinks: false
    });
    out.subject = parsedBody.subject;
    out.from = parsedBody.from.text;


    let body = parsedBody.html;
    if (!body) body = parsedBody.text;

    const window = new JSDOM('').window;
    const DOMPurify = createDOMPurify(window);
    body = DOMPurify.sanitize(body, {
        ALLOWED_TAGS: ['b', 'i', 'h1', 'h2', 'h3', 'a', 'img'],
        ALLOWED_ATTR: ['href', 'src']
    });

    body = new TurndownService().turndown(body);
    out.body_parts = body.match(/.{1,2000}/g)

    out.files = [];
    for (let i in parsedBody.attachments) {
        console.log("Found attachment", parsedBody.attachments[i].filename);
        files.push(
            {
                attachment: parsedBody.attachments[i].content,
                name: parsedBody.attachments[i].filename
            }
        );
    }

    return out;
}


// IMAP email fetch
async function emailFetch(discordClient) {
    let connection;
    const config = {
        imap: {
            user: Config.imapUser,
            password: Config.imapPassword,
            host: Config.imapHost,
            port: Config.imapPort,
            tls: true,
            authTimeout: 3000
        },
    };
    connection = await Imaps.connect(config);
    await connection.openBox("INBOX");

    const searchCriteria = ['UNSEEN'];
    const fetchOptions = {
        bodies: ['HEADER.FIELDS (SUBJECT FROM)', 'TEXT', ''],
        markSeen: true
    };
    connection.search(searchCriteria, fetchOptions).then(async (messages) => {

        console.log("Found", messages.length, "messages");
        for (let i in messages) {
            const message = await parseMessage(messages[i]);
            if (message.body_parts.length == 0) {
                console.error("message without body");
                continue;
            }
            if (message.subject.startsWith("MONITOR ") || message.subject.startsWith("ALERT SSH ")) {
                let monitorMessage;
                if (message.body_parts[0].startsWith("WARN:")) monitorMessage = ":x: **" + message.body_parts[0].trim() + "** " + Config.mentionOnImportant;
                else if (message.body_parts[0].startsWith("ALERT SSH ")) monitorMessage = ":warning:  " + message.body_parts[0].trim();
                else monitorMessage = ":white_check_mark: " + message.body_parts[0].trim();
                discordClient.channels.cache.get(Config.statusChannel).send(monitorMessage);
            } else {
                discordClient.channels.cache.get(Config.emailChannel).send(`**### EMAIL FROM ${message.from} ###**`);
                discordClient.channels.cache.get(Config.emailChannel).send(`
**Subject**: ${message.subject}
**Body**:
------------------------`);
                for (let i in message.body_parts) discordClient.channels.cache.get(Config.emailChannel).send(message.body_parts[i]);
                discordClient.channels.cache.get(Config.emailChannel).send("------------------------");
                discordClient.channels.cache.get(Config.emailChannel).send("**" + message.files.length + " Attachments**", message.files);
                discordClient.channels.cache.get(Config.emailChannel).send(`**### END ###**`);
                for (let i in message.files.files) message.files.files[i].attachment.release();
            }
        }
    }).catch(e => {
        console.error(e);
    }).finally(() => {
        connection.end();
    });
}



// Discord Bot
const discordClient = new Discord.Client();
let mailFetchInterval = null;
discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`);
    console.log(`Invite the bot using the following url 
    
    https://discord.com/api/oauth2/authorize?client_id=${Config.clientId}&permissions=67584&scope=bot 
    
    `);
    mailFetchInterval = setInterval(() => emailFetch(discordClient), Config.mailCheckInterval * 1000);
    emailFetch(discordClient);
});
discordClient.on('close', () => {
    clearInterval(mailFetchInterval);
    console.log("Bye");
});
discordClient.on('message', msg => {
    if (msg.content.startsWith(!Config.prefix)) return;
    const cmd = msg.content.substring(Config.prefix.length).trim();
    if (cmd == "help") {
        msg.reply(`
**Usage:**
-  **${Config.prefix} github **: Link github repo
-  **${Config.prefix} home **: Link homepage
-  **${Config.prefix} store **: Link store
-  **${Config.prefix} hub **: Link forum
-  **${Config.prefix} containers** : Show health of running containers
        `);
    } else if (cmd == "github") {
        msg.reply("https://github.com/jMonkeyEngine/jmonkeyengine")
    } else if (cmd == "home") {
        msg.reply("https://jmonkeyengine.org")
    } else if (cmd == "store") {
        msg.reply("https://store.jmonkeyengine.org")
    } else if (cmd == "forum" || cmd == "hub") {
        msg.reply("https://hub.jmonkeyengine.org")
    } else if (cmd == "containers") {
        const url = _u(Config.statusUrl);
        fetch(url, {
            headers: {
                "Pragma": "no-cache",
                "Cache-Control": 'no-cache'
            }
        }).then(res => res.json()).then(body => {
            console.log(body);
            let empty = true;
            for (let key in body) {
                let emoji = ":thinking: ";
                empty = false;
                try {
                    if (!body[key].status) throw "Undefined status";
                    if (body[key].status == "healthy") {
                        emoji = ":white_check_mark: ";
                    } else if (body[key].status == "unhealthy") {
                        emoji = ":x:"
                    }
                    msg.reply(`${emoji} **${key}**: ${body[key].status} `);
                } catch (e1) {
                    msg.reply(`${emoji} **${key}**: unknown`);
                    console.error(e1);
                }
            }
            if (empty) msg.reply(":moyai: **monitor is down**");
        }).catch((e) => {
            console.error(e);
            msg.reply(":moyai:  **monitor is down**");
        });
    }
});
discordClient.login(Config.botToken);


