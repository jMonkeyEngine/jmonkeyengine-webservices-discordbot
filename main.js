const Config = require("./config.json");
const DiscordBot = require('./DiscordBot.js');
const EmailFetcher = require('./EmailFetcher.js');
const BackersBot = require('./BackersBot.js');
const fetch = require('node-fetch');

function _u(u) { return u + "?rand=" + Math.random() + "-" + Date.now(); }

async function main(){
    const dbot=await DiscordBot.init();
    const emailFetcher=await EmailFetcher.init(dbot);
    const backerBot=await BackersBot.init(dbot);

    dbot.addCommand("github",{
        cmd:"github",
        desc:"Link github repo"
    },()=>"https://github.com/jMonkeyEngine/jmonkeyengine");
    
    dbot.addCommand("home",{
        cmd:"home",
        desc:"Link homepage"
    },()=>"https://jmonkeyengine.org");
    

    dbot.addCommand("store",{
        cmd:"store",
        desc:"Link store"
    },()=>"https://store.jmonkeyengine.org");
 
    
    dbot.addCommand("hub",{
        cmd:"hub",
        desc:"Link forum"
    },()=>"https://hub.jmonkeyengine.org");
    
    dbot.addCommand("containers",{
        cmd:"containers",
        desc:"Show health of running containers"
    }, (args, msg) => {
        const url = _u(Config.statusUrl);
        fetch(url, { headers: {"Pragma": "no-cache", "Cache-Control": 'no-cache' } }).then(res => res.json()).then(body => {
            let empty = true;
            for (let key in body) {
                let emoji = ":thinking: ";
                empty = false;
                try {
                    if (!body[key].status) throw "Undefined status";
                    if (body[key].status == "healthy")  emoji = ":white_check_mark: ";
                    else if (body[key].status == "unhealthy") emoji = ":x:"                    
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
    });
    
}


main();