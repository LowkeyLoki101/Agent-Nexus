import { ElevenLabsClient } from "elevenlabs";

let connectionSettings: any;
let cachedApiKey: string | null = null;

async function getCredentials(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    console.error("[elevenlabs] REPLIT_CONNECTORS_HOSTNAME not set");
    throw new Error("ElevenLabs connector hostname not configured");
  }

  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    console.error("[elevenlabs] No REPL_IDENTITY or WEB_REPL_RENEWAL token found");
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  const url = "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=elevenlabs";
  console.log("[elevenlabs] Fetching credentials from connector...");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[elevenlabs] Connector returned ${response.status}: ${errorText}`);
      throw new Error(`ElevenLabs connector error: ${response.status}`);
    }

    const data = await response.json();
    connectionSettings = data.items?.[0];

    if (!connectionSettings || !connectionSettings.settings?.api_key) {
      console.error("[elevenlabs] No API key in connector response. Available items:", data.items?.length || 0);
      throw new Error("ElevenLabs not connected — no API key found in connector");
    }

    cachedApiKey = connectionSettings.settings.api_key;
    console.log("[elevenlabs] Credentials loaded successfully");
    return cachedApiKey;
  } catch (err: any) {
    console.error("[elevenlabs] Failed to get credentials:", err.message);
    throw err;
  }
}

export async function checkElevenLabsConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const apiKey = await getCredentials();
    const client = new ElevenLabsClient({ apiKey });
    const voices = await client.voices.getAll();
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

export async function getElevenLabsClient() {
  const apiKey = await getCredentials();
  return new ElevenLabsClient({ apiKey });
}

export async function generateNarration(
  text: string,
  voiceId?: string
): Promise<Buffer> {
  console.log(`[elevenlabs] Starting narration generation (${text.length} chars input)`);

  try {
    const client = await getElevenLabsClient();
    const voice = voiceId || "pMsXgVXv3BLzUgSXRplE";

    const maxChars = 4500;
    const cleanText = text
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const truncated = cleanText.length > maxChars ? cleanText.slice(0, maxChars) + "..." : cleanText;

    if (!truncated || truncated.length < 10) {
      throw new Error("Text too short for narration (need at least 10 characters)");
    }

    console.log(`[elevenlabs] Sending ${truncated.length} chars to TTS (voice: ${voice})`);

    const audioStream = await client.textToSpeech.convert(voice, {
      text: truncated,
      model_id: "eleven_flash_v2_5",
      output_format: "mp3_44100_128",
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }

    const result = Buffer.concat(chunks);
    console.log(`[elevenlabs] Narration generated successfully (${result.length} bytes)`);

    if (result.length < 100) {
      throw new Error("Generated audio file is suspiciously small — may be empty or corrupted");
    }

    return result;
  } catch (err: any) {
    console.error("[elevenlabs] Narration generation failed:", err.message);
    throw err;
  }
}
