// QA System Type Definitions

export interface QAMetrics {
  // Traditional QA Metrics
  defectDensity: number;
  testCoverage: number;
  passRate: number;
  failRate: number;
  
  // AI/NLP Specific Metrics
  bleuScore: number;
  rougeScore: number;
  semanticSimilarity: number;
  intentAccuracy: number;
  sentimentScore: number;
  responseRelevance: number;
  
  // Conversation Quality Metrics
  conversationCompletionRate: number;
  averageResponseTime: number;
  tokenEfficiency: number;
  contextMaintenance: number;
  
  // Business Metrics
  userSatisfaction: number;
  taskSuccessRate: number;
  escalationRate: number;
  resolutionTime: number;
}

export interface ConversationSpan {
  id: string;
  startIndex: number;
  endIndex: number;
  text: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  evaluation?: SpanEvaluation;
}

export interface SpanEvaluation {
  score: number; // 0-100
  bleuScore?: number;
  rougeScore?: number;
  semanticSimilarity?: number;
  intentAccuracy?: number;
  sentimentScore?: number;
  issues: QAIssue[];
  annotations: Annotation[];
  evaluatedBy: string;
  evaluatedAt: Date;
}

export interface QAIssue {
  id: string;
  type: 'accuracy' | 'relevance' | 'tone' | 'completeness' | 'safety' | 'hallucination';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion?: string;
  automated: boolean;
}

export interface Annotation {
  id: string;
  spanId: string;
  type: 'correct' | 'incorrect' | 'partial' | 'irrelevant';
  comment?: string;
  annotator: string;
  timestamp: Date;
}

export interface ConversationFlow {
  id: string;
  steps: FlowStep[];
  successRate: number;
  averageSteps: number;
  dropoffPoints: string[];
}

export interface FlowStep {
  id: string;
  name: string;
  intent: string;
  success: boolean;
  duration: number;
  nextSteps: string[];
}

export interface QAReport {
  id: string;
  botId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: QAMetrics;
  conversationCount: number;
  issueBreakdown: Record<string, number>;
  trends: MetricTrend[];
  recommendations: string[];
}

export interface MetricTrend {
  metric: keyof QAMetrics;
  values: { date: Date; value: number }[];
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export interface HeatmapData {
  hour: number;
  day: string;
  value: number;
  metric: string;
}

export interface ConversationPattern {
  pattern: string;
  frequency: number;
  averageScore: number;
  commonIssues: string[];
}

export interface QualityDistribution {
  range: string;
  count: number;
  percentage: number;
  examples: string[];
}

export interface ConversationAnalysis {
  id: string;
  userId: string;
  botId: string;
  startTime: Date;
  endTime: Date;
  spans: ConversationSpan[];
  overallScore: number;
  metrics: Partial<QAMetrics>;
  flow: ConversationFlow;
  summary: {
    intent: string;
    resolved: boolean;
    satisfaction: number;
    keyTopics: string[];
  };
}