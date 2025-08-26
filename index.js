require('dotenv').config();
const { Client, Collection, REST, Routes, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const { pripojeni, query, insert, select, update, delete: smazat, check } = require('./module/connect/connect');
const fs = require('fs');
const path = require('path');

const Economy = require('./manager/economy');
const Ticket = require('./manager/ticket');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
    ],
});

const ticket = new Ticket(client);
const economy = new Economy();

client.commands = new Collection();

const ATEAM_ROLE_ID = process.env.ATEAM;
const activeExcuses = new Map();

const commands = [];
const slozkajs = path.join(__dirname, 'commands');
const filejs = fs.readdirSync(slozkajs).filter(file => file.endsWith('.js'));

for (const file of filejs) {
    const pathecek = path.join(slozkajs, file);
    const command = require(pathecek);
    
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10'}).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🚀 Začínám registraci příkazů... Držte se, jde to naostro! ⚡');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT, process.env.GUILD),
            { body: commands },
        );
        
        console.log('🌟 Příkazy byly úspěšně zaregistrovány! Všechno je ready! 🚀');
    } catch (error) {
        console.error('Chyba při registraci příkazů:', error);
    }
})();

client.once('ready', async () => {
    console.log(`🚀 Bot je připojen jako ${client.user.tag}.`);
    
    try {
        await pripojeni();
        console.log('📡 Databáze připojena úspěšně!');
    } catch (err) {
        console.error('❌ Nepodařilo se připojit k databázi:', err.message);
    }
    
    const guild = client.guilds.cache.get(process.env.GUILD);
    
    if (guild) {
        try {
            await ticket.init(guild);
            console.log('🎫 Ticket systém inicializován!');
            
            await economy.init();
            console.log('💰 Economy systém inicializován!');
            
        } catch (err) {
            console.error('❌ Chyba při inicializaci systémů:', err.message);
        }
    } else {
        console.error('❌ Guild nenalezen! Zkontroluj GUILD ID v .env');
    }
});

client.on('interactionCreate', async interaction => {
    try {
        // Zpracování ticket interakcí
        await ticket.handleInteraction(interaction);
        
        // Zpracování slash příkazů
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            
            try {
                await command.execute(interaction, economy);
            } catch (error) {
                console.error('❌ Chyba při vykonávání příkazu:', error);
                
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Nastala chyba při provádění příkazu.',
                        ephemeral: true
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Chyba v interaction handleru:', error);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!omluvenka') {
        const member = message.guild.members.cache.get(message.author.id);
        const hasAteamRole = member.roles.cache.has(ATEAM_ROLE_ID);
        
        if (!hasAteamRole) {
            const noPermissionEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Nemáte oprávnění')
                .setDescription('Tento příkaz mohou používat pouze členové A-team.')
                .setTimestamp();
            
            return message.reply({ embeds: [noPermissionEmbed] });
        }

        const dateEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📝 Vytváření omluvenky')
            .setDescription('Na jak dlouho omluvenku chceš? (od kdy do kdy)')
            .setFooter({ text: 'Odpověz prosím v následující zprávě' })
            .setTimestamp();

        await message.reply({ embeds: [dateEmbed] });

        const dateFilter = (m) => m.author.id === message.author.id;
        const dateCollector = message.channel.createMessageCollector({ 
            filter: dateFilter, 
            time: 60000,
            max: 1 
        });

        dateCollector.on('collect', async (dateMessage) => {
            const dateRange = dateMessage.content;

            const reasonEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📝 Vytváření omluvenky')
                .setDescription('Jaký je důvod omluvenky?')
                .setFooter({ text: 'Odpověz prosím v následující zprávě' })
                .setTimestamp();

            await dateMessage.reply({ embeds: [reasonEmbed] });

            const reasonFilter = (m) => m.author.id === message.author.id;
            const reasonCollector = message.channel.createMessageCollector({ 
                filter: reasonFilter, 
                time: 60000,
                max: 1 
            });

            reasonCollector.on('collect', async (reasonMessage) => {
                const reason = reasonMessage.content;

                const excuseEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Omluvenka vytvořena')
                    .addFields(
                        { name: '👤 Vytvořil', value: `<@${message.author.id}>`, inline: false },
                        { name: '📅 Období', value: dateRange, inline: false },
                        { name: '📝 Důvod', value: reason, inline: false }
                    )
                    .setThumbnail(message.author.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ text: `ID: ${message.author.id}` });

                await reasonMessage.reply({ embeds: [excuseEmbed] });

                const excuseData = {
                    userId: message.author.id,
                    userName: message.author.username,
                    dateRange: dateRange,
                    reason: reason,
                    createdAt: new Date().toISOString()
                };

                activeExcuses.set(message.author.id, excuseData);
                console.log('Nová omluvenka vytvořena:', excuseData);
            });

            reasonCollector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('⏰ Čas vypršel')
                        .setDescription('Příliš dlouho jsi nereagoval. Zkus to znovu s `!omluvenka`.')
                        .setTimestamp();
                    
                    message.channel.send({ embeds: [timeoutEmbed] });
                }
            });
        });

        dateCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('⏰ Čas vypršel')
                    .setDescription('Příliš dlouho jsi nereagoval. Zkus to znovu s `!omluvenka`.')
                    .setTimestamp();
                
                message.channel.send({ embeds: [timeoutEmbed] });
            }
        });
    }

    if (message.content === '!omluvenky') {
        const member = message.guild.members.cache.get(message.author.id);
        const hasAteamRole = member.roles.cache.has(ATEAM_ROLE_ID);
        
        if (!hasAteamRole) {
            return message.reply('❌ Nemáte oprávnění k zobrazení omluvenek.');
        }

        if (activeExcuses.size === 0) {
            const noExcusesEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📋 Aktivní omluvenky')
                .setDescription('Momentálně nejsou žádné aktivní omluvenky.')
                .setTimestamp();
            
            return message.reply({ embeds: [noExcusesEmbed] });
        }

        let excusesList = '';
        activeExcuses.forEach((excuse, userId) => {
            excusesList += `**<@${userId}>**\n📅 ${excuse.dateRange}\n📝 ${excuse.reason}\n\n`;
        });

        const excusesEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📋 Aktivní omluvenky')
            .setDescription(excusesList)
            .setTimestamp();

        message.reply({ embeds: [excusesEmbed] });
    }
});

