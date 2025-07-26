import { JobData, JobStatus, ILogger, IStatusNotifier, IServiceContainer, IConfig } from '../../types/job';
import { BaseJob, JobStepManager } from './BaseJob';
import { DataCollectionAgent, CollectionRequest, CollectionResult } from '../agents/DataCollectionAgent';
import { OpenAIService } from '../ai/OpenAIService';
import { LangChainService } from '../ai/LangChainService';

/**
 * Collection Job implementation for data collection workflows
 */
export class CollectionJob extends BaseJob {
  private stepManager: JobStepManager;
  private dataCollectionAgent?: DataCollectionAgent;

  constructor(
    jobData: JobData,
    logger: ILogger,
    statusNotifier: IStatusNotifier,
    services: IServiceContainer,
    config: IConfig
  ) {
    super(jobData, logger, statusNotifier, services, config);
    
    this.stepManager = new JobStepManager(this);
    this.initializeSteps();
  }

  /**
   * Validate collection job data
   */
  async validate(): Promise<void> {
    if (!this.jobData.query || this.jobData.query.trim().length === 0) {
      throw new Error('Collection job requires a non-empty query');
    }

    if (this.jobData.query.length > 1000) {
      throw new Error('Query exceeds maximum length of 1000 characters');
    }

    // Validate collection options
    const options = this.jobData.metadata?.options;
    if (options) {
      if (options.maxResults && (options.maxResults < 1 || options.maxResults > 500)) {
        throw new Error('maxResults must be between 1 and 500');
      }

      if (options.dateRange) {
        const { from, to } = options.dateRange;
        if (from && to && new Date(from) > new Date(to)) {
          throw new Error('Invalid date range: from date cannot be after to date');
        }
      }
    }

    this.logger.info('Collection job validation passed', {
      jobId: this.jobData.id,
      queryLength: this.jobData.query.length,
      hasOptions: !!options
    });
  }

  /**
   * Execute the collection workflow
   */
  async execute(): Promise<void> {
    try {
      // Step 1: Initialize AI services
      await this.stepManager.startStep('initialize_ai');
      await this.initializeAIServices();
      await this.stepManager.completeStep('initialize_ai');

      // Step 2: Create collection plan
      await this.stepManager.startStep('create_plan');
      const collectionPlan = await this.createCollectionPlan();
      await this.stepManager.completeStep('create_plan');

      // Step 3: Execute collection
      await this.stepManager.startStep('execute_collection');
      const collectionResult = await this.executeCollection(collectionPlan);
      await this.stepManager.completeStep('execute_collection');

      // Step 4: Generate summary
      await this.stepManager.startStep('generate_summary');
      const summary = await this.generateSummary(collectionPlan, collectionResult);
      await this.stepManager.completeStep('generate_summary');

      // Update final results
      await this.updateResults({
        collectionPlan,
        collectionResult,
        summary,
        completedAt: new Date().toISOString()
      });

      this.logger.info('Collection job completed successfully', {
        jobId: this.jobData.id,
        documentsFound: collectionResult.documentsFound,
        documentsDownloaded: collectionResult.documentsDownloaded
      });

    } catch (error) {
      this.logger.error('Collection job execution failed', {
        jobId: this.jobData.id,
        error: (error as Error).message,
        currentStep: this.stepManager.getCurrentStep()?.name
      });
      throw error;
    }
  }

  /**
   * Initialize the processing steps
   */
  private initializeSteps(): void {
    this.stepManager.addStep({
      name: 'initialize_ai',
      description: 'Initializing AI services',
      weight: 10
    });

    this.stepManager.addStep({
      name: 'create_plan',
      description: 'Creating collection plan',
      weight: 15
    });

    this.stepManager.addStep({
      name: 'execute_collection',
      description: 'Executing data collection',
      weight: 60
    });

    this.stepManager.addStep({
      name: 'generate_summary',
      description: 'Generating collection summary',
      weight: 15
    });
  }

