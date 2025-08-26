const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readFile, writeFile } = require('fs').promises;
const { join } = require('path');

class Economy {
    constructor() {
        this.dataPath = join(process.cwd(), 'data', 'economy.json');
        this.users = new Map();
        this.cooldowns = {
            daily: 86400000,
            weekly: 604800000,
            kolo: 3600000
        };
        this.activeEvents = new Set();
        this.fastEvents = new Map();
    }

    async init() {
        try {
            const data = await readFile(this.dataPath, 'utf8');
            this.users = new Map(Object.entries(JSON.parse(data)));
        } catch {
            this.users = new Map();
        }
    }

    async save() {
        await writeFile(this.dataPath, JSON.stringify(Object.fromEntries(this.users), null, 2));
    }

    getUser = (id) => {
        if (!this.users.has(id)) {
            this.users.set(id, {
                coins: 0,
                voucher: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastKolo: 0
            });
        }
        return this.users.get(id);
    }

    addCoins = async (userId, amount) => {
        const user = this.getUser(userId);
        user.coins += amount;
        await this.save();
        return user.coins;
    }

    removeCoins = async (userId, amount) => {
        const user = this.getUser(userId);
        user.coins = Math.max(user.coins - amount, 0);
        await this.save();
        return user.coins;
    }

    getRemainingTime = (lastUsed, cooldown) => {
        const remaining = cooldown - (Date.now() - lastUsed);
        return {
            days: Math.floor(remaining / 86400000),
            hours: Math.floor((remaining % 86400000) / 3600000),
            minutes: Math.floor((remaining % 3600000) / 60000)
        };
    }

