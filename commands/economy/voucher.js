const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const VOUCHERS = {
	test: 100
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voucher')
        .setDescription('Použij voucher pro získání ZCOINŮ!')
        .addStringOption(option =>
            option.setName('kod')
                .setDescription('Kód voucheru')
                .setRequired(true)),

    async execute(interaction) {
        const voucherCode = interaction.options.getString('kod').toLowerCase();
        const userId = interaction.user.id;
        
        const voucherValue = VOUCHERS[voucherCode];
        
        if (!voucherValue) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Neplatný voucher!')
                .setDescription(`Voucher kód \`${voucherCode}\` neexistuje nebo je neplatný.`)
                .setTimestamp();
            
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const economy = interaction.client.economy;
        
        if (!economy) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Systém nedostupný!')
                .setDescription('Economy systém není momentálně dostupný.')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        await economy.addCoins(userId, voucherValue);
        const user = economy.getUser(userId);

        const successEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle(`🎫 Voucher uplatněn!`)
            .setDescription(`\`\`\`
╔══════════════════════════════╗
║        VOUCHER ÚSPĚŠNĚ       ║
║══════════════════════════════║
║  Kód: ${voucherCode.toUpperCase().padEnd(23)} ║
║                              ║
║  💰 Získané ZCOINY: ${voucherValue.toString().padStart(4)}     ║
║  🏦 Nový zůstatek: ${user.coins.toString().padStart(6)}      ║
║                              ║
║  ✅ Voucher byl úspěšně      ║
║     aktivován!               ║
╚══════════════════════════════╝
\`\`\``)
            .setFooter({ text: `Voucher kód: ${voucherCode}` })
            .setTimestamp();

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    }
};