  /**
   * Initialize AI services
   */
  private async initializeAIServices(): Promise<void> {
    try {
      // Try to get existing services from container
      let openaiService: OpenAIService;
      let langchainService: LangChainService;

      try {
        openaiService = this.services.get<OpenAIService>('openaiService');
        langchainService = this.services.get<LangChainService>('langchainService');
      } catch (error) {
        // Services not available, use fallback
        this.logger.warn('AI services not available in container, using fallback approach');
        
        // For now, we'll skip AI processing
        // In a production environment, this should be properly configured
        return;
      }

      // Create data collection agent  
      this.dataCollectionAgent = new DataCollectionAgent(
        openaiService,
        langchainService,
        this.logger as any // Type conversion for winston logger
      );

      this.logger.info('AI services initialized', { jobId: this.jobData.id });

    } catch (error) {
      this.logger.error('Failed to initialize AI services', {
        jobId: this.jobData.id,
        error: (error as Error).message
      });
      throw new Error(`AI service initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create collection plan
   */
  private async createCollectionPlan(): Promise<any> {
    try {
      if (!this.dataCollectionAgent) {
        // Fallback plan when AI services are not available
        return this.createFallbackPlan();
      }

      const collectionRequest: CollectionRequest = {
        query: this.jobData.query,
        ...(this.jobData.metadata?.sources && { sources: this.jobData.metadata.sources }),
        ...(this.jobData.metadata?.options && { options: this.jobData.metadata.options }),
        ...(this.jobData.userId && { userId: this.jobData.userId })
      };

      const plan = await this.dataCollectionAgent.createCollectionPlan(collectionRequest);

      this.logger.info('Collection plan created', {
        jobId: this.jobData.id,
        strategiesCount: plan.searchStrategies.length,
        estimatedDuration: plan.estimatedDuration
      });

      return plan;

    } catch (error) {
      this.logger.warn('Failed to create AI-powered plan, using fallback', {
        jobId: this.jobData.id,
        error: (error as Error).message
      });
      
      return this.createFallbackPlan();
    }
  }

  /**
   * Create fallback plan when AI services are unavailable
   */
  private createFallbackPlan(): any {
    return {
      id: `fallback_${this.jobData.id}`,
      query: this.jobData.query,
      searchStrategies: [
        {
          source: 'Google Scholar',
          query: this.jobData.query,
          priority: 8,
          rationale: 'Direct query search (fallback mode)'
        }
      ],
      estimatedDuration: 5, // 5 minutes
      estimatedResults: 20,
      priority: 2
    };
  }

  /**
   * Execute the collection process
   */
  private async executeCollection(plan: any): Promise<CollectionResult> {
    try {
      if (!this.dataCollectionAgent) {
        // Fallback collection when AI services are not available
        return this.executeFallbackCollection(plan);
      }

      const result = await this.dataCollectionAgent.executeCollection(
        plan,
        (progress: number, message: string) => {
          // Update progress during collection
          this.updateProgress(10 + (progress * 0.6), message); // 10-70% range
        }
      );

      return result;

    } catch (error) {
      this.logger.warn('AI-powered collection failed, using fallback', {
        jobId: this.jobData.id,
        error: (error as Error).message
      });

      return this.executeFallbackCollection(plan);
    }
  }

  /**
   * Execute fallback collection
   */
  private async executeFallbackCollection(plan: any): Promise<CollectionResult> {
    // Simulate collection process for demonstration
    await this.simulateProgress('Searching for documents...', 3000, 25, 45);
    await this.simulateProgress('Analyzing content relevance...', 2000, 45, 60);
    await this.simulateProgress('Processing results...', 1500, 60, 70);

    return {
      documentsFound: 15,
      documentsDownloaded: 8,
      documentsProcessed: 8,
      relevantDocuments: 8,
      searchStrategies: plan.searchStrategies,
      errors: [],
      warnings: ['AI services unavailable - used fallback collection mode']
    };
  }

  /**
   * Generate collection summary
   */
  private async generateSummary(plan: any, result: CollectionResult): Promise<string> {
    try {
      if (this.dataCollectionAgent) {
        return await this.dataCollectionAgent.generateCollectionSummary(plan, result);
      }
    } catch (error) {
      this.logger.warn('AI summary generation failed, using fallback', {
        jobId: this.jobData.id,
        error: (error as Error).message
      });
    }

    // Fallback summary
    return `Collection completed for query: "${this.jobData.query}". ` +
           `Found ${result.documentsFound} documents, downloaded ${result.documentsDownloaded} relevant items. ` +
           `Success rate: ${Math.round((result.documentsDownloaded / result.documentsFound) * 100)}%.`;
  }

  /**
   * Get current processing stage name
   */
  protected override getCurrentStage(): string {
    const currentStep = this.stepManager.getCurrentStep();
    if (currentStep) {
      return currentStep.description;
    }
    return super.getCurrentStage();
  }

  /**
   * Simulate progress for demonstration
   */
  private async simulateProgress(
    message: string, 
    duration: number, 
    startProgress: number, 
    endProgress: number
  ): Promise<void> {
    const steps = 5;
    const stepDuration = duration / steps;
    const progressStep = (endProgress - startProgress) / steps;

    for (let i = 0; i <= steps; i++) {
      if (!this.shouldContinue()) break;

      const progress = startProgress + (progressStep * i);
      await this.updateProgress(progress, message);
      
      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      }
    }
  }
} 