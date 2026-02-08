import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface ResearchResult {
  query: string;
  results: SearchResult[];
  summary?: string;
  timestamp: Date;
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  keyPoints: string[];
  source: string;
  fetchedAt: Date;
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CreativeIntelligenceBot/1.0; +https://cb-creatives.replit.app)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/json")) {
      return null;
    }

    const html = await response.text();
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned.substring(0, 8000);
  } catch (error: any) {
    console.error(`[WebResearch] Failed to fetch ${url}:`, error.message);
    return null;
  }
}

export async function searchAndScrape(query: string, options?: {
  maxResults?: number;
  sources?: string[];
}): Promise<{ results: ScrapedContent[]; summary: string }> {
  const maxResults = options?.maxResults || 5;

  const searchResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a web research specialist. Given a search query, provide real, currently active URLs that are likely to have relevant content. Focus on:
- News sites (techcrunch.com, arstechnica.com, theverge.com, wired.com)
- Developer forums (dev.to, hackernews/news.ycombinator.com, stackoverflow.com)
- Research blogs (arxiv.org, blog posts from major AI companies)
- Social/community sites (reddit.com relevant subreddits)
- Industry sites relevant to the query

Return a JSON object:
{
  "urls": [
    {
      "url": "https://example.com/article",
      "title": "Expected article title",
      "source": "Site name",
      "relevance": "Why this is relevant to the query"
    }
  ]
}

Provide ${maxResults} URLs. Only suggest URLs that are likely to actually exist and return content. Prefer recent, high-quality sources.`
      },
      {
        role: "user",
        content: `Find relevant web pages for: ${query}${options?.sources ? `\nPrefer these types of sources: ${options.sources.join(", ")}` : ""}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const searchContent = searchResponse.choices[0]?.message?.content;
  if (!searchContent) return { results: [], summary: "No search results found." };

  let urls: Array<{ url: string; title: string; source: string; relevance: string }> = [];
  try {
    const parsed = JSON.parse(searchContent);
    urls = parsed.urls || [];
  } catch {
    return { results: [], summary: "Failed to parse search results." };
  }

  const scrapedResults: ScrapedContent[] = [];

  for (const urlInfo of urls.slice(0, maxResults)) {
    const pageContent = await fetchPageContent(urlInfo.url);
    if (pageContent && pageContent.length > 100) {
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Extract the key information from this web page content. Return a JSON object:
{
  "title": "The actual page title or best guess",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "summary": "A 2-3 sentence summary of the most important content"
}
Focus on extractable facts, opinions, trends, and actionable insights.`
          },
          {
            role: "user",
            content: `URL: ${urlInfo.url}\nSource: ${urlInfo.source}\n\nPage content:\n${pageContent.substring(0, 4000)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const analysis = analysisResponse.choices[0]?.message?.content;
      if (analysis) {
        try {
          const parsed = JSON.parse(analysis);
          scrapedResults.push({
            url: urlInfo.url,
            title: parsed.title || urlInfo.title,
            content: parsed.summary || "",
            keyPoints: parsed.keyPoints || [],
            source: urlInfo.source,
            fetchedAt: new Date(),
          });
        } catch {}
      }
    } else {
      scrapedResults.push({
        url: urlInfo.url,
        title: urlInfo.title,
        content: urlInfo.relevance,
        keyPoints: [],
        source: urlInfo.source,
        fetchedAt: new Date(),
      });
    }
  }

  let summary = `Found ${scrapedResults.length} results for "${query}"`;
  if (scrapedResults.length > 0) {
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Synthesize these web research findings into a brief, insightful summary. Highlight the most interesting discoveries, trends, and discussion-worthy points."
        },
        {
          role: "user",
          content: `Query: ${query}\n\nFindings:\n${scrapedResults.map(r => `[${r.source}] ${r.title}: ${r.content}\nKey points: ${r.keyPoints.join("; ")}`).join("\n\n")}`
        }
      ],
      temperature: 0.5,
      max_tokens: 500,
    });
    summary = summaryResponse.choices[0]?.message?.content || summary;
  }

  return { results: scrapedResults, summary };
}

