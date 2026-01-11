// functions/api/track-donation.js
export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const data = await request.json();
        
        console.log('📊 Donation click tracked:', {
            service: data.service,
            amount: data.amount,
            name: data.name,
            timestamp: new Date().toLocaleString('pl-PL'),
            ip: request.headers.get('cf-connecting-ip'),
            userAgent: request.headers.get('user-agent')?.substr(0, 100)
        });
        
        // Możesz zapisać do KV Store jeśli potrzebujesz
        if (env.DONATIONS_KV) {
            const donationId = `click_${Date.now()}`;
            await env.DONATIONS_KV.put(donationId, JSON.stringify(data), {
                expirationTtl: 86400 * 7 // 7 dni
            });
        }
        
        // Możesz wysłać powiadomienie na Discord
        if (env.DISCORD_WEBHOOK_URL) {
            await sendDiscordNotification(data, env.DISCORD_WEBHOOK_URL);
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Click tracked successfully',
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (error) {
        console.error('Tracking error:', error);
        
        return new Response(JSON.stringify({ 
            error: error.message,
            success: false
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// Funkcja pomocnicza dla Discord webhook
async function sendDiscordNotification(data, webhookUrl) {
    const embed = {
        title: "🎯 Nowe kliknięcie w donację",
        color: 0x00ff00,
        fields: [
            { name: "Usługa", value: data.name || data.service, inline: true },
            { name: "Kwota", value: `${data.amount} zł`, inline: true },
            { name: "Czas", value: new Date().toLocaleString('pl-PL'), inline: true },
            { name: "Referrer", value: data.referrer || "Direct", inline: false }
        ],
        timestamp: new Date().toISOString()
    };
    
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                embeds: [embed],
                content: `📊 Nowe kliknięcie: **${data.name}** (${data.amount} zł)`
            })
        });
    } catch (error) {
        console.error('Discord webhook error:', error);
    }
}
