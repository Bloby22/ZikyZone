const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder
} = require('discord.js');

const fs = require('fs').promises;
const path = require('path');

class Ticket {
    constructor(client) {
        this.client = client;
        this.kanalId = '1304816241197977621';
        this.transcriptChannelId = '1408360062451191810';
        this.admini = ['1301288449445462067', '1301611458475593769'];
        this.admin = '1301288449445462067';
        this.kategorie = {
            'other': { name: 'Ostatní', emoji: '🎫', color: 0x7C3AED, gradient: 'from-purple-500 to-purple-700' },
            'premium': { name: 'Premium zakoupení', emoji: '💎', color: 0xFF6B9D, gradient: 'from-pink-500 to-rose-500' },
            'questions': { name: 'Dotazy', emoji: '❓', color: 0x06B6D4, gradient: 'from-cyan-500 to-blue-500' },
            'yt_rank': { name: 'Žádost o YT rank', emoji: '📺', color: 0xEF4444, gradient: 'from-red-500 to-red-600' },
            'report': { name: 'Nahlášení', emoji: '⚠️', color: 0xF97316, gradient: 'from-orange-500 to-red-500' },
        };
        this.activeTickets = new Map();
        this.ticketData = new Map();
    }

    async init(guild) {
        const kanal = guild.channels.cache.get(this.kanalId);
        if (!kanal) {
            console.log(`Kanál s ID ${this.kanalId} nebyl nalezen.`);
            return;
        }

        try {
            const messages = await kanal.messages.fetch({ limit: 50 });
            
            const existujiciZprava = messages.find(msg => {
                return msg.author.id === this.client.user.id && 
                       msg.embeds.length > 0 && 
                       (msg.embeds[0].title?.includes('Ticket') ||
                        msg.embeds[0].title?.includes('Ticket Systém') ||
                        msg.embeds[0].description?.includes('ZikyZone Support')) &&
                       msg.components.length > 0 &&
                       msg.components[0].components[0]?.customId === 'ticket_category_select';
            });

            if (existujiciZprava) {
                console.log(`Ticket systém již existuje v kanálu ${kanal.name} (ID: ${existujiciZprava.id})`);
                return;
            }

            await this.createTicketSystem(kanal, guild);
            
        } catch (error) {
            console.error('Chyba při inicializaci ticket systému:', error);
        }
    }

    async createTicketSystem(kanal, guild) {
        const embed = new EmbedBuilder()
            .setTitle('Ticket Systém || ZikyZone')
            .setDescription(`
╔═══════════════════════════════════════╗
║            **🎭 ZikyZone Support**           ║
╚═══════════════════════════════════════╝

✨ **Profesionální podpora na nejvyšší úrovni**
🚀 **Rychlost • Kvalita • Diskrétnost**

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  **🎯 Naše služby zahrnují:**           ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ${this.kategorie.premium.emoji} **${this.kategorie.premium.name}** - VIP přístup     ┃
┃ ${this.kategorie.questions.emoji} **${this.kategorie.questions.name}** - Obecná podpora      ┃
┃ ${this.kategorie.yt_rank.emoji} **${this.kategorie.yt_rank.name}** - Creator program ┃
┃ ${this.kategorie.report.emoji} **${this.kategorie.report.name}** - Bezpečnost         ┃
┃ ${this.kategorie.other.emoji} **${this.kategorie.other.name}** - Cokoliv dalšího        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

> 🎪 **Klikněte na kategorii níže a začněme!**
            `)
            .setColor(0x00D4FF)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .setFooter({
                text: `💎 ${guild.name}`,
                iconURL: guild.iconURL()
            })
            .setTimestamp();

        const select = new StringSelectMenuBuilder()
            .setCustomId('ticket_category_select')
            .setPlaceholder('🎫 Vyberte kategorii pro vytvoření ticketu...')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                Object.entries(this.kategorie).map(([key, cat]) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(cat.name)
                        .setDescription(this.getDescription(key))
                        .setValue(key)
                        .setEmoji(cat.emoji)
                )
            );

        const row = new ActionRowBuilder().addComponents(select);

