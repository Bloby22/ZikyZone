const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Economy = require('../manager/economy');

const economy = new Economy();
economy.init();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Zobrazí tvůj nebo cizí coin balance')
        .addUserOption(option =>
            option.setName('user')
                  .setDescription('Uživatel, jehož balance chceš zobrazit')
                  .setRequired(false)
        ),
    
    async execute(interaction) {
        try {
            const target = interaction.options.getUser('user') || interaction.user;
            const userData = economy.getUser(target.id);
            const isOwnBalance = target.id === interaction.user.id;
            
            const embed = new EmbedBuilder()
                .setColor(0x00D4AA)
                .setTitle(`💎 **${isOwnBalance ? 'TVŮJ BALANCE' : target.username.toUpperCase() + ' BALANCE'}**`)
                .setDescription(`
                    ╭─────────────────────────────╮
                    │  **Celkové coiny:**              │
                    │  \`${userData.coins?.toLocaleString() || '0'}\` 💰 ZCOINů      │
                    ╰─────────────────────────────╯
                `)
                .addFields(
                    { 
                        name: '🎫 **VOUCHERY**', 
                        value: `\`\`\`yaml\n${userData.voucher || 0} kusů\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: '🗓️ **POSLEDNÍ DAILY**', 
                        value: userData.lastDaily ? `<t:${Math.floor(userData.lastDaily / 1000)}:R>` : '```diff\n- Ještě nevybráno```', 
                        inline: true 
                    },
                    { 
                        name: '📅 **POSLEDNÍ WEEKLY**', 
                        value: userData.lastWeekly ? `<t:${Math.floor(userData.lastWeekly / 1000)}:R>` : '```diff\n- Ještě nevybráno```', 
                        inline: true 
                    },
                    {
                        name: '📊 **STATISTIKY**',
                        value: `\`\`\`fix\n💸 Celkem utraceno: ${userData.totalSpent?.toLocaleString() || '0'} ZC\n🎯 Daily streak: ${userData.dailyStreak || 0} dní\`\`\``,
                        inline: false
                    }
                )
                .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ 
                    text: `${isOwnBalance ? 'Tvoje peněženka' : target.username + ' peněženka'} • ZikyZone`, 
                    iconURL: target.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Balance command error:', error);
            
            const error = new EmbedBuilder()
                .setColor(0xFF3366)
                .setTitle('❌ **BALANCE ERROR**')
                .setDescription(`
                    ╭─────────────────────────────╮
                    │  Nepodařilo se načíst balance!   │
                    │  Zkus to znovu za chvilku        │
                    ╰─────────────────────────────╯
                `)
                .setFooter({ text: 'ZikyZone', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [error], ephemeral: true });
        }
    }
};
