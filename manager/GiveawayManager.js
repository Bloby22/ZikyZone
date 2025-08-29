const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const ms = require('ms');
require('colors');
const Giveaway = require('../schemas/Giveaway');

class GiveawayManager {
    constructor(client, options = {}) {
        this.client = client;
        this.options = options;
        this.giveaways = new Collection();
        this.interval = null;
    }

    async init() {
        console.log('[GIVEAWAY_MANAGER]'.cyan + ' Inicializace...');
        try {
            const activeGiveaways = await Giveaway.find({ hasEnded: false, paused: false });
            for (const gw of activeGiveaways) {
                this.giveaways.set(gw.messageId, gw);
                this.scheduleGiveawayEnd(gw);
            }
            console.log('[GIVEAWAY_MANAGER]'.cyan + ` Načteno ${this.giveaways.size} aktivních soutěží.`);

            this.interval = setInterval(() => this.checkGiveaways(), 5000);

            this.client.on('interactionCreate', interaction => this.handleButtonInteraction(interaction));

        } catch (error) {
            console.error('[GIVEAWAY_MANAGER_ERROR]'.red + ` Chyba při inicializaci: ${error.message}`);
        }
    }

    _parseMessageId(input) {
        const parts = input.split('-');
        if (parts.length === 2 && !isNaN(parts[1])) {
            return parts[1];
        }
        return input;
    }