export async function searchInternet(query: string, options?: {
  maxResults?: number;
  summarize?: boolean;
}): Promise<ResearchResult> {
  const maxResults = options?.maxResults || 10;
  const shouldSummarize = options?.summarize ?? true;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a research assistant. Search for information about the given query and return structured results.
          
Return a JSON object with the following structure:
{
  "results": [
    {
      "title": "Page title",
      "url": "https://example.com/page",
      "snippet": "Brief excerpt from the page content",
      "source": "Source name (e.g., Wikipedia, GitHub, etc.)"
    }
  ],
  "summary": "A comprehensive summary of the findings"
}

Provide accurate, up-to-date information from your knowledge. If you're not sure about specific URLs, use placeholder URLs that indicate the type of source.
Return at most ${maxResults} results.`
        },
        {
          role: "user",
          content: `Search for: ${query}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    return {
      query,
      results: parsed.results || [],
      summary: shouldSummarize ? parsed.summary : undefined,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("Web research error:", error);
    throw new Error("Failed to perform web research");
  }
}

export async function analyzeUrl(url: string): Promise<{
  title: string;
  content: string;
  keyPoints: string[];
  summary: string;
}> {
  try {
    const pageContent = await fetchPageContent(url);
    
    const prompt = pageContent
      ? `Analyze this web page content from ${url}:\n\n${pageContent.substring(0, 4000)}`
      : `Analyze this URL: ${url}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a content analyzer. Analyze the given web page content and provide structured information.
          
Return a JSON object with:
{
  "title": "Page title",
  "content": "Main content extracted from the page",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "summary": "Brief summary of the page"
}`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("URL analysis error:", error);
    throw new Error("Failed to analyze URL");
  }
}

export async function researchTopic(topic: string, depth: "quick" | "standard" | "deep" = "standard"): Promise<{
  topic: string;
  overview: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  sources: SearchResult[];
  recommendations: string[];
}> {
  const searchQueries = depth === "quick" ? 1 : depth === "deep" ? 5 : 3;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a comprehensive research assistant. Provide in-depth research on the given topic.
          
Return a JSON object with:
{
  "topic": "The research topic",
  "overview": "High-level overview of the topic",
  "sections": [
    {
      "title": "Section title",
      "content": "Detailed content for this section"
    }
  ],
  "sources": [
    {
      "title": "Source title",
      "url": "https://example.com",
      "snippet": "Brief description",
      "source": "Source type"
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Depth level: ${depth}
For ${depth} research, provide ${searchQueries === 1 ? "a brief" : searchQueries === 5 ? "comprehensive" : "standard"} analysis.`
        },
        {
          role: "user",
          content: `Research this topic: ${topic}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Topic research error:", error);
    throw new Error("Failed to research topic");
  }
}

export async function compareOptions(options: string[], criteria?: string[]): Promise<{
  options: string[];
  criteria: string[];
  comparison: Array<{
    option: string;
    scores: Record<string, number>;
    pros: string[];
    cons: string[];
  }>;
  recommendation: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an analysis expert. Compare the given options objectively.
          
Return a JSON object with:
{
  "options": ["Option 1", "Option 2"],
  "criteria": ["Criterion 1", "Criterion 2"],
  "comparison": [
    {
      "option": "Option name",
      "scores": {"Criterion 1": 8, "Criterion 2": 7},
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"]
    }
  ],
  "recommendation": "Based on the analysis, the best option is..."
}

Score each criterion from 1-10.`
        },
        {
          role: "user",
          content: `Compare these options: ${options.join(", ")}${criteria ? `\nCriteria to evaluate: ${criteria.join(", ")}` : ""}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Options comparison error:", error);
    throw new Error("Failed to compare options");
  }
}