    createCooldownEmbed = (title, time) => {
        const { days, hours, minutes } = time;
        let desc = 'Musíš počkat ';
        if (days > 0) desc += `${days}d `;
        if (hours > 0) desc += `${hours}h `;
        if (minutes > 0) desc += `${minutes}m`;

        return new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`⏰ ${title} Cooldown`)
            .setDescription(desc)
            .setTimestamp();
    }

    createRewardEmbed = (title, reward, balance, emoji) => {
        return new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle(`${emoji} ${title} Reward`)
            .setDescription(`Získal jsi **${reward.toLocaleString()}** coinů!`)
            .addFields({
                name: '💰 Balance',
                value: `${balance.toLocaleString()} coinů`,
                inline: true
            })
            .setTimestamp();
    }

    // ===== ZÁKLADNÍ FUNKCE =====
    
    daily = async (userId) => {
        const user = this.getUser(userId);
        const now = Date.now();

        if (now - user.lastDaily < this.cooldowns.daily) {
            const time = this.getRemainingTime(user.lastDaily, this.cooldowns.daily);
            return {
                success: false,
                embed: this.createCooldownEmbed('Daily', time)
            };
        }

        const reward = Math.floor(Math.random() * 400) + 200;
        user.coins += reward;
        user.lastDaily = now;
        await this.save();

        return {
            success: true,
            embed: this.createRewardEmbed('Daily', reward, user.coins, '🎁'),
            coins: reward
        };
    }

    weekly = async (userId) => {
        const user = this.getUser(userId);
        const now = Date.now();

        if (now - user.lastWeekly < this.cooldowns.weekly) {
            const time = this.getRemainingTime(user.lastWeekly, this.cooldowns.weekly);
            return {
                success: false,
                embed: this.createCooldownEmbed('Weekly', time)
            };
        }

        const reward = Math.floor(Math.random() * 1500) + 1000;
        user.coins += reward;
        user.lastWeekly = now;
        await this.save();

        return {
            success: true,
            embed: this.createRewardEmbed('Weekly', reward, user.coins, '📦'),
            coins: reward
        };
    }

    kolo = async (userId, member) => {
        const user = this.getUser(userId);
        const now = Date.now();
        const bet = 150;

        if (now - user.lastKolo < this.cooldowns.kolo) {
            const time = this.getRemainingTime(user.lastKolo, this.cooldowns.kolo);
            return {
                success: false,
                embed: this.createCooldownEmbed('Kolo', time)
            };
        }

        if (user.coins < bet) {
            return {
                success: false,
                embed: new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Nedostatek coinů')
                    .setDescription(`Potřebuješ alespoň **${bet}** ZCOINŮ k zatočení!`)
                    .addFields({ name: '💰 Tvé ZCOINY', value: `${user.coins.toLocaleString()} ZCOINŮ` })
            };
        }

        user.coins -= bet;
        user.lastKolo = now;

        const chance = Math.random();
        let resultText = '', reward = 0, color = '#F1C40F', emoji = '🎰';

        if (chance < 0.01) {
            resultText = 'Vyhrál jsi **Premium VIP!** 💎';
            await member.roles.add('1342414879151230997').catch(() => {});
            color = '#9B59B6';
            emoji = '💎';
        } else if (chance < 0.02) {
            resultText = 'Vyhrál jsi **Starter VIP!** 🎁';
            await member.roles.add('1380259944133038151').catch(() => {});
            color = '#2ECC71';
            emoji = '🎁';
        } else if (chance < 0.25) {
            reward = 75;
            resultText = 'Vyhrál jsi **75 ZCOINŮ**!';
            emoji = '🔸';
        } else if (chance < 0.65) {
            reward = 150;
            resultText = 'Získal jsi zpět **150 ZCOINŮ**.';
            emoji = '🟡';
        } else {
            reward = 250;
            resultText = 'Vyhrál jsi **250 ZCOINŮ**!';
            emoji = '🟢';
        }

        user.coins += reward;
        await this.save();

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${emoji} Kolo štěstí`)
            .setDescription(resultText)
            .addFields({ name: '💰 Zůstatek', value: `${user.coins.toLocaleString()} ZCOINŮ` })
            .setTimestamp();

        return { success: true, embed, reward };
    }

    balance = async (userId) => {
        const user = this.getUser(userId);

        return new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('💰 Balance')
            .setDescription(`**${user.coins.toLocaleString()}** coinů`)
            .addFields({ name: '🎫 Vouchery', value: user.voucher.toString(), inline: true })
            .setTimestamp();
    }

    leaderboard = async (guild, limit = 10) => {
        const sorted = [...this.users.entries()]
            .sort(([, a], [, b]) => b.coins - a.coins)
            .slice(0, limit);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 Leaderboard')
            .setTimestamp();

        if (sorted.length === 0) {
            embed.setDescription('Žádní uživatelé v databázi!');
            return embed;
        }

        const description = await Promise.all(sorted.map(async ([id, user], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            let username = `<@${id}>`;

            try {
                const member = await guild.members.fetch(id);
                username = `@${member.user.username}`;
            } catch {
                username = `@unknown`;
            }

            return `${medal} ${username} - **${user.coins.toLocaleString()}** coinů`;
        }));

        embed.setDescription(description.join('\n'));
        return embed;
    }

    // ===== ADMIN FUNKCE =====

    // 🚀 LAUNCH EVENT - Animace rakety a rychlostní klikání
    launch = async (interaction) => {
        const channel = interaction.channel;
        
        if (this.activeEvents.has(`launch_${channel.id}`)) {
            return {
                success: false,
                embed: new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('🚀 Launch už běží!')
                    .setDescription('V tomto kanálu již probíhá Launch event!')
            };
        }

        this.activeEvents.add(`launch_${channel.id}`);
        
        // Animace odpočítávání
        const countdownEmbed = new EmbedBuilder()
            .setColor('#F39C12')
            .setTitle('🚀 SPACE LAUNCH INICIACE')
            .setDescription('```\n🚀 Připravuji raketu k odpálení...\n```')
            .addFields({ 
                name: '📡 Lore', 
                value: 'ZikyZone vesmírná agentura spouští misi k získání vzácných ZCOINŮ z vesmírných asteroidů!' 
            });

        await interaction.editReply({ embeds: [countdownEmbed] });
        
        // Odpočítávání 3, 2, 1
        for (let i = 3; i > 0; i--) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            countdownEmbed.setDescription(`\`\`\`\n🚀 ${i}... ODPÁLENÍ ZA ${i} SEKUND!\n\`\`\``);
            await interaction.editReply({ embeds: [countdownEmbed] });
        }
        
        // Launch!
        const launchEmbed = new EmbedBuilder()
            .setColor('#E67E22')
            .setTitle('🚀 RAKETA VYPUŠTĚNA!')
            .setDescription(`\`\`\`\n        🚀\n       /|\\\n      / | \\\n     🔥🔥🔥\n\`\`\`\n**Raketa letí k asteroidům!**\nPrvní pilot který se přihlásí získá ZCOINY!`)
            .addFields({ 
                name: '⚡ Akce', 
                value: 'Klikni na tlačítko co nejrychleji!' 
            });

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('launch_claim')
                    .setLabel('🚀 Pilotovat raketu!')
                    .setStyle(ButtonStyle.Primary)
            );

        const msg = await interaction.editReply({ embeds: [launchEmbed], components: [button] });
        
        // Čekání na první klik
        const filter = i => i.customId === 'launch_claim';
        const collector = msg.createMessageComponentCollector({ filter, time: 30000 });
        
        let winner = null;
        
        collector.on('collect', async (buttonInt) => {
            if (!winner) {
                winner = buttonInt.user.id;
                const reward = Math.floor(Math.random() * 300) + 200; // 200-500 coinů
                
                await this.addCoins(winner, reward);
                
                const winEmbed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🎉 MISE ÚSPĚŠNÁ!')
                    .setDescription(`<@${winner}> se stal/a prvním pilotem a získal/a **${reward.toLocaleString()} ZCOINŮ** z vesmírných asteroidů!`)
                    .addFields({ 
                        name: '🌟 Lore', 
                        value: `Pilot ${buttonInt.user.username} úspěšně doletěl k asteroidovému poli a vytěžil vzácné ZCOINY!` 
                    })
                    .setTimestamp();
                
                await msg.edit({ embeds: [winEmbed], components: [] });
                collector.stop();
            }
            
            await buttonInt.deferUpdate();
        });

        collector.on('end', () => {
            this.activeEvents.delete(`launch_${channel.id}`);
            if (!winner) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#95A5A6')
                    .setTitle('🚀 Mise zrušena')
                    .setDescription('Nikdo se nepřihlásil jako pilot. Raketa se vrátila na základnu.')
                    .addFields({ 
                        name: '📡 Lore', 
                        value: 'Vesmírná mise byla zrušena kvůli nedostatku pilotů.' 
                    });
                
                msg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });

        return { success: true };
    }

    // 👻 GHOST EVENT - Duch krade a dává coiny
    ghost = async (interaction) => {
        const guild = interaction.guild;
        const ghostUser = interaction.user.id;
        
        // Ghost získá 50-150 coinů
        const ghostReward = Math.floor(Math.random() * 100) + 50;
        await this.addCoins(ghostUser, ghostReward);
        
        // Získej všechny členy s coiny
        const eligibleUsers = [...this.users.entries()]
            .filter(([id, user]) => id !== ghostUser && user.coins > 0)
            .map(([id]) => id);
        
        if (eligibleUsers.length < 10) {
            return {
                success: false,
                embed: new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('👻 Nedostatek obětí!')
                    .setDescription('Na serveru není dostatek lidí s coiny pro Ghost event!')
            };
        }
        
        // Náhodně vyber 10 lidí
        const victims = [];
        const winners = [];
        
        for (let i = 0; i < 10; i++) {
            const randomIndex = Math.floor(Math.random() * eligibleUsers.length);
            const victimId = eligibleUsers.splice(randomIndex, 1)[0];
            
            const chance = Math.random();
            if (chance < 0.4) {
                // 40% šance - ztratí 3 coiny
                await this.removeCoins(victimId, 3);
                victims.push(victimId);
            } else {
                // 60% šance - získá 5 coinů
                await this.addCoins(victimId, 5);
                winners.push(victimId);
            }
        }
        
        const ghostEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('👻 DUCH SE ZJEVIL!')
            .setDescription(`<@${ghostUser}> se stal duchem a získal **${ghostReward} ZCOINŮ**!`)
            .addFields(
                {
                    name: '😈 Oběti duchovi (-3 ZCOINY)',
                    value: victims.length > 0 ? victims.map(id => `<@${id}>`).join(', ') : 'Nikdo',
                    inline: false
                },
                {
                    name: '✨ Duchovi pomocníci (+5 ZCOINŮ)',
                    value: winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'Nikdo',
                    inline: false
                },
                {
                    name: '🎭 Lore',
                    value: 'Mystický duch ZikyZone se zjevil a přerozdělil bohatství mezi obyvateli serveru!',
                    inline: false
                }
            )
            .setTimestamp();
        
        return { success: true, embed: ghostEmbed };
    }

    // ⚡ FAST EVENT - Kdo nenapíše, ztratí coiny
    fast = async (interaction) => {
        const channel = interaction.channel;
        
        if (this.fastEvents.has(channel.id)) {
            return {
                success: false,
                embed: new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('⚡ Fast už běží!')
                    .setDescription('V tomto kanálu již probíhá Fast event!')
            };
        }
        
        const participants = new Set();
        const startTime = Date.now();
        
        this.fastEvents.set(channel.id, {
            participants,
            startTime,
            active: true
        });
        
        const fastEmbed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('⚡ RYCHLOSTNÍ VÝZVA!')
            .setDescription('**Máš 60 sekund na napsání jakékoliv zprávy!**')
            .addFields(
                {
                    name: '💰 Odměny',
                    value: '• Napíšeš zprávu = +4 ZCOINY\n• Nenapíšeš zprávu = -2 ZCOINY',
                    inline: false
                },
                {
                    name: '⏰ Čas',
                    value: '60 sekund od teď!',
                    inline: true
                },
                {
                    name: '🏆 Lore',
                    value: 'Rychlostní test reflexů obyvatel ZikyZone! Kdo je nejrychlejší?',
                    inline: false
                }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [fastEmbed] });
        
        // Collector pro zprávy
        const messageFilter = (msg) => !msg.author.bot;
        const messageCollector = channel.createMessageCollector({ 
            filter: messageFilter, 
            time: 60000 
        });
        
        messageCollector.on('collect', (msg) => {
            participants.add(msg.author.id);
        });
        
        messageCollector.on('end', async () => {
            const event = this.fastEvents.get(channel.id);
            if (!event || !event.active) return;
            
            event.active = false;
            
            // Najdi všechny uživatele s coiny
            const allUsers = [...this.users.keys()];
            const winners = [...participants];
            const losers = allUsers.filter(id => !participants.has(id));
            
            // Odměň aktivní uživatele
            const rewardPromises = winners.map(id => this.addCoins(id, 4));
            await Promise.all(rewardPromises);
            
            // Potrestej neaktivní uživatele
            const penaltyPromises = losers.map(id => this.removeCoins(id, 2));
            await Promise.all(penaltyPromises);
            
            const resultEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('⚡ RYCHLOSTNÍ VÝZVA UKONČENA!')
                .setDescription(`**${winners.length}** hráčů napsalo zprávu včas!`)
                .addFields(
                    {
                        name: '🏆 Rychlí (+4 ZCOINY)',
                        value: winners.length > 0 ? 
                            (winners.length > 20 ? 
                                `${winners.slice(0, 20).map(id => `<@${id}>`).join(', ')}...\n*a ${winners.length - 20} dalších*` :
                                winners.map(id => `<@${id}>`).join(', ')
                            ) : 'Nikdo',
                        inline: false
                    },
                    {
                        name: '🐌 Pomalí (-2 ZCOINY)',
                        value: `${losers.length} uživatelů`,
                        inline: true
                    }
                )
                .setTimestamp();
            
            await interaction.followUp({ embeds: [resultEmbed] });
            
            this.fastEvents.delete(channel.id);
        });
        
        return { success: true };
    }

    // 🎁 GIVEALL - Dá všem uživatelům náhodné coiny
    giveAll = async (interaction, minCoins = 0, maxCoins = 5) => {
        if (minCoins < 0 || maxCoins < minCoins || maxCoins > 1000) {
            return {
                success: false,
                embed: new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('❌ Chybné parametry!')
                    .setDescription('Min: 0, Max: 1000, Min musí být <= Max')
            };
        }
        
        const allUsers = [...this.users.keys()];
        const rewards = new Map();
        let totalGiven = 0;
        
        // Dej každému náhodný počet coinů
        for (const userId of allUsers) {
            const reward = Math.floor(Math.random() * (maxCoins - minCoins + 1)) + minCoins;
            await this.addCoins(userId, reward);
            rewards.set(userId, reward);
            totalGiven += reward;
        }
        
        const giveAllEmbed = new EmbedBuilder()
            .setColor('#27AE60')
            .setTitle('🎁 MASIVNÍ DÁRKOVÁ AKCE!')
            .setDescription(`**${allUsers.length}** uživatelů dostalo dárky!`)
            .addFields(
                {
                    name: '💰 Rozsah odměn',
                    value: `${minCoins} - ${maxCoins} ZCOINŮ`,
                    inline: true
                },
                {
                    name: '🎯 Celkem rozdáno',
                    value: `${totalGiven.toLocaleString()} ZCOINŮ`,
                    inline: true
                },
                {
                    name: '📊 Počet příjemců',
                    value: `${allUsers.length} uživatelů`,
                    inline: true
                },
                {
                    name: '🌟 Lore',
                    value: 'Štědrost ZikyZone administrativa přinesla radost všem obyvatelům serveru!',
                    inline: false
                }
            )
            .setTimestamp();
        
        return { success: true, embed: giveAllEmbed, totalGiven, recipients: allUsers.length };
    }
}

module.exports = Economy;
