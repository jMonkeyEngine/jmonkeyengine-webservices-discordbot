const Config = require("./config.json");
const fetch = require('node-fetch');
const fetchEmailsQuery=`query collective ($offset: Int, $limit: Int){
    collective(slug: "jmonkeyengine") {
      name
      backers: members(role: BACKER, offset: $offset, limit: $limit) {
        limit
        totalCount
        nodes {
          account {
            slug
            type
            ... on Individual {
              email
              name
              website
            }
            ... on Organization {
              admins: members(role: ADMIN) {
                nodes {
                  account {
                    ... on Individual {
                      email
                      name
                      website
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;


async function getBackers(){
    let offset=0;
    let limit =1000;
    const backers=[];
    while(true){
        const resp=await fetch(Config.openCollectiveApiEndPoint+"/"+Config.openCollectiveApiKey, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: fetchEmailsQuery,
                variables: { 
                    offset:offset, 
                    limit:limit
                },
            })
        }).then((res)=>res.json());
        for(let i in resp.data.collective.backers.nodes){
            const node=resp.data.collective.backers.nodes[i];
            backers.push(node.account);
        }
        const count=resp.data.collective.backers.totalCount;
        if(offset+limit>=count)break;
        offset+=limit;    
    }
    return  backers;
}

async function assignRoles() {
    const emails = (await getBackers()).map(backer=>backer.email);
    for (let i in emails) {
        const email = emails[i];
        let url = `${Config.discourseApiEndpoint}/admin/users/list/all.json?email=${email}`;
        const res = await fetch(url, {
            headers: {
                "Api-Username": Config.discourseApiUser,
                "Api-Key": Config.discourseApiKey
            }
        }).then(res => res.json());
        console.log(res);

        for (let j in res) {
            const user = res[j];
            url = `${Config.discourseApiEndpoint}/user_badges.json`;
            const badges = [Config.backerHubBadgeId, Config.contributorHubBadge];
            badges.forEach((b) => {
                console.log("Assign badge " + b + " to ", user.username);
               fetch(url, {
                    method: "post",
                    headers: {
                        "Api-Username": Config.discourseApiUser,
                        "Api-Key": Config.discourseApiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username: user.username, reason: "", badge_id: b })
                }).then(res =>res.json()).then(res=>console.log( res));
            });
        }
    }
}

async function listBackers(msg){
  console.log(await getBackers());
  const backers = (await getBackers()).map(backer=>backer.name+" "+(backer.website?backer.website:""));
  msg.reply(`**Backers:**`);
  backers.forEach(backer=>{
    msg.reply("    - "+backer);
  });

}

async function init(dbot) {
    dbot.addCommand("backers",{
      cmd:"backers",
      desc:"List all the backers"
  },(args,msg)=>listBackers(msg));
  setInterval(assignRoles,1000*60*60);
  assignRoles();

}



module.exports={
  init:init,
  getBackers:getBackers
}
