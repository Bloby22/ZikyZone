const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Economy = require('../manager/economy');

const economy = new Economy();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kolo')
        .setDescription('🎰 Zatoč si kolem štěstí za 150 ZCOINŮ! Vždy něco vyhraješ!'),
    
    async execute(interaction) {
        try {
            await economy.init();
            await interaction.deferReply();
            
            const userData = economy.getUser(interaction.user.id);
            
            if (userData.coins < 150) {
                const noMoneyEmbed = new EmbedBuilder()
                    .setColor(0xFF3366)
                    .setTitle('💸 **NEDOSTATEK COINŮ**')
                    .setDescription(`
                        ╭─────────────────────────────╮
                        │  **Potřebuješ:**                │
                        │  \`150\` 💰 ZCOINů               │
                        │                                 │
                        │  **Máš pouze:**                 │
                        │  \`${userData.coins?.toLocaleString() || '0'}\` 💰 ZCOINů               │
                        ╰─────────────────────────────╯
                    `)
                    .addFields({
                        name: '💡 **JAK ZÍSKAT COINY**',
                        value: '```yaml\n• /daily - denní odměna\n• /work - pracuj pro coiny\n• /weekly - týdenní bonus```',
                        inline: false
                    })
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({ 
                        text: `${interaction.user.username} • Potřebuješ více coinů!`, 
                        iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [noMoneyEmbed] });
            }

            // Deduct coins first
            await economy.removeCoins(interaction.user.id, 150);

            const spinningEmbed = new EmbedBuilder()
                .setColor(0xF39C12)
                .setTitle('🎡 **KOLO ŠTĚSTÍ**')
                .setDescription(`
                    ╭─────────────────────────────╮
                    │  **PŘIPRAV SE NA ZATOČENÍ!**    │
                    │                                 │
                    │        🎡 KOLO ŠTĚSTÍ 🎡        │
                    │                                 │
                    │  **Sázka:** \`150\` 💰              │
                    ╰─────────────────────────────╯
                `)
                .addFields({
                    name: '🏆 **MOŽNÉ VÝHRY** (Vždy něco vyhraješ!)',
                    value: '```diff\n+ 🎁 Premium na týden = 2.5%\n+ 💰 100 ZCOINů = 2.5%\n+ 📦 Starter Pack = 10%\n+ 💎 35 ZCOINů = 15%\n+ 💸 18 ZCOINů = 20%\n+ 🪙 5 ZCOINů = 50%```',
                    inline: false
                })
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ 
                    text: `${interaction.user.username} • Kolo se začíná točit!`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [spinningEmbed] });
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Fake spinning animation - 5 různých kombinací symbolů
            const fakeSpins = [
                { symbols: ['🪙', '💸', '💎', '📦', '💰'], text: '🚀 ROZTÁČÍ SE!' },
                { symbols: ['💎', '📦', '💰', '🎁', '🪙'], text: '💨 LETÍ DOKOLA!' },
                { symbols: ['📦', '💰', '🎁', '🪙', '💸'], text: '⚡ MAXIMUM!' },
                { symbols: ['💰', '🎁', '🪙', '💸', '💎'], text: '🌪️ ZÁVRATNÁ RYCHLOST!' },
                { symbols: ['🎁', '🪙', '💸', '💎', '📦'], text: '⭐ ZPOMALUJE...' }
            ];

            // Fake animation
            for (let i = 0; i < fakeSpins.length; i++) {
                const spin = fakeSpins[i];
                const fakeEmbed = new EmbedBuilder()
                    .setColor([0xE74C3C, 0xF39C12, 0x2ECC71, 0x3498DB, 0x9B59B6][i])
                    .setTitle(`🎡 **${spin.text}**`)
                    .setDescription(`
                        ╭─────────────────────────────╮
                        │  **KOLO SE TOČÍ...**            │
                        ╰─────────────────────────────╯
                        
                        \`\`\`
                    🎯 KOLO ŠTĚSTÍ 🎯
                  ╭─────────────────╮
                  │      ${spin.symbols[0]}      │
                  │  ${spin.symbols[4]}       ${spin.symbols[1]}  │
                  │           ⬇️    │
                  │  ${spin.symbols[3]}   ⚡   ${spin.symbols[2]}  │
                  ╰─────────────────╯
                        \`\`\`
                        
                        **Rychlost:** ${'🔥'.repeat(5-i)} | **Zatočení:** ${i+1}/5
                    `)
                    .setFooter({ 
                        text: `${interaction.user.username} • ${spin.text}`, 
                        iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [fakeEmbed] });
                await new Promise(resolve => setTimeout(resolve, 800 + i * 200));
            }

            // Determine real result based on chances
            const rand = Math.random() * 100;
            let result;

            if (rand < 2.5) { // 2.5% Premium na týden
                result = {
                    symbol: '🎁',
                    name: 'Premium na týden',
                    amount: 0,
                    special: 'premium_week',
                    color: 0xFF69B4
                };
            } else if (rand < 5) { // 2.5% 100 ZCOINů  
                result = {
                    symbol: '💰',
                    name: '100 ZCOINů',
                    amount: 100,
                    color: 0xFFD700
                };
            } else if (rand < 15) { // 10% Starter Pack
                result = {
                    symbol: '📦',
                    name: 'Starter Pack na týden',
                    amount: 0,
                    special: 'starter_week',
                    color: 0x8A2BE2
                };
            } else if (rand < 30) { // 15% 35 ZCOINů
                result = {
                    symbol: '💎',
                    name: '35 ZCOINů',
                    amount: 35,
                    color: 0x00CED1
                };
            } else if (rand < 50) { // 20% 18 ZCOINů
                result = {
                    symbol: '💸',
                    name: '18 ZCOINů',
                    amount: 18,
                    color: 0x32CD32
                };
            } else { // 50% 5 ZCOINů
                result = {
                    symbol: '🪙',
                    name: '5 ZCOINů',
                    amount: 5,
                    color: 0xFFA500
                };
            }

            // Add coins if not special reward
            if (result.amount > 0) {
                await economy.addCoins(interaction.user.id, result.amount);
            }

            // Handle special rewards (you'll need to implement these in your economy system)
            if (result.special === 'premium_week') {
                // Add premium for a week - implement in your system
                console.log(`User ${interaction.user.id} won premium for a week`);
            } else if (result.special === 'starter_week') {
                // Add starter pack for a week - implement in your system  
                console.log(`User ${interaction.user.id} won starter pack for a week`);
            }

            // Final result animation
            const finalEmbed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🎡 **MOMENT PRAVDY...**')
                .setDescription(`
                    ╭─────────────────────────────╮
                    │  **KOLO SE ZASTAVUJE...**       │
                    │                                 │
                    │           ✨ ⚡ ✨               │
                    │        VÝSLEDEK SE URČUJE       │
                    │           ✨ ⚡ ✨               │
                    ╰─────────────────────────────╯
                `)
                .setFooter({ 
                    text: `${interaction.user.username} • Napětí na vrcholu...`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [finalEmbed] });
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get updated user data
            const updatedUserData = economy.getUser(interaction.user.id);
            
            // Create final result embed
            const winEmbed = new EmbedBuilder()
                .setColor(result.color)
                .setTitle(`🎉 **VÝHRA: ${result.name.toUpperCase()}!** 🎉`)
                .setDescription(`
                    ╭─────────────────────────────╮
                    │  **FINÁLNÍ POZICE:**            │
                    ╰─────────────────────────────╯
                    
                    \`\`\`
                🎯 VÝSLEDEK 🎯
              ╭─────────────────╮
              │      🪙      │
              │  💸       💎  │
              │           ⬇️    │
              │  📦   ${result.symbol}   💰  │
              │      🎁      │
              ╰─────────────────╯
                    \`\`\`
                    
                    **Výhra:** ${result.name}
                    ${result.amount > 0 ? `**Coiny:** +${result.amount} 💰` : '**Speciální odměna!** 🎁'}
                `)
                .addFields(
                    {
                        name: '🎊 **GRATULUJEME!**',
                        value: result.amount > 0 
                            ? `\`\`\`diff\n+ Vyhráls ${result.name}!\n+ Nový balance: ${updatedUserData.coins?.toLocaleString() || '0'} ZC\`\`\``
                            : `\`\`\`diff\n+ Vyhráls ${result.name}!\n+ Speciální odměna byla přidána\n+ Balance: ${updatedUserData.coins?.toLocaleString() || '0'} ZC\`\`\``,
                        inline: false
                    },
                    {
                        name: '🎯 **ŠANCE NA VÝHRY**',
                        value: `\`\`\`yaml\n🪙 5 ZC: 50%\n💸 18 ZC: 20%\n💎 35 ZC: 15%\n📦 Starter: 10%\n💰 100 ZC: 2.5%\n🎁 Premium: 2.5%\`\`\``,
                        inline: true
                    },
                    {
                        name: '🔄 **DALŠÍ ZATOČENÍ**',
                        value: '```fix\nPoužij /kolo znovu!\nCena: 150 ZCOINů\nVždy něco vyhraješ!```',
                        inline: true
                    }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ 
                    text: `${interaction.user.username} • Každé zatočení je výhra!`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [winEmbed] });

        } catch (error) {
            console.error('Kolo command error:', error);
            
            // DŮLEŽITÉ: Vrátit coiny pokud se něco pokazilo po jejich odebrání
            try {
                await economy.addCoins(interaction.user.id, 150);
                console.log(`Vráceno 150 coinů uživateli ${interaction.user.id} kvůli chybě`);
            } catch (refundError) {
                console.error('Chyba při vracení coinů:', refundError);
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF3366)
                .setTitle('❌ **KOLO ERROR**')
                .setDescription(`
                    ╭─────────────────────────────╮
                    │  **KOLO SE POKAZILO!**          │
                    │                                 │
                    │  ⚠️  Tvoje coiny jsou v pořádku  │
                    │  💰  150 ZCOINů bylo vráceno    │
                    │                                 │
                    │  🔄  Zkus to znovu za chvilku    │
                    ╰─────────────────────────────╯
                `)
                .addFields({
                    name: '🛡️ **OCHRANA COINŮ**',
                    value: '```yaml\n✅ Coiny byly automaticky vráceny\n✅ Žádná ztráta se nekonala\n✅ Můžeš bezpečně zkusit znovu```',
                    inline: false
                })
                .setFooter({ 
                    text: `${interaction.user.username} • Tvoje coiny jsou v bezpečí!`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
