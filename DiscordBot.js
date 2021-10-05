const Config = require("./config.json");
const Discord = require('discord.js');


async function init(){
    return  new Promise( (resolve,reject) => {
        const discordClient = new Discord.Client();

        let commands=[];

        discordClient.on('ready', () => {
            console.log(`Logged in as ${discordClient.user.tag}!`);
            console.log(`Invite the bot using the following url 
            
            https://discord.com/api/oauth2/authorize?client_id=${Config.clientId}&permissions=67584&scope=bot 
            
            `);
            resolve(discordClient);
        });

        discordClient.on('error', (err) => {
            reject(err);
        });

        discordClient.on('close', () => {
            console.log("Bye");
        });

        discordClient.addCommand=function(cmd,help,action){
            commands.push({
                cmd:cmd,
                help:help,
                action:action
            });
        }

        discordClient.on('message', msg => {
            if (!msg.content.startsWith(Config.prefix)) return;
            const cmd = msg.content.substring(Config.prefix.length).trim();
            if (cmd == "help") {
                let reply="**Usage:**";
                for(let i in commands){
                    const command=commands[i];
                    reply+=`\n    -  **${Config.prefix} ${command.help.cmd}**: ${command.help.desc}`;
                }
                msg.reply(reply);
                return;
            }
            for(let i in commands){
                const command=commands[i];
                if(command.cmd==cmd){
                    const reply=command.action(msg.content.substring(Config.prefix.length+cmd.length).trim(),msg);
                    if(reply&&typeof reply==="string"){
                        msg.reply(reply);
                    }
                    break;
                }
            }
        });
        discordClient.login(Config.botToken);
    });
}
module.exports={init:init};
