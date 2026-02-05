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
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a content analyzer. Analyze the given URL and provide structured information about its content.
          
Return a JSON object with:
{
  "title": "Page title",
  "content": "Main content extracted from the page",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "summary": "Brief summary of the page"
}

Use your knowledge to provide relevant information about what this URL likely contains.`
        },
        {
          role: "user",
          content: `Analyze this URL: ${url}`
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
