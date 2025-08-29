const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('⚙️ Systém soutěží (giveaway)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('🎉 Spustí novou soutěž')
                .addStringOption(option =>
                    option.setName('length')
                        .setDescription('Zadej délku soutěže (např. 1d, 1h, 1m, 1s)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('prize')
                        .setDescription('Nastav cenu, kterou lze vyhrát')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('winners')
                        .setDescription('Zadej počet vítězů')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Urči kanál, kam se má soutěž poslat')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('lucky_role_1')
                        .setDescription('První role, která má větší šanci na výhru')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('lucky_role_2')
                        .setDescription('Druhá role, která má větší šanci na výhru')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('lucky_role_3')
                        .setDescription('Třetí role, která má větší šanci na výhru')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('lucky_role_4')
                        .setDescription('Čtvrtá role, která má větší šanci na výhru')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('lucky_role_5')
                        .setDescription('Pátá role, která má větší šanci na výhru')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pause')
                .setDescription('⏸️ Pozastaví soutěž')
                .addStringOption(option =>
                    option.setName('message-id')
                        .setDescription('Zadej ID zprávy soutěže')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unpause')
                .setDescription('⏯️ Znovu spustí pozastavenou soutěž')
                .addStringOption(option =>
                    option.setName('message-id')
                        .setDescription('Zadej ID zprávy soutěže')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('⏹️ Ukončí soutěž')
                .addStringOption(option =>
                    option.setName('message-id')
                        .setDescription('Zadej ID zprávy soutěže')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reroll')
                .setDescription('🔃 Vybere nového vítěze soutěže')
                .addStringOption(option =>
                    option.setName('message-id')
                        .setDescription('Zadej ID zprávy soutěže')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('🚮 Smaže soutěž')
                .addStringOption(option =>
                    option.setName('message-id')
                        .setDescription('Zadej ID zprávy soutěže')
                        .setRequired(true)
                )
        ),
    
    giveawayManagerOnly: true,

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        const errorEmbed = new EmbedBuilder().setColor(0xFF3366);
        const successEmbed = new EmbedBuilder().setColor(0x00D4AA);

        const giveawayManager = client.giveawayManager;
        if (!giveawayManager) {
            console.error('GiveawayManager není inicializován na objektu klienta.');
            errorEmbed.setTitle('❌ **SYSTÉM NEDOSTUPNÝ**')
                        .setDescription(`Systém soutěží není správně inicializován!`);
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        switch (sub) {
            case 'start': {
                const gchannel = interaction.options.getChannel('channel') || interaction.channel;
                const durationString = interaction.options.getString('length');
                const winnerCount = interaction.options.getNumber('winners');
                const prize = interaction.options.getString('prize');
                const luckyRoles = [
                    interaction.options.getRole('lucky_role_1'),
                    interaction.options.getRole('lucky_role_2'),
                    interaction.options.getRole('lucky_role_3'),
                    interaction.options.getRole('lucky_role_4'),
                    interaction.options.getRole('lucky_role_5')
                ].filter(role => role !== null);
                
                const luckyRoleIds = luckyRoles.map(role => role.id);
                
                const duration = ms(durationString);
                if (isNaN(duration) || duration < 10000) {
                    errorEmbed.setTitle('❌ **CHYBA DÉLKY SOUTĚŽE**')
                                .setDescription(`Zadej správný formát délky: \`1d, 1h, 1m, 1s\` (min. 10s)`);
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                try {
                    await giveawayManager.start(gchannel, {
                        duration,
                        prize,
                        winnerCount,
                        hostedBy: interaction.user.id,
                        luckyRoleIds: luckyRoleIds.length > 0 ? luckyRoleIds : null
                    });

                    successEmbed.setTitle('🎉 **SOUTĚŽ SPUŠTĚNA**')
                                .setDescription(`Soutěž byla úspěšně spuštěna!\nV kanálu: ${gchannel}`);
                    return interaction.reply({ embeds: [successEmbed], ephemeral: true });
                } catch (err) {
                    console.error('Giveaway start error:', err);
                    errorEmbed.setTitle('❌ **CHYBA SPUŠTĚNÍ SOUTĚŽE**')
                                .setDescription(`Nepodařilo se spustit soutěž!\n\`${err.message}\``);
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            }

            case 'pause':
            case 'unpause':
            case 'end':
            case 'reroll':
            case 'delete': {
                const messageid = interaction.options.getString('message-id');

                try {
                    switch (sub) {
                        case 'pause':
                            await giveawayManager.pause(messageid, client.config.messages);
                            successEmbed.setTitle('⏸️ **SOUTĚŽ POZASTAVENA**')
                                        .setDescription(`Soutěž byla úspěšně pozastavena!`);
                            break;

                        case 'unpause':
                            await giveawayManager.unpause(messageid);
                            successEmbed.setTitle('▶️ **SOUTĚŽ OBNOVENA**')
                                        .setDescription(`Soutěž byla úspěšně obnovena!`);
                            break;

                        case 'end':
                            await giveawayManager.end(messageid);
                            successEmbed.setTitle('⏹️ **SOUTĚŽ UKONČENA**')
                                        .setDescription(`Soutěž byla úspěšně ukončena!`);
                            break;

                        case 'reroll':
                            await giveawayManager.reroll(messageid);
                            successEmbed.setTitle('🎉 **NOVÝ VÍTĚZ**')
                                        .setDescription(`Soutěž má nového vítěza!`);
                            break;

                        case 'delete':
                            await giveawayManager.delete(messageid);
                            successEmbed.setTitle('🚮 **SOUTĚŽ SMAZÁNA**')
                                        .setDescription(`Soutěž byla úspěšně smazána!`);
                            break;
                    }
                    return interaction.reply({ embeds: [successEmbed], ephemeral: true });
                } catch (err) {
                    console.error(`Giveaway ${sub} error:`, err);
                    errorEmbed.setTitle(`❌ **CHYBA ${sub.toUpperCase()} SOUTĚŽE**`)
                                .setDescription(`Nepodařilo se provést akci!\n\`${err.message}\``);
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
            }
        }
    }
};