        try {
            const sentMessage = await kanal.send({ embeds: [embed], components: [row] });
            console.log(`Ticket systém byl úspěšně vytvořen v kanálu ${kanal.name} (Message ID: ${sentMessage.id})`);
        } catch (error) {
            console.error('Chyba při odesílání ticket systému:', error);
        }
    }

    getDescription(key) {
        const descriptions = {
            'other': '🔧 Obecné dotazy, technická podpora a ostatní',
            'premium': '💎 VIP služby, přednostní podpora, speciální funkce',
            'questions': '💬 Časté otázky, návody, obecná komunikace',
            'yt_rank': '🎬 YouTube Creator program, ověření kanálu',
            'report': '🛡️ Nahlášení porušení, spam, nevhodný obsah'
        };
        return descriptions[key] || '📝 Ostatní požadavky a dotazy';
    }

    async handleTicket(interaction) {
        const ticketType = interaction.values[0];
        const userId = interaction.user.id;
        
        const existingTicket = this.activeTickets.get(userId);
        if (existingTicket) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('⚠️ Už máte otevřený ticket!')
                .setDescription(`
                    **Váš aktivní ticket:** <#${existingTicket}>
                    
                    🔄 Můžete pokračovat v konverzaci tam
                    ⏳ Nebo počkejte na uzavření současného ticketu
                `)
                .setColor(0xF97316)
                .setThumbnail(interaction.user.displayAvatarURL());
                
            return await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        if (ticketType === 'yt_rank') {
            await this.showYTModal(interaction);
        } else if (ticketType === 'report') {
            await this.showReportModal(interaction);
        } else {
            await this.showGeneralModal(interaction, ticketType);
        }
    }

    async showGeneralModal(interaction, ticketType) {
        const category = this.kategorie[ticketType];
        
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${ticketType}`)
            .setTitle(`${category.emoji} ${category.name} - Nový ticket`);
        
        const nameInput = new TextInputBuilder()
            .setCustomId('ticket_name')
            .setLabel('👤 Vaše jméno/nick')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Jak se máme oslovovat?')
            .setRequired(true)
            .setMaxLength(50);
        
        const description = new TextInputBuilder()
            .setCustomId('ticket_description')
            .setLabel('📋 Detailní popis problému')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Popište co nejdetailněji váš problém nebo požadavek. Čím více informací, tím rychleji vám pomůžeme!')
            .setRequired(true)
            .setMinLength(20)
            .setMaxLength(1500);

        const priorityInput = new TextInputBuilder()
            .setCustomId('ticket_priority')
            .setLabel('⚡ Priorita (Nízká/Střední/Vysoká/Kritická)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Nízká')
            .setRequired(false)
            .setMaxLength(15);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(description),
            new ActionRowBuilder().addComponents(priorityInput)
        );

        await interaction.showModal(modal);
    }
    
    async showYTModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('ticket_modal_yt_rank')
            .setTitle('📺 YouTube Creator Program - Žádost');
            
        const jmeno = new TextInputBuilder()
            .setCustomId('ticket_name')
            .setLabel('👤 Vaše skutečné jméno')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Jméno a příjmení pro ověření')
            .setRequired(true)
            .setMaxLength(50);

        const channel = new TextInputBuilder()
            .setCustomId('ticket_channel')
            .setLabel('📺 Odkaz na YouTube kanál')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://youtube.com/@vas_kanal nebo https://youtube.com/channel/UC...')
            .setRequired(true)
            .setMaxLength(200);

        const subscribers = new TextInputBuilder()
            .setCustomId('ticket_subscribers')
            .setLabel('👥 Počet odběratelů a views')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Např: 1,500 odběratelů, 50k+ zhlédnutí (min. 500 odběratelů)')
            .setRequired(true)
            .setMaxLength(100);

        const content = new TextInputBuilder()
            .setCustomId('ticket_description')
            .setLabel('🎬 Typ obsahu a aktivita')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Jaký typ obsahu vytváříte? Jak často nahráváte? Plány do budoucna?')
            .setRequired(true)
            .setMaxLength(800);

        modal.addComponents(
            new ActionRowBuilder().addComponents(jmeno),
            new ActionRowBuilder().addComponents(channel),
            new ActionRowBuilder().addComponents(subscribers),
            new ActionRowBuilder().addComponents(content)
        );

        await interaction.showModal(modal);
    }

    async showReportModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('ticket_modal_report')
            .setTitle('⚠️ Nahlášení porušení pravidel');

        const reported = new TextInputBuilder()
            .setCustomId('ticket_name')
            .setLabel('🎯 Koho nahlašujete')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Username#1234, ID uživatele nebo @ mention')
            .setRequired(true)
            .setMaxLength(100);

        const reason = new TextInputBuilder()
            .setCustomId('ticket_description')
            .setLabel('📝 Důvod nahlášení')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Detailně popište co se stalo, kdy, kde a jaké pravidlo bylo porušeno')
            .setRequired(true)
            .setMinLength(30)
            .setMaxLength(1000);

        const evidence = new TextInputBuilder()
            .setCustomId('ticket_evidence')
            .setLabel('🔍 Důkazy (screenshoty, odkazy)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Vložte odkazy na screenshoty, zprávy nebo jiné důkazy. Čím více, tím lépe!')
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reported),
            new ActionRowBuilder().addComponents(reason),
            new ActionRowBuilder().addComponents(evidence)
        );

        await interaction.showModal(modal);
    }

    async handleModalSubmit(interaction) {
        const ticketType = interaction.customId.replace('ticket_modal_', '');
        const name = interaction.fields.getTextInputValue('ticket_name');
        const description = interaction.fields.getTextInputValue('ticket_description');
        
        let additionalInfo = '';
        let priority = 'Nízká';

        if (ticketType === 'yt_rank') {
            const channel = interaction.fields.getTextInputValue('ticket_channel');
            const subscribers = interaction.fields.getTextInputValue('ticket_subscribers');
            additionalInfo = `\n**📺 YouTube kanál:** ${channel}\n**👥 Statistiky:** ${subscribers}`;
            priority = 'Střední';
        } else if (ticketType === 'report') {
            const evidence = interaction.fields.getTextInputValue('ticket_evidence') || 'Nejsou uvedeny';
            additionalInfo = `\n**🔍 Důkazy:** ${evidence}`;
            priority = 'Vysoká';
        } else {
            try {
                priority = interaction.fields.getTextInputValue('ticket_priority') || 'Nízká';
            } catch {}
        }

        await this.createTicketChannel(interaction, ticketType, name, description, additionalInfo, priority);
    }

    async createTicketChannel(interaction, ticketType, name, description, additionalInfo = '', priority = 'Nízká') {
        const guild = interaction.guild;
        const user = interaction.user;
        const category = this.kategorie[ticketType];

        // Vytvoření kanálu s moderním názvem
        const ticketChannel = await guild.channels.create({
            name: `${category.emoji.replace(/[^\w]/g, '')}-${user.username}-${Date.now().toString().slice(-4)}`.toLowerCase(),
            type: ChannelType.GuildText,
            topic: `Ticket ${category.name} | Uživatel: ${user.tag} | Priorita: ${priority} | Vytvořeno: ${new Date().toLocaleString('cs-CZ')}`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.UseExternalEmojis,
                        PermissionFlagsBits.AddReactions
                    ]
                },
                ...this.admini.map(roleId => ({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.UseExternalEmojis,
                        PermissionFlagsBits.AddReactions,
                        PermissionFlagsBits.ManageChannels
                    ]
                }))
            ]
        });

        // Uložení dat o ticketu
        this.activeTickets.set(user.id, ticketChannel.id);
        this.ticketData.set(ticketChannel.id, {
            userId: user.id,
            userName: user.username,
            userAvatar: user.displayAvatarURL({ dynamic: true, size: 256 }),
            category: category,
            name: name,
            description: description,
            additionalInfo: additionalInfo,
            priority: priority,
            createdAt: Date.now(),
            claimed: false,
            claimedBy: null,
            messages: []
        });

        // Pokročilý ticket embed s animacemi
        const ticketId = ticketChannel.id.slice(-6).toUpperCase();
        
        const ticketEmbed = new EmbedBuilder()
            .setAuthor({ 
                name: `${category.name} • Ticket #${ticketId}`,
                iconURL: user.displayAvatarURL({ dynamic: true }),
                url: `https://discord.com/channels/${guild.id}/${ticketChannel.id}`
            })
            .setTitle(`${category.emoji} Nový ticket byl vytvořen!`)
            .setDescription(`
                ╔═══════════════════════════════════════════╗
                ║              **📋 INFORMACE O TICKETU**              ║
                ╚═══════════════════════════════════════════╝
                
                **👤 Uživatel:** ${user} (\`${user.tag}\`)
                **📝 Kontakt:** \`${name}\`
                **🎯 Kategorie:** ${category.emoji} **${category.name}**
                **⏰ Vytvořeno:** <t:${Math.floor(Date.now() / 1000)}:F>
                **📅 Datum:** <t:${Math.floor(Date.now() / 1000)}:D>
                
                ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
                ┃                **📄 POPIS PROBLÉMU**                ┃
                ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                \`\`\`
                ${description}
                \`\`\`
                ${additionalInfo}
                
                ═══════════════════════════════════════════
                **🔥 STATUS:** \`🟢 AKTIVNÍ\` • **🎫 ID:** \`${ticketChannel.id}\`
                ═══════════════════════════════════════════
            `)
            .setColor(category.color)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { 
                    name: '⚡ Priorita', 
                    value: this.getPriorityBadge(priority), 
                    inline: true 
                },
                { 
                    name: '⏱️ Očekávaná doba', 
                    value: this.getResponseTime(priority), 
                    inline: true 
                },
                { 
                    name: '🏷️ Kategorie', 
                    value: `\`${category.name}\``, 
                    inline: true 
                },
                { 
                    name: '📊 Status ticketu', 
                    value: '```ansi\n\u001b[1;32m● OTEVŘENO\n\u001b[1;33m○ Čeká na odpověď\n\u001b[1;37m○ Nepřevzato\n```', 
                    inline: true 
                },
                { 
                    name: '🎯 Akce požadované', 
                    value: '```ansi\n\u001b[1;36m→ Převzetí ticketu\n\u001b[1;35m→ Prvotní odpověď\n\u001b[1;37m→ Řešení problému\n```', 
                    inline: true 
                },
                { 
                    name: '📈 Statistiky', 
                    value: `\`\`\`ansi\n\u001b[1;33mTicket číslo: #${ticketId}\n\u001b[1;36mPořadí dnes: ${this.activeTickets.size + 1}\n\u001b[1;32mÚspěšnost: 98.7%\n\`\`\``, 
                    inline: true 
                }
            )
            .setFooter({ 
                text: `💎 ${guild.name} | Premium Support Engine • Vytvořeno pomocí ZikyZone Bot`,
                iconURL: guild.iconURL()
            })
            .setTimestamp()

        const adminRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_claim')
                    .setLabel('Převzít ticket')
                    .setEmoji('✋')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('ticket_priority')
                    .setLabel('Změnit prioritu')
                    .setEmoji('⚡')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_add_user')
                    .setLabel('Přidat uživatele')
                    .setEmoji('👥')
                    .setStyle(ButtonStyle.Secondary)
            );

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_transcript')
                    .setLabel('Stáhnout transkript')
                    .setEmoji('📄')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('Uzavřít ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );

        const userRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_user_close')
                    .setLabel('Uzavřít ticket')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_feedback')
                    .setLabel('Hodnocení')
                    .setEmoji('⭐')
                    .setStyle(ButtonStyle.Secondary)
            );

        const adminMentions = this.admini.map(id => `<@&${id}>`).join(' ');
        const mentionMessage = `${user} │ ${adminMentions}\n\n🔔 **Nový ${category.name.toLowerCase()} ticket vyžaduje pozornost!**`;

        await ticketChannel.send({ content: mentionMessage });
        await ticketChannel.send({ embeds: [ticketEmbed], components: [adminRow, actionRow, userRow] });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎉 Vítejte v Premium podpoře!')
            .setDescription(`
                **Zdravím, ${user}!** 👋 Děkujeme za kontaktování naší podpory.
                
                ╔══════════════════════════════════════╗
                ║            **🚀 CO MŮŽETE OČEKÁVAT?**         ║
                ╚══════════════════════════════════════╝
                
                ✨ **Rychlé řešení** - Průměrná doba odpovědi **15 minut**
                🎯 **Profesionalitu** - Náš zkušený support tým
                🔐 **Diskrétnost** - Vše zůstane mezi námi
                📞 **24/7 podpora** - Jsme tu pro vás kdykoliv
                
                ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
                ┃                  **📋 DŮLEŽITÉ INFORMACE**                ┃
                ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
                ┃ 🤝 Buďte prosím **trpěliví a zdvořilí**        ┃
                ┃ 📝 **Přidejte více detailů** pokud je potřeba  ┃
                ┃ 🔄 Můžete **upravit prioritu** kdykoliv       ┃
                ┃ ⏰ **Neodpisujte rychle** - kontrolujeme vše   ┃
                ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                
                > 🎪 **Váš ticket ID: \`#${ticketId}\`** - zapamatujte si ho prosím
            `)
            .setColor(0x00FF88)
            .setThumbnail('https://cdn.discordapp.com/emojis/welcome.gif')
            .addFields(
                { 
                    name: '🎯 Váš problém', 
                    value: `\`\`\`${description.length > 100 ? description.substring(0, 100) + '...' : description}\`\`\``, 
                    inline: false 
                },
                { 
                    name: '⏰ Status', 
                    value: '```ansi\n\u001b[1;33m⏳ Čeká na převzetí...\n```', 
                    inline: true 
                },
                { 
                    name: '📊 Pozice ve frontě', 
                    value: `\`\`\`ansi\n\u001b[1;36m#${this.activeTickets.size} z ${this.activeTickets.size}\n\`\`\``, 
                    inline: true 
                }
            )
            .setFooter({ 
                text: `⭐ Hodnocení podpory: 4.9/5 • ${guild.name}`,
                iconURL: guild.iconURL() 
            })
            .setTimestamp();

        await ticketChannel.send({ embeds: [welcomeEmbed] });

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Ticket byl úspěšně vytvořen!')
            .setDescription(`
                **Váš ticket:** ${ticketChannel}
                **ID ticketu:** \`#${ticketId}\`
                **Kategorie:** ${category.emoji} ${category.name}
                
                🚀 Přejděte do kanálu pro pokračování!
            `)
            .setColor(0x00FF88)
            .setThumbnail(category.emoji === '🎫' ? null : user.displayAvatarURL());

        await interaction.reply({
            embeds: [successEmbed],
            ephemeral: true
        });
    }

    async createHTMLTranscript(channel, ticketData) {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        
        const html = `
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket #${channel.id.slice(-6)} - ${ticketData.category.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #2C2F33 0%, #23272A 100%);
            color: #DCDDDE;
            line-height: 1.6;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #7289DA, #5865F2);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            color: white;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        
        .ticket-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .info-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 15px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .info-card h3 {
            color: #7289DA;
            margin-bottom: 8px;
            font-size: 1.1em;
        }
        
        .messages {
            background: #36393F;
            border-radius: 15px;
            padding: 0;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            border: 1px solid #40444B;
        }
        
        .message {
            padding: 20px;
            border-bottom: 1px solid #40444B;
            display: flex;
            gap: 15px;
            transition: background 0.2s;
        }
        
        .message:hover {
            background: rgba(255, 255, 255, 0.02);
        }
        
        .message:last-child {
            border-bottom: none;
        }
        
        .avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .message-content {
            flex-grow: 1;
        }
        
        .message-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        
        .username {
            font-weight: 600;
            color: #FFFFFF;
            font-size: 1.1em;
        }
        
        .bot {
            color: #5865F2;
        }
        
        .admin {
            color: #F04747;
        }
        
        .timestamp {
            color: #72767D;
            font-size: 0.85em;
            font-weight: 400;
        }
        
        .message-text {
            color: #DCDDDE;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 1em;
            line-height: 1.5;
        }
        
        .embed {
            background: #2F3136;
            border-left: 4px solid #5865F2;
            border-radius: 0 8px 8px 0;
            margin: 10px 0;
            padding: 15px;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
        }
        
        .embed-title {
            color: #FFFFFF;
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 1.1em;
        }
        
        .embed-description {
            color: #DCDDDE;
            font-size: 0.95em;
            line-height: 1.4;
        }
        
        .attachment {
            background: #2F3136;
            border: 1px solid #40444B;
            border-radius: 8px;
            padding: 10px;
            margin: 10px 0;
            color: #7289DA;
        }
        
        .system-message {
            background: rgba(250, 166, 26, 0.1);
            border-left: 4px solid #FAA61A;
            font-style: italic;
            color: #FAA61A;
        }
        
        .footer {
            text-align: center;
            padding: 30px;
            color: #72767D;
            font-size: 0.9em;
            border-top: 1px solid #40444B;
            margin-top: 30px;
        }
        
        .priority-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .priority-low { background: rgba(67, 181, 129, 0.2); color: #43B581; }
        .priority-medium { background: rgba(250, 166, 26, 0.2); color: #FAA61A; }
        .priority-high { background: rgba(240, 71, 71, 0.2); color: #F04747; }
        .priority-critical { background: rgba(237, 66, 69, 0.2); color: #ED4245; }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: 600;
            background: rgba(67, 181, 129, 0.2);
            color: #43B581;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 15px;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 2em;
            }
            
            .ticket-info {
                grid-template-columns: 1fr;
            }
            
            .message {
                padding: 15px;
            }
            
            .avatar {
                width: 40px;
                height: 40px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${ticketData.category.emoji} Ticket Transkript #${channel.id.slice(-6)}</h1>
            <div class="ticket-info">
                <div class="info-card">
                    <h3>👤 Uživatel</h3>
                    <p><strong>${ticketData.userName}</strong></p>
                    <p>Kontakt: ${ticketData.name}</p>
                </div>
                <div class="info-card">
                    <h3>🎯 Kategorie</h3>
                    <p>${ticketData.category.emoji} ${ticketData.category.name}</p>
                    <span class="priority-badge priority-${ticketData.priority.toLowerCase()}">${ticketData.priority} priorita</span>
                </div>
                <div class="info-card">
                    <h3>📅 Časové údaje</h3>
                    <p>Vytvořeno: ${new Date(ticketData.createdAt).toLocaleString('cs-CZ')}</p>
                    <p>Uzavřeno: ${new Date().toLocaleString('cs-CZ')}</p>
                </div>
                <div class="info-card">
                    <h3>📊 Status</h3>
                    <span class="status-badge">Uzavřeno</span>
                    <p>Celkem zpráv: ${sortedMessages.size}</p>
                </div>
            </div>
        </div>
        
        <div class="messages">
            ${sortedMessages.map(msg => {
                const isBot = msg.author.bot;
                const isAdmin = msg.member?.roles?.cache?.some(role => this.admini.includes(role.id)) || false;
                const userClass = isBot ? 'bot' : isAdmin ? 'admin' : '';
                
                return `
                <div class="message ${msg.system ? 'system-message' : ''}">
                    <img src="${msg.author.displayAvatarURL({ format: 'png', size: 128 })}" alt="${msg.author.username}" class="avatar">
                    <div class="message-content">
                        <div class="message-header">
                            <span class="username ${userClass}">${msg.author.username}${isBot ? ' (Bot)' : ''}${isAdmin ? ' (Admin)' : ''}</span>
                            <span class="timestamp">${new Date(msg.createdTimestamp).toLocaleString('cs-CZ')}</span>
                        </div>
                        <div class="message-text">${msg.content || ''}</div>
                        ${msg.embeds.length > 0 ? msg.embeds.map(embed => `
                            <div class="embed">
                                ${embed.title ? `<div class="embed-title">${embed.title}</div>` : ''}
                                ${embed.description ? `<div class="embed-description">${embed.description}</div>` : ''}
                            </div>
                        `).join('') : ''}
                        ${msg.attachments.size > 0 ? msg.attachments.map(att => `
                            <div class="attachment">
                                📎 <a href="${att.url}" target="_blank">${att.name}</a> (${Math.round(att.size / 1024)} KB)
                            </div>
                        `).join('') : ''}
                    </div>
                </div>
                `;
            }).join('')}
        </div>
        
        <div class="footer">
            <p>🌟 Transkript vytvořen automaticky pomocí ZikyZone Bot systému</p>
            <p>📅 Vygenerováno: ${new Date().toLocaleString('cs-CZ')} | 🎫 Ticket ID: ${channel.id}</p>
            <p>💎 ${channel.guild.name} - Premium Support System</p>
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    async handleAdminButtons(interaction) {
        const member = interaction.member;
        const hasAdminRole = this.admini.some(roleId => member.roles.cache.has(roleId));

        if (!hasAdminRole && !['ticket_user_close', 'ticket_feedback'].includes(interaction.customId)) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Nedostatečná oprávnění!')
                .setDescription('Tuto akci mohou provádět pouze administrátoři.')
                .setColor(0xF04747);
                
            return await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        switch(interaction.customId) {
            case 'ticket_claim':
                await this.claimTicket(interaction);
                break;
            case 'ticket_close':
            case 'ticket_user_close':
                await this.closeTicket(interaction);
                break;
            case 'ticket_priority':
                await this.changePriority(interaction);
                break;
            case 'ticket_transcript':
                await this.generateTranscript(interaction);
                break;
            case 'ticket_add_user':
                await this.addUserModal(interaction);
                break;
            case 'ticket_feedback':
                await this.showFeedbackModal(interaction);
                break;
        }
    }

    async claimTicket(interaction) {
        const ticketData = this.ticketData.get(interaction.channel.id);
        if (ticketData) {
            ticketData.claimed = true;
            ticketData.claimedBy = interaction.user.id;
        }

        const claimedEmbed = new EmbedBuilder()
            .setTitle('✅ Ticket byl převzat!')
            .setDescription(`
                **👤 Převzal:** ${interaction.user}
                **⏰ Čas převzetí:** <t:${Math.floor(Date.now() / 1000)}:F>
                **🎯 Status:** \`Aktivně řešeno\`
                
                🚀 **Ticket je nyní v péči našeho týmu!**
            `)
            .setColor(0x43B581)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await interaction.reply({ embeds: [claimedEmbed] });
    }

    async changePriority(interaction) {
        const priorityModal = new ModalBuilder()
            .setCustomId('priority_modal')
            .setTitle('⚡ Změna priority ticketu');

        const priorityInput = new TextInputBuilder()
            .setCustomId('new_priority')
            .setLabel('Nová priorita')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Nízká/Střední/Vysoká/Kritická')
            .setRequired(true)
            .setMaxLength(15);

        const reasonInput = new TextInputBuilder()
            .setCustomId('priority_reason')
            .setLabel('Důvod změny (volitelné)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Proč měníte prioritu?')
            .setRequired(false)
            .setMaxLength(200);

        priorityModal.addComponents(
            new ActionRowBuilder().addComponents(priorityInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );
        
        await interaction.showModal(priorityModal);
    }

    async generateTranscript(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const ticketData = this.ticketData.get(interaction.channel.id);
        if (!ticketData) {
            return await interaction.editReply({
                content: '❌ Nepodařilo se najít data o ticketu!',
                ephemeral: true
            });
        }

        try {
            const html = await this.createHTMLTranscript(interaction.channel, ticketData);
            const filename = `ticket-${ticketData.userName}-${Date.now()}.html`;
            
            const tempPath = path.join(__dirname, 'temp', filename);
            await fs.mkdir(path.dirname(tempPath), { recursive: true });
            await fs.writeFile(tempPath, html, 'utf8');
            
            const transcriptChannel = interaction.guild.channels.cache.get(this.transcriptChannelId);
            if (transcriptChannel) {
                const attachment = new AttachmentBuilder(tempPath, { name: filename });
                
                const transcriptEmbed = new EmbedBuilder()
                    .setTitle('📄 Nový ticket transkript')
                    .setDescription(`
                        **🎫 Ticket:** #${interaction.channel.id.slice(-6)}
                        **👤 Uživatel:** ${ticketData.userName}
                        **🎯 Kategorie:** ${ticketData.category.emoji} ${ticketData.category.name}
                        **⚡ Priorita:** ${this.getPriorityBadge(ticketData.priority)}
                        **⏰ Vytvořeno:** <t:${Math.floor(ticketData.createdAt / 1000)}:F>
                        **🔒 Uzavřeno:** <t:${Math.floor(Date.now() / 1000)}:F>
                    `)
                    .setColor(ticketData.category.color)
                    .setThumbnail(ticketData.userAvatar)
                    .setTimestamp();

                await transcriptChannel.send({
                    embeds: [transcriptEmbed],
                    files: [attachment]
                });
                
                // Smazání dočasného souboru
                await fs.unlink(tempPath);
            }
            
            await interaction.editReply({
                content: '✅ Transkript byl úspěšně vygenerován a odeslán do archívu!',
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Chyba při generování transkriptu:', error);
            await interaction.editReply({
                content: '❌ Nastala chyba při generování transkriptu!',
                ephemeral: true
            });
        }
    }

    async closeTicket(interaction) {
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Potvrzení uzavření ticketu')
            .setDescription(`
                **Opravdu chcete uzavřít tento ticket?**
                
                ⚠️ **Upozornění:**
                • Tato akce je nevratná
                • Všechny zprávy budou archivovány
                • Kanál bude smazán za 30 sekund
                • Transkript bude automaticky vytvořen
                
                🎫 **Ticket ID:** \`${interaction.channel.id.slice(-6)}\`
            `)
            .setColor(0xF04747)
            .setThumbnail('https://cdn.discordapp.com/emojis/warning.png');

        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_confirm_close')
                    .setLabel('Ano, uzavřít ticket')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_cancel_close')
                    .setLabel('Zrušit')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmRow],
            ephemeral: true
        });
    }

    async handleConfirmClose(interaction) {
        const channel = interaction.channel;
        const ticketData = this.ticketData.get(channel.id);
        
        // Automatické vytvoření transkriptu před uzavřením
        if (ticketData) {
            try {
                const html = await this.createHTMLTranscript(channel, ticketData);
                const filename = `ticket-${ticketData.userName}-${Date.now()}.html`;
                
                const transcriptChannel = interaction.guild.channels.cache.get(this.transcriptChannelId);
                if (transcriptChannel) {
                    const tempPath = path.join(__dirname, 'temp', filename);
                    await fs.mkdir(path.dirname(tempPath), { recursive: true });
                    await fs.writeFile(tempPath, html, 'utf8');
                    
                    const attachment = new AttachmentBuilder(tempPath, { name: filename });
                    
                    const transcriptEmbed = new EmbedBuilder()
                        .setTitle('📄 Ticket uzavřen - Transkript')
                        .setDescription(`
                            **🎫 Ticket:** #${channel.id.slice(-6)}
                            **👤 Uživatel:** ${ticketData.userName}
                            **🎯 Kategorie:** ${ticketData.category.emoji} ${ticketData.category.name}
                            **⚡ Priorita:** ${this.getPriorityBadge(ticketData.priority)}
                            **👑 Uzavřel:** ${interaction.user}
                            **⏰ Vytvořeno:** <t:${Math.floor(ticketData.createdAt / 1000)}:F>
                            **🔒 Uzavřeno:** <t:${Math.floor(Date.now() / 1000)}:F>
                        `)
                        .setColor(ticketData.category.color)
                        .setThumbnail(ticketData.userAvatar)
                        .setFooter({ 
                            text: `Uzavřeno administrátorem: ${interaction.user.tag}`,
                            iconURL: interaction.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    await transcriptChannel.send({
                        embeds: [transcriptEmbed],
                        files: [attachment]
                    });
                    
                    await fs.unlink(tempPath);
                }
            } catch (error) {
                console.error('Chyba při vytváření transkriptu:', error);
            }
            
            // Odstranění z aktivních ticketů
            this.activeTickets.delete(ticketData.userId);
            this.ticketData.delete(channel.id);
        }

        const closingEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket se uzavírá...')
            .setDescription(`
                **Ticket byl úspěšně uzavřen!**
                
                **👤 Uzavřel:** ${interaction.user}
                **⏰ Čas uzavření:** <t:${Math.floor(Date.now() / 1000)}:F>
                **📄 Transkript:** Automaticky vytvořen a archivován
                
                ⏳ **Kanál bude smazán za 30 sekund...**
                
                💝 **Děkujeme za využití naší podpory!**
            `)
            .setColor(0xF04747)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await interaction.update({ embeds: [closingEmbed], components: [] });

        setTimeout(async () => {
            try {
                await channel.delete('Ticket uzavřen administrátorem');
            } catch (error) {
                console.log('Chyba při mazání ticketu:', error);
            }
        }, 30000);
    }

    async handleCancelClose(interaction) {
        const cancelEmbed = new EmbedBuilder()
            .setTitle('✅ Uzavření zrušeno')
            .setDescription('Ticket zůstává otevřený a můžete pokračovat v konverzaci.')
            .setColor(0x43B581);
            
        await interaction.update({
            embeds: [cancelEmbed],
            components: []
        });
    }

    getPriorityBadge(priority) {
        const badges = {
            'Nízká': '🟢 **NÍZKÁ**',
            'Střední': '🟡 **STŘEDNÍ**', 
            'Vysoká': '🔴 **VYSOKÁ**',
            'Kritická': '🟣 **KRITICKÁ**'
        };
        return badges[priority] || '🟢 **NÍZKÁ**';
    }

    getResponseTime(priority) {
        const times = {
            'Nízká': '```ansi\n\u001b[1;32m~ 30-60 minut\n```',
            'Střední': '```ansi\n\u001b[1;33m~ 15-30 minut\n```',
            'Vysoká': '```ansi\n\u001b[1;31m~ 5-15 minut\n```',
            'Kritická': '```ansi\n\u001b[1;35m~ Okamžitě\n```'
        };
        return times[priority] || '```ansi\n\u001b[1;32m~ 30-60 minut\n```';
    }

    async showFeedbackModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('feedback_modal')
            .setTitle('⭐ Hodnocení podpory');

        const ratingInput = new TextInputBuilder()
            .setCustomId('rating')
            .setLabel('Hodnocení (1-5 hvězdiček)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('5')
            .setRequired(true)
            .setMaxLength(1);

        const feedbackInput = new TextInputBuilder()
            .setCustomId('feedback_text')
            .setLabel('Váš komentář (volitelné)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Jak hodnotíte naši podporu? Co můžeme zlepšit?')
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(
            new ActionRowBuilder().addComponents(ratingInput),
            new ActionRowBuilder().addComponents(feedbackInput)
        );

        await interaction.showModal(modal);
    }

    async addUserModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('add_user_modal')
            .setTitle('👥 Přidání uživatele do ticketu');

        const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('ID uživatele nebo @mention')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('123456789012345678 nebo @user')
            .setRequired(true)
            .setMaxLength(100);

        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
    }

    async handleInteraction(interaction) {
        try {
            if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category_select') {
                await this.handleTicket(interaction);
            } 
            else if (interaction.isButton()) {
                const ticketButtons = [
                    'ticket_claim', 'ticket_close', 'ticket_user_close', 
                    'ticket_priority', 'ticket_transcript', 'ticket_add_user', 'ticket_feedback'
                ];
                const confirmButtons = ['ticket_confirm_close', 'ticket_cancel_close'];
                
                if (ticketButtons.includes(interaction.customId)) {
                    await this.handleAdminButtons(interaction);
                } else if (confirmButtons.includes(interaction.customId)) {
                    if (interaction.customId === 'ticket_confirm_close') {
                        await this.handleConfirmClose(interaction);
                    } else {
                        await this.handleCancelClose(interaction);
                    }
                }
            } 
            else if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('ticket_modal_')) {
                    await this.handleModalSubmit(interaction);
                } 
                else if (interaction.customId === 'priority_modal') {
                    const newPriority = interaction.fields.getTextInputValue('new_priority');
                    const reason = interaction.fields.getTextInputValue('priority_reason') || 'Bez udání důvodu';
                    
                    const ticketData = this.ticketData.get(interaction.channel.id);
                    if (ticketData) {
                        ticketData.priority = newPriority;
                    }
                    
                    const priorityEmbed = new EmbedBuilder()
                        .setTitle('⚡ Priorita změněna!')
                        .setDescription(`
                            **Nová priorita:** ${this.getPriorityBadge(newPriority)}
                            **Změnil:** ${interaction.user}
                            **Důvod:** ${reason}
                            **Čas:** <t:${Math.floor(Date.now() / 1000)}:F>
                        `)
                        .setColor(0xFAA61A)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [priorityEmbed] });
                }
                else if (interaction.customId === 'feedback_modal') {
                    const rating = interaction.fields.getTextInputValue('rating');
                    const feedback = interaction.fields.getTextInputValue('feedback_text') || 'Bez komentáře';
                    
                    const stars = '⭐'.repeat(Math.min(Math.max(parseInt(rating), 1), 5));
                    
                    const feedbackEmbed = new EmbedBuilder()
                        .setTitle('⭐ Děkujeme za hodnocení!')
                        .setDescription(`
                            **Hodnocení:** ${stars} (${rating}/5)
                            **Komentář:** ${feedback}
                            **Od:** ${interaction.user}
                            
                            💝 **Vaše zpětná vazba je pro nás velmi důležitá!**
                        `)
                        .setColor(0x43B581)
                        .setTimestamp();
                        
                    await interaction.reply({ embeds: [feedbackEmbed] });
                }
                else if (interaction.customId === 'add_user_modal') {
                    const userInput = interaction.fields.getTextInputValue('user_id');
                    const userId = userInput.replace(/[<@!>]/g, '');
                    
                    try {
                        const user = await interaction.guild.members.fetch(userId);
                        
                        await interaction.channel.permissionOverwrites.create(user, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true,
                            AttachFiles: true
                        });
                        
                        const addEmbed = new EmbedBuilder()
                            .setTitle('✅ Uživatel přidán do ticketu!')
                            .setDescription(`
                                **👤 Přidán:** ${user}
                                **👑 Přidal:** ${interaction.user}
                                **⏰ Čas:** <t:${Math.floor(Date.now() / 1000)}:F>
                                
                                🎫 **Uživatel má nyní přístup k tomuto ticketu**
                            `)
                            .setColor(0x43B581)
                            .setTimestamp();
                            
                        await interaction.reply({ embeds: [addEmbed] });
                        
                    } catch (error) {
                        const errorEmbed = new EmbedBuilder()
                            .setTitle('❌ Chyba při přidávání uživatele!')
                            .setDescription(`
                                **Důvod:** Uživatel nebyl nalezen nebo nemám oprávnění
                                **Zadané ID:** \`${userId}\`
                                
                                ℹ️ **Zkuste:**
                                • Správné ID uživatele
                                • @mention uživatele
                                • Ověřte, že je uživatel na serveru
                            `)
                            .setColor(0xF04747);
                            
                        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                    }
                }
            }
        } catch (error) {
            console.error('Chyba při zpracování interakce:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Nastala neočekávaná chyba!')
                    .setDescription(`
                        **Chyba:** \`${error.message}\`
                        
                        🔧 **Prosím kontaktujte administrátora**
                    `)
                    .setColor(0xF04747)
                    .setTimestamp();
                    
                await interaction.reply({ 
                    embeds: [errorEmbed], 
                    ephemeral: true 
                }).catch(() => {});
            }
        }
    }


    async handleAllInteractions(interaction) {
        try {
            if (['show_stats', 'show_team'].includes(interaction.customId)) {
                await this.handleInfoButtons(interaction);
                return;
            }

            await this.handleInteraction(interaction);
            
        } catch (error) {
            console.error('Chyba v handleAllInteractions:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: '❌ Nastala neočekávaná chyba! Prosím zkuste to znovu nebo kontaktujte administrátora.',
                        ephemeral: true
                    });
                } catch (replyError) {
                    console.error('Chyba při odpovědi na chybu:', replyError);
                }
            }
        }
    }

    async saveTicketData() {
        try {
            const dataDir = path.join(__dirname, 'data');
            await fs.mkdir(dataDir, { recursive: true });
            
            const backupData = {
                activeTickets: Array.from(this.activeTickets.entries()),
                ticketData: Array.from(this.ticketData.entries()),
                timestamp: Date.now()
            };
            
            await fs.writeFile(
                path.join(dataDir, 'ticket-backup.json'),
                JSON.stringify(backupData, null, 2),
                'utf8'
            );
            
            console.log('✅ Ticket data byla úspěšně uložena');
        } catch (error) {
            console.error('❌ Chyba při ukládání ticket dat:', error);
        }
    }

    async loadTicketData() {
        try {
            const dataPath = path.join(__dirname, 'data', 'ticket-backup.json');
            const data = await fs.readFile(dataPath, 'utf8');
            const backupData = JSON.parse(data);
            
            this.activeTickets = new Map(backupData.activeTickets || []);
            this.ticketData = new Map(backupData.ticketData || []);
            
            console.log(`✅ Načteno ${this.activeTickets.size} aktivních ticketů`);
        } catch (error) {
            console.log('ℹ️ Žádná předchozí data nebyla nalezena, začínám s čistým stavem');
            this.activeTickets = new Map();
            this.ticketData = new Map();
        }
    }
  
    async cleanupOldData() {
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        
        for (const [channelId, data] of this.ticketData.entries()) {
            if (now - data.createdAt > maxAge) {
                this.ticketData.delete(channelId);
                for (const [userId, activeChannelId] of this.activeTickets.entries()) {
                    if (activeChannelId === channelId) {
                        this.activeTickets.delete(userId);
                        break;
                    }
                }
            }
        }
        
        await this.saveTicketData();
        console.log('🧹 Vyčištěna stará ticket data');
    }

    async initialize(guild) {
        await this.loadTicketData();
        await this.init(guild);
        
        setInterval(() => {
            this.saveTicketData();
        }, 10 * 60 * 1000);
        
        // Automatické čištění každý den
        setInterval(() => {
            this.cleanupOldData();
        }, 24 * 60 * 60 * 1000);
        
        console.log('🎫 Ticket systém byl úspěšně inicializován');
    }

    getStats() {
        return {
            activeTickets: this.activeTickets.size,
            totalTickets: this.ticketData.size,
            categories: Object.keys(this.kategorie).length,
            uptime: process.uptime()
        };
    }

    async debugInfo(channel) {
        const stats = this.getStats();
        const debugEmbed = new EmbedBuilder()
            .setTitle('🔧 Debug informace - Ticket systém')
            .setDescription(`
                **📊 Statistiky:**
                • Aktivní tickety: ${stats.activeTickets}
                • Celkem dat: ${stats.totalTickets}
                • Kategorie: ${stats.categories}
                • Uptime: ${Math.floor(stats.uptime / 60)} minut
                
                **💾 Paměť:**
                • ActiveTickets Map: ${this.activeTickets.size} entries
                • TicketData Map: ${this.ticketData.size} entries
                
                **⚙️ Konfigurace:**
                • Hlavní kanál: <#${this.kanalId}>
                • Transkripty: <#${this.transcriptChannelId}>
                • Admin role: ${this.admini.length}
            `)
            .setColor(0xFF6B00)
            .setTimestamp();
            
        return debugEmbed;
    }
}

module.exports = Ticket;
