const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Economy = require('../manager/economy');

const economy = new Economy();
economy.init();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Získáš svůj denní reward coinů!'),
    
    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const result = await economy.daily(userId);
            
            if (!result.success) {
                const timeLeft = result.timeLeft || result.cooldown || result.time_left || result.zbyvajici_cas || result.next_daily || 'Neznámá doba';
                
                const cooldownEmbed = new EmbedBuilder()
                    .setColor('#2C2F33')
                    .setTitle('⏰ DAILY COOLDOWN')
                    .setDescription(`
\`\`\`
╔═══════════════════════════════╗
║         DAILY REWARD          ║
║     Už sis dnes vybral!       ║
║                               ║
║  ⏱️  Další za: ${timeLeft.padEnd(12)} ║
║  💡  Tip: Denní streak = více ║
║      coinů!                   ║
╚═══════════════════════════════╝
\`\`\`
                    `)
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 512 }))
                    .setFooter({ 
                        text: `${interaction.user.username} • ZikyZone`, 
                        iconURL: interaction.client.user.displayAvatarURL() 
                    })
                    .setTimestamp();
                
                return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
            }

            const coinsEarned = result.coins || result.coin_earned || result.amount || result.nova_castka || 0;
            const newBalance = result.balance || result.newBalance || result.new_balance || result.nova_castka || result.total_balance || 0;
            const streak = result.streak || result.denni_streak || result.daily_streak || 1;

            const successEmbed = new EmbedBuilder()
                .setColor('#00D4AA')
                .setTitle('🎁 DAILY REWARD CLAIMED')
                .setDescription(`
\`\`\`
╔═══════════════════════════════╗
║        DAILY ÚSPĚŠNÝ!         ║
║                               ║
║  💰 Získané coiny:            ║
║      ${coinsEarned.toLocaleString().padEnd(20)} ║
║                               ║
║  💳 Nový balance:             ║
║      ${newBalance.toLocaleString().padEnd(20)} ║
║                               ║
║  🔥 Streak: ${streak.toString().padEnd(16)} ║
║  ⏰ Další za: 24 hodin        ║
║                               ║
║  💡 Sbírej každý den pro      ║
║     větší odměny!             ║
╚═══════════════════════════════╝
\`\`\`
                    `)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .setFooter({ 
                    text: `${interaction.user.username} • Daily #${streak}`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            return interaction.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Daily command error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF3366')
                .setTitle('❌ SYSTEM ERROR')
                .setDescription(`
\`\`\`
╔═══════════════════════════════╗
║           CHYBA!              ║
║                               ║
║  ⚠️  Něco se pokazilo!        ║
║      Zkus to znovu za         ║
║      chvilku...               ║
║                               ║
║  📞 Pokud problém přetrvává,  ║
║     kontaktuj adminy!         ║
╚═══════════════════════════════╝
\`\`\`
                `)
                .setFooter({ 
                    text: 'ZikyZone System', 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};