const vitejte = (member) => {
    const accountAge = Math.floor(member.user.createdTimestamp / 1000);
    const joinedTime = Math.floor(Date.now() / 1000);

    return new EmbedBuilder()
        .setColor(0x00D4AA)
        .setTitle(`✨ Vítej na serveru!`)
        .setDescription(`**${member.user.displayName}** se právě připojil k naší komunitě!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields([
            {
                name: '👤 Uživatel',
                value: `${member.user}`,
                inline: false
            },
            {
                name: '🏷️ Tag',
                value: `\`${member.user.tag}\``,
                inline: false
            },
            {
                name: '👥 Člen číslo',
                value: `**#${member.guild.memberCount}**`,
                inline: false
            },
            {
                name: '📅 Účet vytvořen',
                value: `<t:${accountAge}:D>\n<t:${accountAge}:R>`,
                inline: false
            },
            {
                name: '🎯 Připojení',
                value: `<t:${joinedTime}:F>`,
                inline: false
            },
            {
                name: '🔥 Status',
                value: `\`🟢 Nový člen\``,
                inline: false
            }
        ])
        .setTimestamp()
        .setFooter({ 
            text: `ZikyZone • Vítej mezi námi!`, 
            iconURL: member.guild.iconURL({ dynamic: true }) 
        });
};

client.on('guildMemberAdd', (member) => {
    const discordId = process.env.WELCOME;
    const discord = member.guild.channels.cache.get(discordId);

    if (discord) {
        discord.send({ 
            content: `🎉 **Vítej ${member}!** Nezapomeň si přečíst pravidla!`,
            embeds: [vitejte(member)] 
        });
    } else {
        console.log("Nebyl nalezen kanál #discord.");
    }
});

const odesel = (member) => {
    const joinTime = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
    const leaveTime = Math.floor(Date.now() / 1000);
    const timeOnServer = joinTime ? leaveTime - joinTime : null;
    
    const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle(`👋 Sbohem!`)
        .setDescription(`**${member.user.displayName}** opustil náš server`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields([
            {
                name: '👤 Uživatel',
                value: `${member.user.tag}`,
                inline: false
            },
            {
                name: '👥 Zbývá členů',
                value: `**${member.guild.memberCount}**`,
                inline: false
            },
            {
                name: '📅 Odchod',
                value: `<t:${leaveTime}:F>`,
                inline: false
            }
        ])
        .setTimestamp()
        .setFooter({ 
            text: `ZikyZone • Budeme tě postrádat`, 
            iconURL: member.guild.iconURL({ dynamic: true }) 
        });

    if (joinTime) {
        embed.addFields([
            {
                name: '🕐 Připojil se',
                value: `<t:${joinTime}:D>`,
                inline: true
            },
            {
                name: '⌛ Čas na serveru',
                value: timeOnServer > 86400 ? 
                    `**${Math.floor(timeOnServer / 86400)}** dní` : 
                    `**${Math.floor(timeOnServer / 3600)}** hodin`,
                inline: true
            },
            {
                name: '📊 Aktivita',
                value: timeOnServer > 604800 ? '`🟢 Aktivní člen`' : '`🟡 Krátký pobyt`',
                inline: true
            }
        ]);
    }

    return embed;
};

client.on('guildMemberRemove', (member) => {
    const ahojID = process.env.GOODBYE;
    const ahoj = member.guild.channels.cache.get(ahojID);

    if (ahoj) {
        ahoj.send({ 
            content: `💔 **${member.user.displayName}** nás opustil...`,
            embeds: [odesel(member)] 
        });
    } else {
        console.log("Kanál není pro #discord.")
    }
});

client.login(process.env.TOKEN);
