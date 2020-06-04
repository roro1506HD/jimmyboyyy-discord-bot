// Initialize discord instance
const Discord = require('discord.js');

// Create discord client
const client = new Discord.Client({
    disableEveryone: false,
    disabledEvents: []
});

// Load config, where discord token, google api key and twitch token are stored
const config = require('./config.json');
// Load alerts statuses
const alerts = require('./alerts.json');

// Load exit hook lib to logout when exiting process
const exitHook = require('async-exit-hook');

// Load File System used in exit hook to save current alerts statuses
const files = require('fs');

// Load axios instance creator
const axios = require('axios');
// Create twitch axios instance with client id header
const twitchAxios = axios.create({
	baseURL: 'https://api.twitch.tv/helix/',
	headers: {
		'Client-ID': config.twitchClientId,
		'Authorization': 'Bearer ' + config.twitchOauthToken
	}
});
// Create youtube axios instance
const youtubeAxios = axios.create({
	baseURL: 'https://www.googleapis.com/youtube/v3/'
});

//==========================================================

let guild;

let welcomeChannel;
let settingsChannel;
let alertsChannel;

let settingsMessage;

//==========================================================

function Twitch() {}

Twitch.getStream = userId => {
	return new Promise((resolve, reject) => {
		twitchAxios.get('/streams', {
			params: {
				user_id: userId,
				first: 1
			}
		})
		.then(response => resolve(response.data))
		.catch(error => reject(error.response));
	});
}

function Youtube() {}

Youtube.search = (channelId, key) => {
	return new Promise((resolve, reject) => {
		youtubeAxios.get('/search', {
			params: {
				part: 'snippet',
				channelId: channelId,
				maxResults: 1,
				order: 'date',
				type: 'video',
				key: key
			}
		})
		.then(response => resolve(response.data.items[0]))
		.catch(error => reject(error.response));
	});
}

//==========================================================
function startTwitchStreamAlerts() {
    Twitch.getStream(49035758).then(stream => {
        if (stream.data.length == 0 && alerts.twitch.live)
            alerts.twitch.live = false;
        else if (stream.data.length == 1 && !alerts.twitch.live) {
            alerts.twitch.live = true;

            guild.roles.get('592695539242500096').setMentionable(true, 'Sending alert').then(role => {
                alertsChannel.send(`${role.toString()}, nouveau stream ! **${stream.data[0].title}**\nhttps://twitch.tv/jimmyboyyy`).then(unused => {
                    role.setMentionable(false, 'Alert sent').catch(console.log);
                }).catch(console.log);
            }).catch(console.log);
        }
    }).catch(console.log);

    setTimeout(startTwitchStreamAlerts, 60000);
}

function startYoutubeVideoAlerts() {
    Youtube.search('UCWMDouVLeI-akimFWkdt3Pw', config.youtubeApiKey).then(video => {
        let id = video.id.videoId;

        if (id !== alerts.youtube.lastVideoId) {
            alerts.youtube.lastVideoId = id;

            guild.roles.get('592695579478327296').setMentionable(true, 'Sending alert').then(role => {
                alertsChannel.send(`${role.toString()}, nouvelle vidéo disponible ! **${video.snippet.title}**\nhttps://youtu.be/${id}`).then(unused => {
                    role.setMentionable(false, 'Alert sent').catch(console.log);
                }).catch(console.log);
            }).catch(console.log);
        }
    }).catch(console.log);

    setTimeout(startYoutubeVideoAlerts, 3600000);
}

function startYoutubeVodAlerts() {
    Youtube.search('UC_su1jNCw543AAtA7v8I_5A', config.youtubeApiKey).then(video => {
        let id = video.id.videoId;

        if (id !== alerts.youtube.lastVodId) {
            alerts.youtube.lastVodId = id;

            guild.roles.get('592695643063975936').setMentionable(true, 'Sending alert').then(role => {
                alertsChannel.send(`${role.toString()}, nouvelle VOD disponible ! **${video.snippet.title}**\nhttps://youtu.be/${id}`).then(unused => {
                    role.setMentionable(false, 'Alert sent').catch(console.log);
                }).catch(console.log);
            }).catch(console.log);
        }
    }).catch(console.log);

    setTimeout(startYoutubeVodAlerts, 3600000);
}
//==========================================================

