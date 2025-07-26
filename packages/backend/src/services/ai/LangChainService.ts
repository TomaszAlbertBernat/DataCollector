import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import winston from 'winston';

import { OpenAIService, ChatMessage } from './OpenAIService';

export interface QueryAnalysisResult {
  topic: string;
  keywords: string[];
  sources: string[];
  searchStrategies: SearchStrategy[];
  estimatedResults: number;
  confidence: number;
}

export interface SearchStrategy {
  source: string;
  query: string;
  priority: number;
  rationale: string;
}

export interface ContentAnalysisResult {
  summary: string;
  relevanceScore: number;
  keyTopics: string[];
  extractedData: Record<string, any>;
  shouldDownload: boolean;
  reasoning: string;
}

export interface DocumentChunk {
  content: string;
  metadata: Record<string, any>;
  index: number;
}

export class LangChainService {
  private chatModel: ChatOpenAI;
  private openaiService: OpenAIService;
  private logger: winston.Logger;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(openaiService: OpenAIService, logger: winston.Logger) {
    this.openaiService = openaiService;
    this.logger = logger;

    // Initialize ChatOpenAI model
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.chatModel = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
      maxTokens: Number(process.env.OPENAI_MAX_TOKENS) || 4000,
    });

    // Initialize text splitter for document processing
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', '']
    });

    this.logger.info('LangChain service initialized');
  }

  /**
   * Analyze user query to generate search strategies
   */
  async analyzeQuery(query: string): Promise<QueryAnalysisResult> {
    try {
      const promptTemplate = new PromptTemplate({
        template: `You are an expert research assistant. Analyze the following research query and provide a detailed analysis.

Query: {query}

Provide your analysis in the following JSON format:
{{
  "topic": "main research topic",
  "keywords": ["key", "terms", "list"],
  "sources": ["suggested", "academic", "sources"],
  "searchStrategies": [
    {{
      "source": "Google Scholar",
      "query": "optimized search query for this source",
      "priority": 1-10,
      "rationale": "why this query and source combination"
    }}
  ],
  "estimatedResults": number,
  "confidence": 0.0-1.0
}}

Focus on academic and research sources. Suggest multiple search strategies with different keyword combinations.
Consider synonyms, related terms, and different phrasings that might yield better results.`,
        inputVariables: ['query']
      });

      const chain = promptTemplate.pipe(this.chatModel);
      const result = await chain.invoke({ query });
      
      // Parse the JSON response
      const analysisText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      let analysis: QueryAnalysisResult;

      try {
        analysis = JSON.parse(analysisText);
      } catch (parseError) {
        this.logger.warn('Failed to parse query analysis JSON, using fallback');
        analysis = this.createFallbackAnalysis(query);
      }

      this.logger.info('Query analysis completed', {
        query: query.substring(0, 100),
        strategiesCount: analysis.searchStrategies.length,
        confidence: analysis.confidence
      });

      return analysis;

    } catch (error) {
      this.logger.error('Query analysis failed', {
        query: query.substring(0, 100),
        error: (error as Error).message
      });
      
      // Return fallback analysis
      return this.createFallbackAnalysis(query);
    }
  }

  /**
   * Analyze content relevance and decide if it should be downloaded
   */
  async analyzeContentRelevance(
    query: string,
    contentPreview: string,
    metadata: Record<string, any> = {}
  ): Promise<ContentAnalysisResult> {
    try {
      const promptTemplate = new PromptTemplate({
        template: `You are an expert research assistant. Analyze the relevance of this content to the research query.

Research Query: {query}

Content Preview: {content}

Metadata: {metadata}

Analyze the content and provide your assessment in JSON format:
{{
  "summary": "brief summary of the content",
  "relevanceScore": 0.0-1.0,
  "keyTopics": ["extracted", "topics"],
  "extractedData": {{
    "authors": ["if available"],
    "publicationDate": "if available",
    "journal": "if available",
    "doi": "if available"
  }},
  "shouldDownload": true/false,
  "reasoning": "detailed explanation of your decision"
}}

Consider:
- How well does the content match the research query?
- Is this academic/research content or just general information?
- What is the quality and credibility of the source?
- Are there specific data points, findings, or insights relevant to the query?`,
        inputVariables: ['query', 'content', 'metadata']
      });

      const chain = promptTemplate.pipe(this.chatModel);
      const result = await chain.invoke({
        query,
        content: contentPreview.substring(0, 2000), // Limit content size
        metadata: JSON.stringify(metadata, null, 2)
      });

      let analysis: ContentAnalysisResult;

      try {
        const contentText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        analysis = JSON.parse(contentText);
      } catch (parseError) {
        this.logger.warn('Failed to parse content analysis JSON, using fallback');
        analysis = this.createFallbackContentAnalysis(contentPreview);
      }

      this.logger.debug('Content analysis completed', {
        relevanceScore: analysis.relevanceScore,
        shouldDownload: analysis.shouldDownload
      });

      return analysis;

    } catch (error) {
      this.logger.error('Content analysis failed', {
        error: (error as Error).message
      });
      
      return this.createFallbackContentAnalysis(contentPreview);
    }
  }

  /**
   * Generate improved search queries based on initial results
   */
  async generateImprovedQueries(
    originalQuery: string,
    results: Array<{ title: string; snippet: string; source: string }>
  ): Promise<string[]> {
    try {
      const promptTemplate = new PromptTemplate({
        template: `Based on the original query and the search results found, suggest improved search queries that might find better or additional relevant content.

Original Query: {query}

Search Results:
{results}

Generate 3-5 improved search queries that:
1. Use different keyword combinations
2. Target specific aspects of the research topic
3. Include synonyms or related terms
4. Might uncover different perspectives or methodologies

Return as a JSON array of strings:
["improved query 1", "improved query 2", "improved query 3"]`,
        inputVariables: ['query', 'results']
      });

      const chain = promptTemplate.pipe(this.chatModel);

      const resultsText = results.map((r, i) => 
        `${i + 1}. ${r.title} (${r.source})\n   ${r.snippet}`
      ).join('\n\n');

      const result = await chain.invoke({
        query: originalQuery,
        results: resultsText
      });

      let improvedQueries: string[];

      try {
        const contentText = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        improvedQueries = JSON.parse(contentText);
      } catch (parseError) {
        this.logger.warn('Failed to parse improved queries JSON');
        improvedQueries = [originalQuery]; // Fallback to original
      }

      this.logger.info('Generated improved queries', {
        originalQuery: originalQuery.substring(0, 50),
        improvedCount: improvedQueries.length
      });

      return improvedQueries;

    } catch (error) {
      this.logger.error('Failed to generate improved queries', {
        error: (error as Error).message
      });
      return [originalQuery];
    }
  }

  /**
   * Chunk document text for processing
   */
  async chunkDocument(text: string, metadata: Record<string, any> = {}): Promise<DocumentChunk[]> {
    try {
      const docs = await this.textSplitter.createDocuments([text], [metadata]);
      
      const chunks: DocumentChunk[] = docs.map((doc, index) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        index
      }));

      this.logger.debug('Document chunked', {
        originalLength: text.length,
        chunksCreated: chunks.length
      });

      return chunks;

    } catch (error) {
      this.logger.error('Document chunking failed', {
        error: (error as Error).message,
        textLength: text.length
      });
      throw error;
    }
  }

  /**
   * Generate summary of multiple documents
   */
  async generateDocumentSummary(documents: Array<{ title: string; content: string }>): Promise<string> {
    try {
      const promptTemplate = new PromptTemplate({
        template: `Analyze and summarize the following research documents. Provide a comprehensive summary that:

1. Identifies the main themes and findings
2. Highlights key insights and conclusions
3. Notes any conflicting viewpoints or methodologies
4. Suggests areas for further research

Documents:
{documents}

Provide a well-structured summary (aim for 300-500 words):`,
        inputVariables: ['documents']
      });

      const chain = promptTemplate.pipe(this.chatModel);

      const documentsText = documents.map((doc, i) => 
        `Document ${i + 1}: ${doc.title}\n${doc.content.substring(0, 1000)}...`
      ).join('\n\n---\n\n');

      const result = await chain.invoke({
        documents: documentsText
      });

      this.logger.info('Document summary generated', {
        documentCount: documents.length,
        summaryLength: result.text.length
      });

      return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

    } catch (error) {
      this.logger.error('Document summary generation failed', {
        error: (error as Error).message,
        documentCount: documents.length
      });
      throw error;
    }
  }

  /**
   * Create fallback analysis when AI processing fails
   */
  private createFallbackAnalysis(query: string): QueryAnalysisResult {
    const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return {
      topic: query,
      keywords,
      sources: ['Google Scholar', 'PubMed', 'arXiv'],
      searchStrategies: [
        {
          source: 'Google Scholar',
          query: query,
          priority: 8,
          rationale: 'Direct query search on primary academic source'
        }
      ],
      estimatedResults: 100,
      confidence: 0.5
    };
  }

  /**
   * Create fallback content analysis when AI processing fails
   */
  private createFallbackContentAnalysis(content: string): ContentAnalysisResult {
    return {
      summary: content.substring(0, 200) + '...',
      relevanceScore: 0.5,
      keyTopics: [],
      extractedData: {},
      shouldDownload: true, // Conservative approach - download when unsure
      reasoning: 'Fallback analysis due to processing error'
    };
  }
}

// Factory function for creating LangChain service
export const createLangChainService = (
  openaiService: OpenAIService,
  logger: winston.Logger
): LangChainService => {
  return new LangChainService(openaiService, logger);
}; 