// src/services/campaignNotifier.ts
// Notifies the Campaign Platform when a broker replies.
// Returns true if the broker was found in an active campaign.

import axios from 'axios';

const CAMPAIGN_PLATFORM_URL = process.env.CAMPAIGN_PLATFORM_URL;
const WEBHOOK_SECRET = process.env.CAMPAIGN_WEBHOOK_SECRET;

/**
 * Notify the campaign platform that a broker has replied.
 * Returns true if the broker was in an active campaign (so the bot can skip Luna).
 */
export async function notifyCampaignReply(phone: string): Promise<boolean> {
  if (!CAMPAIGN_PLATFORM_URL || !WEBHOOK_SECRET) return false;

  try {
    const { data } = await axios.post(
      `${CAMPAIGN_PLATFORM_URL}/api/webhook/campaign-reply`,
      { phone },
      {
        headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
        timeout: 5000,
      },
    );
    console.log(`[campaignNotifier] Notified platform for ${phone} — found=${data.found}`);
    return data.found === true && (data.updated ?? 0) > 0;
  } catch (err: any) {
    console.error(`[campaignNotifier] Failed to notify platform:`, err.message);
    return false;
  }
}