    async start(channel, { duration, prize, winnerCount, hostedBy, luckyRoleIds = [] }) {
        const endTime = new Date(Date.now() + duration);
        const giveawayEmbed = new EmbedBuilder()
            .setColor(0x00D4AA)
            .setTitle(`🎉 **${prize}**`)
            .setDescription(
                `Klikni na tlačítko pro účast!\n` +
                `Vítězů: **${winnerCount}**\n` +
                `Účastníků: **0**\n` +
                `Končí: <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
                (luckyRoleIds && luckyRoleIds.length > 0 ? `Role s větší šancí: ${luckyRoleIds.map(id => `<@&${id}>`).join(', ')}\n` : '') +
                `Hostitel: <@${hostedBy}>`
            )
            .setFooter({ text: this.options.messages.hostedBy || `Soutěž od ${hostedBy}`, iconURL: this.client.user.displayAvatarURL() })
            .setTimestamp(endTime);

        const joinButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_join')
                .setLabel('Zúčastnit se')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎁')
        );

        try {
            const giveawayMessage = await channel.send({ embeds: [giveawayEmbed], components: [joinButton] });

            const newGiveaway = await Giveaway.create({
                messageId: giveawayMessage.id,
                channelId: channel.id,
                guildId: channel.guild.id,
                prize,
                winnerCount,
                endTime,
                hostedBy,
                luckyRoleIds,
                participants: []
            });

            this.giveaways.set(newGiveaway.messageId, newGiveaway);
            this.scheduleGiveawayEnd(newGiveaway);

            return newGiveaway;
        } catch (error) {
            console.error('[GIVEAWAY_MANAGER_ERROR]'.red + ` Chyba při spuštění soutěže: ${error.message}`);
            throw new Error(`Nepodařilo se spustit soutěž: ${error.message}`);
        }
    }

    async pause(rawMessageId, { content, infiniteDurationText }) {
        const messageId = this._parseMessageId(rawMessageId);
        const giveaway = this.giveaways.get(messageId) || await Giveaway.findOne({ messageId });
        if (!giveaway) throw new Error('Soutěž nebyla nalezena.');
        if (giveaway.paused) throw new Error('Soutěž je již pozastavena.');

        giveaway.paused = true;
        await giveaway.save();
        this.giveaways.set(messageId, giveaway);

        const channel = this.client.channels.cache.get(giveaway.channelId);
        if (!channel) throw new Error('Kanál soutěže nebyl nalezen.');

        const message = await channel.messages.fetch(messageId);
        if (!message) throw new Error('Zpráva soutěže nebyla nalezena.');

        const embed = EmbedBuilder.from(message.embeds[0])
            .setDescription(
                `**SOUTĚŽ POZASTAVENA**\n` +
                `Vítězů: **${giveaway.winnerCount}**\n` +
                `Účastníků: **${giveaway.participants.length}**\n` +
                `${content || ''}\n${infiniteDurationText || ''}\n` +
                `Hostitel: <@${giveaway.hostedBy}>`
            );

        const joinButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_join')
                .setLabel('Zúčastnit se')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏸️')
                .setDisabled(true)
        );

        await message.edit({ embeds: [embed], components: [joinButton] });
    }

    async unpause(rawMessageId) {
        const messageId = this._parseMessageId(rawMessageId);
        const giveaway = this.giveaways.get(messageId) || await Giveaway.findOne({ messageId });
        if (!giveaway) throw new Error('Soutěž nebyla nalezena.');
        if (!giveaway.paused) throw new Error('Soutěž není pozastavena.');

        giveaway.paused = false;
        await giveaway.save();
        this.giveaways.set(messageId, giveaway);

        const channel = this.client.channels.cache.get(giveaway.channelId);
        if (!channel) throw new Error('Kanál soutěže nebyl nalezen.');

        const message = await channel.messages.fetch(messageId);
        if (!message) throw new Error('Zpráva soutěže nebyla nalezena.');

        const embed = EmbedBuilder.from(message.embeds[0])
            .setDescription(
                `Klikni na tlačítko pro účast!\n` +
                `Vítězů: **${giveaway.winnerCount}**\n` +
                `Účastníků: **${giveaway.participants.length}**\n` +
                `Končí: <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n` +
                (giveaway.luckyRoleIds && giveaway.luckyRoleIds.length > 0 ? `Role s větší šancí: ${giveaway.luckyRoleIds.map(id => `<@&${id}>`).join(', ')}\n` : '') +
                `Hostitel: <@${giveaway.hostedBy}>`
            );

        const joinButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_join')
                .setLabel('Zúčastnit se')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎁')
                .setDisabled(false)
        );

        await message.edit({ embeds: [embed], components: [joinButton] });
        this.scheduleGiveawayEnd(giveaway);
    }

    async end(rawMessageId) {
        const messageId = this._parseMessageId(rawMessageId);
        let giveaway = this.giveaways.get(messageId) || await Giveaway.findOne({ messageId });
        if (!giveaway) throw new Error('Soutěž nebyla nalezena.');
        if (giveaway.hasEnded) throw new Error('Soutěž již byla ukončena.');

        giveaway.hasEnded = true;
        giveaway.paused = false;
        await giveaway.save();
        this.giveaways.delete(messageId);

        await this._selectAndAnnounceWinners(giveaway);
    }

    async reroll(rawMessageId) {
        const messageId = this._parseMessageId(rawMessageId);
        let giveaway = await Giveaway.findOne({ messageId });
        if (!giveaway) throw new Error('Soutěž nebyla nalezena.');
        if (!giveaway.hasEnded) throw new Error('Soutěž ještě nebyla ukončena.');

        await this._selectAndAnnounceWinners(giveaway, true);
    }

    async delete(rawMessageId) {
        const messageId = this._parseMessageId(rawMessageId);
        const giveaway = this.giveaways.get(messageId) || await Giveaway.findOne({ messageId });
        if (!giveaway) throw new Error('Soutěž nebyla nalezena.');

        await Giveaway.deleteOne({ messageId });
        this.giveaways.delete(messageId);

        const channel = this.client.channels.cache.get(giveaway.channelId);
        if (channel) {
            try {
                const message = await channel.messages.fetch(messageId);
                await message.delete();
            } catch (error) {
                console.warn('[GIVEAWAY_MANAGER_WARN]'.yellow + ` Nepodařilo se smazat zprávu soutěže ${messageId}. Možná již byla smazána.`);
            }
        }
    }

    async handleButtonInteraction(interaction) {
        if (!interaction.isButton() || !interaction.customId.startsWith('giveaway_')) return;

        const giveaway = this.giveaways.get(interaction.message.id) || await Giveaway.findOne({ messageId: interaction.message.id });

        if (!giveaway) {
            return interaction.reply({
                content: this.options.messages.giveawayNotFound || 'Tato soutěž již neexistuje.',
                ephemeral: true
            });
        }

        if (giveaway.hasEnded) {
            return interaction.reply({
                content: this.options.messages.giveawayEnded || 'Tato soutěž se již skončila!',
                ephemeral: true
            });
        }
        
        if (giveaway.paused) {
            return interaction.reply({
                content: this.options.messages.giveawayPaused || 'Tato soutěž je momentálně pozastavena!',
                ephemeral: true
            });
        }

        const isJoining = !giveaway.participants.includes(interaction.user.id);

        if (isJoining) {
            giveaway.participants.push(interaction.user.id);
            await giveaway.save();
            this.giveaways.set(giveaway.messageId, giveaway);
            await interaction.reply({
                content: this.options.messages.joined || 'Úspěšně ses zúčastnil soutěže!',
                ephemeral: true
            });
        } else {
            giveaway.participants = giveaway.participants.filter(id => id !== interaction.user.id);
            await giveaway.save();
            this.giveaways.set(giveaway.messageId, giveaway);
            await interaction.reply({
                content: this.options.messages.unjoined || 'Úspěšně jsi opustil soutěž!',
                ephemeral: true
            });
        }

        const channel = this.client.channels.cache.get(giveaway.channelId);
        if (channel) {
            const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
            if (message) {
                const embed = EmbedBuilder.from(message.embeds[0])
                    .setDescription(
                        `Klikni na tlačítko pro účast!\n` +
                        `Vítězů: **${giveaway.winnerCount}**\n` +
                        `Účastníků: **${giveaway.participants.length}**\n` +
                        `Končí: <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n` +
                        (giveaway.luckyRoleIds && giveaway.luckyRoleIds.length > 0 ? `Role s větší šancí: ${giveaway.luckyRoleIds.map(id => `<@&${id}>`).join(', ')}\n` : '') +
                        `Hostitel: <@${giveaway.hostedBy}>`
                    );
                await message.edit({ embeds: [embed], components: message.components });
            }
        }
    }

    async _selectAndAnnounceWinners(giveaway, isReroll = false) {
        const channel = this.client.channels.cache.get(giveaway.channelId);
        if (!channel) {
            console.error('[GIVEAWAY_MANAGER_ERROR]'.red + ` Kanál ${giveaway.channelId} nebyl nalezen pro soutěž ${giveaway.messageId}.`);
            await Giveaway.deleteOne({ messageId: giveaway.messageId });
            this.giveaways.delete(giveaway.messageId);
            return;
        }

        const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (!message) {
            console.error('[GIVEAWAY_MANAGER_ERROR]'.red + ` Zpráva ${giveaway.messageId} nebyla nalezena v kanálu ${giveaway.channelId}.`);
            await Giveaway.deleteOne({ messageId: giveaway.messageId });
            this.giveaways.delete(giveaway.messageId);
            return;
        }

        const guild = this.client.guilds.cache.get(giveaway.guildId);
        await guild.members.fetch();

        let eligibleParticipants = [];
        for (const userId of giveaway.participants) {
            const member = guild.members.cache.get(userId);
            if (member) {
                eligibleParticipants.push(userId);
            }
        }

        if (eligibleParticipants.length === 0 || eligibleParticipants.length < giveaway.winnerCount) {
            const noWinnersEmbed = new EmbedBuilder()
                .setColor(0xFF3366)
                .setTitle(`🛑 **${giveaway.prize}**`)
                .setDescription(
                    (this.options.messages.noWinners || 'Není dostatek účastníků pro tuto soutěž.') +
                    `\nFinální počet účastníků: **${giveaway.participants.length}**`
                )
                .setFooter({ text: 'Soutěž skončila', iconURL: this.client.user.displayAvatarURL() })
                .setTimestamp(new Date());

            const endedButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_ended')
                    .setLabel('Ukončeno')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
            );

            await message.edit({ embeds: [noWinnersEmbed], components: [endedButton] });
            if (!isReroll) {
                giveaway.hasEnded = true;
                giveaway.winners = [];
                await giveaway.save();
            }
            return channel.send({ content: this.options.messages.noWinnersAnnounce || 'Lituji, v této soutěži nebylo dostatek účastníků pro výběr vítěze.' });
        }

        let potentialWinnersPool = [...eligibleParticipants];
        const luckyRoleWeight = this.options.giveawayManager.luckyRoleWeight || 2;
        
        for (const userId of eligibleParticipants) {
            const member = guild.members.cache.get(userId);
            if (member && giveaway.luckyRoleIds && giveaway.luckyRoleIds.some(roleId => member.roles.cache.has(roleId))) {
                for (let i = 0; i < luckyRoleWeight - 1; i++) {
                    potentialWinnersPool.push(userId);
                }
            }
        }
        
        let selectedWinners = [];
        const uniqueParticipants = [...new Set(potentialWinnersPool)];

        for (let i = 0; i < giveaway.winnerCount && uniqueParticipants.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * uniqueParticipants.length);
            const winnerId = uniqueParticipants[randomIndex];
            selectedWinners.push(winnerId);
            uniqueParticipants.splice(randomIndex, 1);
        }

        giveaway.winners = selectedWinners;
        giveaway.hasEnded = true;
        await giveaway.save();

        const winnerMentions = selectedWinners.map(id => `<@${id}>`).join(', ');
        const endEmbed = new EmbedBuilder()
            .setColor(0x00D4AA)
            .setTitle(`🎉 **${giveaway.prize}**`)
            .setDescription(
                `${isReroll ? '**REROLL!** Noví vítězové jsou: ' : 'Gratuluji! Vítězové jsou: '}${winnerMentions}\n` +
                `Finální počet účastníků: **${giveaway.participants.length}**\n` +
                `Původně hostil: <@${giveaway.hostedBy}>`
            )
            .setFooter({ text: 'Soutěž skončila', iconURL: this.client.user.displayAvatarURL() })
            .setTimestamp(new Date());

        const endedButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_ended')
                .setLabel('Ukončeno')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
        );

        const formatMessage = (messageTemplate, winners, prize) => {
            return messageTemplate
                .replace(/{winners}/g, winners)
                .replace(/{prize}/g, prize);
        };

        await message.edit({ embeds: [endEmbed], components: [endedButton] });
        await channel.send({
            content: isReroll
                ? formatMessage(this.options.messages.rerollAnnounce || `🎉 Noví vítězové pro **{prize}** jsou {winners}! Gratuluji!`, winnerMentions, giveaway.prize)
                : formatMessage(this.options.messages.endAnnounce || `🎉 Gratuluji {winners}, vyhrál(a) jsi **{prize}**!`, winnerMentions, giveaway.prize),
            allowedMentions: { users: selectedWinners }
        });
    }

    scheduleGiveawayEnd(giveaway) {
        const timeUntilEnd = giveaway.endTime.getTime() - Date.now();
        if (timeUntilEnd <= 0) {
            this.checkGiveaways();
            return;
        }

        setTimeout(() => {
            const currentGiveaway = this.giveaways.get(giveaway.messageId);
            if (currentGiveaway && !currentGiveaway.paused && !currentGiveaway.hasEnded) {
                this.end(giveaway.messageId).catch(err => console.error('[GIVEAWAY_MANAGER_ERROR]'.red + ` Chyba při automatickém ukončování soutěže: ${err.message}`));
            }
        }, timeUntilEnd);
    }

    async checkGiveaways() {
        for (const [messageId, giveaway] of this.giveaways) {
            if (!giveaway.paused && !giveaway.hasEnded && giveaway.endTime.getTime() <= Date.now()) {
                await this.end(messageId);
            }
        }
    }
}

module.exports = GiveawayManager;
