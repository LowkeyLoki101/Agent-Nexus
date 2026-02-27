/**
 * Social Media Posting Service
 *
 * Handles fan-out publishing to Twitter/X, Facebook, Instagram, and LinkedIn.
 * Platform credentials are stored encrypted in the social_credentials table
 * and are read from Replit Secrets (environment variables) at runtime.
 */

export type Platform = "twitter" | "facebook" | "instagram" | "linkedin";

export interface PlatformResult {
  success: boolean;
  postId?: string;
  error?: string;
  url?: string;
}

export type PublishResults = Record<string, PlatformResult>;

interface TwitterCredentials {
  bearerToken: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface FacebookCredentials {
  pageId: string;
  pageAccessToken: string;
}

interface InstagramCredentials {
  accountId: string;
  accessToken: string;
}

interface LinkedInCredentials {
  accessToken: string;
  personId: string;
}

// --- Twitter/X ---

async function postToTwitter(
  content: string,
  creds: TwitterCredentials
): Promise<PlatformResult> {
  try {
    // Twitter API v2 – create tweet
    // Uses OAuth 1.0a User Context via the consumer + access token combo
    // For simplicity we use the Bearer Token approach for app-level posting,
    // but production usage should use OAuth 1.0a with user context tokens.
    const { createHmac, randomBytes } = await import("crypto");

    const url = "https://api.twitter.com/2/tweets";
    const method = "POST";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");

    // Build OAuth 1.0a signature
    const params: Record<string, string> = {
      oauth_consumer_key: creds.apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_token: creds.accessToken,
      oauth_version: "1.0",
    };

    const paramString = Object.keys(params)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join("&");

    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(creds.apiSecret)}&${encodeURIComponent(creds.accessTokenSecret)}`;
    const signature = createHmac("sha1", signingKey)
      .update(signatureBase)
      .digest("base64");

    const authHeader =
      `OAuth oauth_consumer_key="${encodeURIComponent(creds.apiKey)}", ` +
      `oauth_nonce="${encodeURIComponent(nonce)}", ` +
      `oauth_signature="${encodeURIComponent(signature)}", ` +
      `oauth_signature_method="HMAC-SHA1", ` +
      `oauth_timestamp="${timestamp}", ` +
      `oauth_token="${encodeURIComponent(creds.accessToken)}", ` +
      `oauth_version="1.0"`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: content }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.detail || data?.title || `Twitter API error ${response.status}`,
      };
    }

    return {
      success: true,
      postId: data.data?.id,
      url: `https://twitter.com/i/status/${data.data?.id}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Twitter posting failed" };
  }
}

// --- Facebook ---

async function postToFacebook(
  content: string,
  creds: FacebookCredentials
): Promise<PlatformResult> {
  try {
    const url = `https://graph.facebook.com/v19.0/${creds.pageId}/feed`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: content,
        access_token: creds.pageAccessToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || `Facebook API error ${response.status}`,
      };
    }

    return {
      success: true,
      postId: data.id,
      url: `https://facebook.com/${data.id}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Facebook posting failed" };
  }
}

// --- Instagram ---

async function postToInstagram(
  content: string,
  creds: InstagramCredentials
): Promise<PlatformResult> {
  try {
    // Instagram Graph API requires media (image/video).
    // For text-only posts, Instagram doesn't support pure text – we note this.
    // This creates a "caption-only" container which requires an image_url in practice.
    // For the MVP, we'll attempt the creation and surface the API error clearly.
    const containerUrl = `https://graph.facebook.com/v19.0/${creds.accountId}/media`;
    const containerResp = await fetch(containerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: content,
        access_token: creds.accessToken,
      }),
    });

    const containerData = await containerResp.json();

    if (!containerResp.ok) {
      return {
        success: false,
        error:
          containerData?.error?.message ||
          "Instagram requires an image_url for posts. Text-only not supported.",
      };
    }

    // Publish the container
    const publishUrl = `https://graph.facebook.com/v19.0/${creds.accountId}/media_publish`;
    const publishResp = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: creds.accessToken,
      }),
    });

    const publishData = await publishResp.json();

    if (!publishResp.ok) {
      return {
        success: false,
        error: publishData?.error?.message || `Instagram publish error ${publishResp.status}`,
      };
    }

    return {
      success: true,
      postId: publishData.id,
      url: `https://instagram.com/p/${publishData.id}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Instagram posting failed" };
  }
}

// --- LinkedIn ---

async function postToLinkedIn(
  content: string,
  creds: LinkedInCredentials
): Promise<PlatformResult> {
  try {
    const url = "https://api.linkedin.com/v2/ugcPosts";
    const payload = {
      author: `urn:li:person:${creds.personId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        error: data?.message || `LinkedIn API error ${response.status}`,
      };
    }

    const postUrn = response.headers.get("x-restli-id") || "";

    return {
      success: true,
      postId: postUrn,
      url: postUrn ? `https://linkedin.com/feed/update/${postUrn}` : undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "LinkedIn posting failed" };
  }
}

// --- Fan-out publisher ---

/**
 * Publish content to multiple platforms simultaneously.
 * `credentialsByPlatform` maps each target platform to its parsed credentials.
 */
export async function publishToMultiplePlatforms(
  content: string,
  credentialsByPlatform: Record<string, any>
): Promise<PublishResults> {
  const results: PublishResults = {};

  const tasks: Promise<void>[] = [];

  for (const [platform, creds] of Object.entries(credentialsByPlatform)) {
    const task = (async () => {
      switch (platform as Platform) {
        case "twitter":
          results.twitter = await postToTwitter(content, creds as TwitterCredentials);
          break;
        case "facebook":
          results.facebook = await postToFacebook(content, creds as FacebookCredentials);
          break;
        case "instagram":
          results.instagram = await postToInstagram(content, creds as InstagramCredentials);
          break;
        case "linkedin":
          results.linkedin = await postToLinkedIn(content, creds as LinkedInCredentials);
          break;
        default:
          results[platform] = { success: false, error: `Unsupported platform: ${platform}` };
      }
    })();
    tasks.push(task);
  }

  await Promise.allSettled(tasks);

  return results;
}
