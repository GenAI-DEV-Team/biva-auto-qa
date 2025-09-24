// QA Metrics Calculation Utilities

import { QAMetrics, ConversationAnalysis, SpanEvaluation, MetricTrend } from '@/types/qa';

export class MetricsCalculator {
  // Calculate BLEU Score (approximation)
  static calculateBLEUScore(reference: string, candidate: string): number {
    const refTokens = reference.toLowerCase().split(/\s+/);
    const candTokens = candidate.toLowerCase().split(/\s+/);
    
    if (candTokens.length === 0) return 0;
    
    // Simple unigram precision
    const matches = candTokens.filter(token => refTokens.includes(token)).length;
    return Math.min(matches / candTokens.length, 1.0) * 100;
  }

  // Calculate ROUGE-L Score (approximation)
  static calculateROUGEScore(reference: string, candidate: string): number {
    const refTokens = reference.toLowerCase().split(/\s+/);
    const candTokens = candidate.toLowerCase().split(/\s+/);
    
    const lcs = this.longestCommonSubsequence(refTokens, candTokens);
    const precision = lcs / candTokens.length;
    const recall = lcs / refTokens.length;
    
    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall) * 100;
  }

  // Calculate Semantic Similarity (using word overlap as approximation)
  static calculateSemanticSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
  }

  // Calculate Intent Accuracy
  static calculateIntentAccuracy(predictedIntent: string, actualIntent: string): number {
    return predictedIntent.toLowerCase() === actualIntent.toLowerCase() ? 100 : 0;
  }

  // Calculate Sentiment Score (-100 to 100)
  static calculateSentimentScore(text: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'perfect', 'love', 'best'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'disgusting', 'poor'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 10;
      if (negativeWords.includes(word)) score -= 10;
    });
    
    return Math.max(-100, Math.min(100, score));
  }

  // Calculate Response Relevance
  static calculateResponseRelevance(userMessage: string, botResponse: string): number {
    // Simple keyword overlap method
    const userKeywords = this.extractKeywords(userMessage);
    const responseKeywords = this.extractKeywords(botResponse);
    
    if (userKeywords.length === 0) return 50; // neutral if no keywords
    
    const relevantKeywords = userKeywords.filter(keyword => 
      responseKeywords.some(respKeyword => 
        respKeyword.includes(keyword) || keyword.includes(respKeyword)
      )
    );
    
    return (relevantKeywords.length / userKeywords.length) * 100;
  }

  // Calculate Token Efficiency
  static calculateTokenEfficiency(response: string, requiredInfo: string[]): number {
    const tokens = response.split(/\s+/).length;
    const infoProvided = requiredInfo.filter(info => 
      response.toLowerCase().includes(info.toLowerCase())
    ).length;
    
    if (requiredInfo.length === 0) return 100;
    
    const informationDensity = infoProvided / requiredInfo.length;
    const lengthPenalty = Math.max(0, 1 - (tokens - 20) / 100); // Penalize if too long
    
    return Math.max(0, informationDensity * lengthPenalty * 100);
  }

  // Aggregate QA metrics from conversation analysis
  static aggregateQAMetrics(conversations: ConversationAnalysis[]): QAMetrics {
    if (conversations.length === 0) {
      return this.getDefaultMetrics();
    }

    const totalConversations = conversations.length;
    const completedConversations = conversations.filter(c => c.summary.resolved).length;
    const totalSpans = conversations.reduce((sum, c) => sum + c.spans.length, 0);
    const evaluatedSpans = conversations.reduce((sum, c) => 
      sum + c.spans.filter(s => s.evaluation).length, 0
    );

    // Calculate averages
    const avgBleuScore = this.calculateAverage(conversations, 'bleuScore');
    const avgRougeScore = this.calculateAverage(conversations, 'rougeScore');
    const avgSemanticSimilarity = this.calculateAverage(conversations, 'semanticSimilarity');
    const avgIntentAccuracy = this.calculateAverage(conversations, 'intentAccuracy');
    const avgSentimentScore = this.calculateAverage(conversations, 'sentimentScore');
    const avgResponseRelevance = this.calculateAverage(conversations, 'responseRelevance');

    return {
      defectDensity: this.calculateDefectDensity(conversations),
      testCoverage: (evaluatedSpans / totalSpans) * 100,
      passRate: this.calculatePassRate(conversations),
      failRate: this.calculateFailRate(conversations),
      
      bleuScore: avgBleuScore,
      rougeScore: avgRougeScore,
      semanticSimilarity: avgSemanticSimilarity,
      intentAccuracy: avgIntentAccuracy,
      sentimentScore: avgSentimentScore,
      responseRelevance: avgResponseRelevance,
      
      conversationCompletionRate: (completedConversations / totalConversations) * 100,
      averageResponseTime: this.calculateAverageResponseTime(conversations),
      tokenEfficiency: this.calculateAverageTokenEfficiency(conversations),
      contextMaintenance: this.calculateContextMaintenance(conversations),
      
      userSatisfaction: this.calculateAverageUserSatisfaction(conversations),
      taskSuccessRate: (completedConversations / totalConversations) * 100,
      escalationRate: this.calculateEscalationRate(conversations),
      resolutionTime: this.calculateAverageResolutionTime(conversations)
    };
  }

  // Generate trend data
  static generateTrendData(
    historicalData: { date: Date; metrics: Partial<QAMetrics> }[],
    metric: keyof QAMetrics
  ): MetricTrend {
    const values = historicalData
      .filter(d => d.metrics[metric] !== undefined)
      .map(d => ({ date: d.date, value: d.metrics[metric] as number }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (values.length < 2) {
      return {
        metric,
        values,
        trend: 'stable',
        changePercent: 0
      };
    }

    const firstValue = values[0].value;
    const lastValue = values[values.length - 1].value;
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) {
      trend = changePercent > 0 ? 'up' : 'down';
    }

    return {
      metric,
      values,
      trend,
      changePercent
    };
  }

  // Helper methods
  private static longestCommonSubsequence(seq1: string[], seq2: string[]): number {
    const dp = Array(seq1.length + 1).fill(null).map(() => Array(seq2.length + 1).fill(0));
    
    for (let i = 1; i <= seq1.length; i++) {
      for (let j = 1; j <= seq2.length; j++) {
        if (seq1[i - 1] === seq2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    return dp[seq1.length][seq2.length];
  }

  private static extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may']);
    
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index); // unique
  }

  private static calculateAverage(conversations: ConversationAnalysis[], metric: string): number {
    const values: number[] = [];
    
    conversations.forEach(conv => {
      conv.spans.forEach(span => {
        if (span.evaluation && (span.evaluation as any)[metric] !== undefined) {
          values.push((span.evaluation as any)[metric]);
        }
      });
    });
    
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private static calculateDefectDensity(conversations: ConversationAnalysis[]): number {
    const totalSpans = conversations.reduce((sum, c) => sum + c.spans.length, 0);
    const defectiveSpans = conversations.reduce((sum, c) => 
      sum + c.spans.filter(s => s.evaluation && s.evaluation.issues.length > 0).length, 0
    );
    
    return totalSpans > 0 ? (defectiveSpans / totalSpans) * 100 : 0;
  }

  private static calculatePassRate(conversations: ConversationAnalysis[]): number {
    const evaluatedSpans = conversations.reduce((sum, c) => 
      sum + c.spans.filter(s => s.evaluation).length, 0
    );
    const passedSpans = conversations.reduce((sum, c) => 
      sum + c.spans.filter(s => s.evaluation && s.evaluation.score >= 70).length, 0
    );
    
    return evaluatedSpans > 0 ? (passedSpans / evaluatedSpans) * 100 : 0;
  }

  private static calculateFailRate(conversations: ConversationAnalysis[]): number {
    const evaluatedSpans = conversations.reduce((sum, c) => 
      sum + c.spans.filter(s => s.evaluation).length, 0
    );
    const failedSpans = conversations.reduce((sum, c) => 
      sum + c.spans.filter(s => s.evaluation && s.evaluation.score < 50).length, 0
    );
    
    return evaluatedSpans > 0 ? (failedSpans / evaluatedSpans) * 100 : 0;
  }

  private static calculateAverageResponseTime(conversations: ConversationAnalysis[]): number {
    const responseTimes: number[] = [];
    
    conversations.forEach(conv => {
      for (let i = 1; i < conv.spans.length; i += 2) {
        if (conv.spans[i].type === 'assistant' && conv.spans[i - 1].type === 'user') {
          const responseTime = conv.spans[i].timestamp.getTime() - conv.spans[i - 1].timestamp.getTime();
          responseTimes.push(responseTime / 1000); // Convert to seconds
        }
      }
    });
    
    return responseTimes.length > 0 ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
  }

  private static calculateAverageTokenEfficiency(conversations: ConversationAnalysis[]): number {
    // Mock calculation - in real implementation, you'd calculate actual token efficiency
    return 75 + Math.random() * 20; // 75-95%
  }

  private static calculateContextMaintenance(conversations: ConversationAnalysis[]): number {
    // Mock calculation - measure how well context is maintained across conversation
    return 80 + Math.random() * 15; // 80-95%
  }

  private static calculateAverageUserSatisfaction(conversations: ConversationAnalysis[]): number {
    const satisfactionScores = conversations
      .map(c => c.summary.satisfaction)
      .filter(score => score > 0);
    
    return satisfactionScores.length > 0 ? 
      satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length : 0;
  }

  private static calculateEscalationRate(conversations: ConversationAnalysis[]): number {
    // Mock calculation - percentage of conversations that needed escalation
    return 5 + Math.random() * 10; // 5-15%
  }

  private static calculateAverageResolutionTime(conversations: ConversationAnalysis[]): number {
    const resolutionTimes = conversations
      .filter(c => c.summary.resolved)
      .map(c => (c.endTime.getTime() - c.startTime.getTime()) / 1000 / 60); // minutes
    
    return resolutionTimes.length > 0 ? 
      resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;
  }

  private static getDefaultMetrics(): QAMetrics {
    return {
      defectDensity: 0,
      testCoverage: 0,
      passRate: 0,
      failRate: 0,
      bleuScore: 0,
      rougeScore: 0,
      semanticSimilarity: 0,
      intentAccuracy: 0,
      sentimentScore: 0,
      responseRelevance: 0,
      conversationCompletionRate: 0,
      averageResponseTime: 0,
      tokenEfficiency: 0,
      contextMaintenance: 0,
      userSatisfaction: 0,
      taskSuccessRate: 0,
      escalationRate: 0,
      resolutionTime: 0
    };
  }
}