exitHook(() => {
    console.log('Calling exit hook');
    client.destroy();
    files.writeFileSync('./alerts.json', JSON.stringify(alerts));
    console.log('Called exit hook');
});

// On Ready Event
client.on('ready', () => {
    guild = client.guilds.first();
    welcomeChannel = client.channels.get('591402976690831370');
    settingsChannel = client.channels.get('591343927173578762');
    alertsChannel = client.channels.get('591339845662670858');

    settingsChannel.fetchMessages({limit: 1}).then(messages => {
        if (messages.size > 0)
            messages.first().delete();
    });

    settingsChannel.send({
        embed: {
            "description": "Configurez à votre guise les notifications que vous voulez reçevoir. Utilisez les réactions ci-dessous pour activer les notifications. Lorsque la réaction est cochée, la notification est activée. Dans le cas contraire elle ne l'est pas.\n\nVous pouvez trouver ci-dessous les explications des réactions.\n\n<:twitch:593025513862201344> **-** Gère les notifications de streams.\n<:youtube:593025530539016193> **-** Gère les notifications de vidéos.\n<:claptwitch:593025468412985344> **-** ~~Gère les notifications de VOD Twitch.~~\n<:clapyoutube:593025491179405322> **-** Gère les notifications de VOD YouTube.",
            "color": 176108
        }
    }).then(message => {
        settingsMessage = message;

        message.react(message.guild.emojis.get('593025513862201344'));
        message.react(message.guild.emojis.get('593025530539016193'));
        //message.react(message.guild.emojis.get('593025468412985344'));
        message.react(message.guild.emojis.get('593025491179405322'));
    });

    startTwitchStreamAlerts();
    startYoutubeVideoAlerts();
    startYoutubeVodAlerts();

    console.log(`Logged in as ${client.user.tag}, serving ${client.users.size} users in guild ${guild.id} (${guild.name})`);
});

// On Client Join
client.on('guildMemberAdd', member => {
    welcomeChannel.send(`<@${member.id}> a rejoint le serveur.`);
});

// Settings
client.on('messageReactionAdd', (reaction, user) => {
    if (!settingsMessage || reaction.message.id !== settingsMessage.id || user.bot)
        return;

    if (!reaction.emoji.id) {
        reaction.remove(user);
        return;
    }
    
    if (reaction.emoji.id === '593025513862201344') {
        guild.fetchMember(user).then(member => {
            member.addRole('592695539242500096', 'Added reaction to settings channel.');
        });
    } else if (reaction.emoji.id === '593025530539016193') {
        guild.fetchMember(user).then(member => {
            member.addRole('592695579478327296', 'Added reaction to settings channel.');
        });
    } else if (false && reaction.emoji.id === '593025468412985344') {
        guild.fetchMember(user).then(member => {
            member.addRole('592695613586538496', 'Added reaction to settings channel.');
        });
    } else if (false && reaction.emoji.id === '593025491179405322') {
        guild.fetchMember(user).then(member => {
            member.addRole('592695643063975936', 'Added reaction to settings channel.');
        });
    } else
        reaction.remove(user);
});

client.on('messageReactionRemove', (reaction, user) => {
    if (!settingsMessage || reaction.message.id !== settingsMessage.id || user.bot)
        return;

    if (!reaction.emoji.id)
        return;
    
    if (reaction.emoji.id === '593025513862201344') {
        guild.fetchMember(user).then(member => {
            member.removeRole('592695539242500096', 'Removed reaction from settings channel.');
        });
    } else if (reaction.emoji.id === '593025530539016193') {
        guild.fetchMember(user).then(member => {
            member.removeRole('592695579478327296', 'Removed reaction from settings channel.');
        });
    } else if (false && reaction.emoji.id === '593025468412985344') {
        guild.fetchMember(user).then(member => {
            member.removeRole('592695613586538496', 'Removed reaction from settings channel.');
        });
    } else if (false && reaction.emoji.id === '593025491179405322') {
        guild.fetchMember(user).then(member => {
            member.removeRole('592695643063975936', 'Removed reaction from settings channel.');
        });
    }
});


// Log in
client.login(config.token);
