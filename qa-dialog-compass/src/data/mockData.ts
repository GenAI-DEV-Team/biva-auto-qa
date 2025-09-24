// Mock Data for QA System

import { ConversationAnalysis, QAMetrics, MetricTrend, HeatmapData, SpanEvaluation, QAIssue } from '@/types/qa';
import { MetricsCalculator } from '@/utils/metrics';

// Generate mock conversation data
export function generateMockConversations(): ConversationAnalysis[] {
  const conversations: ConversationAnalysis[] = [];
  
  for (let i = 0; i < 50; i++) {
    const startTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + (5 + Math.random() * 20) * 60 * 1000);
    
    const userMessages = [
      "Hi, I need help with my order",
      "What are your business hours?",
      "I want to cancel my subscription",
      "How do I reset my password?",
      "Can you help me track my package?",
      "I'm having trouble logging in",
      "What's your return policy?",
      "I need to update my payment method",
      "Can you explain the pricing?",
      "I have a billing question"
    ];
    
    const botResponses = [
      "I'd be happy to help you with your order. Can you provide your order number?",
      "Our business hours are Monday-Friday 9 AM to 6 PM EST.",
      "I can help you cancel your subscription. Let me check your account details.",
      "To reset your password, please click on 'Forgot Password' on the login page.",
      "I can help you track your package. Please provide your tracking number.",
      "I understand you're having login issues. Let me help you troubleshoot this.",
      "Our return policy allows returns within 30 days of purchase with original receipt.",
      "I can help you update your payment method. Please go to Account Settings.",
      "I'd be happy to explain our pricing plans. We have three tiers available.",
      "I can help with your billing question. What specific issue are you experiencing?"
    ];
    
    const randomUserMsg = userMessages[Math.floor(Math.random() * userMessages.length)];
    const randomBotMsg = botResponses[Math.floor(Math.random() * botResponses.length)];
    
    // Create spans with evaluations
    const spans = [
      {
        id: `span_${i}_user`,
        startIndex: 0,
        endIndex: randomUserMsg.length,
        text: randomUserMsg,
        type: 'user' as const,
        timestamp: startTime
      },
      {
        id: `span_${i}_bot`,
        startIndex: 0,
        endIndex: randomBotMsg.length,
        text: randomBotMsg,
        type: 'assistant' as const,
        timestamp: new Date(startTime.getTime() + 30000),
        evaluation: generateSpanEvaluation(randomUserMsg, randomBotMsg)
      }
    ];
    
    // Sometimes add follow-up messages
    if (Math.random() > 0.3) {
      const followUpUser = "Thank you for your help!";
      const followUpBot = "You're welcome! Is there anything else I can help you with?";
      
      spans.push(
        {
          id: `span_${i}_user_2`,
          startIndex: 0,
          endIndex: followUpUser.length,
          text: followUpUser,
          type: 'user' as const,
          timestamp: new Date(startTime.getTime() + 120000)
        },
        {
          id: `span_${i}_bot_2`,
          startIndex: 0,
          endIndex: followUpBot.length,
          text: followUpBot,
          type: 'assistant' as const,
          timestamp: new Date(startTime.getTime() + 150000),
          evaluation: generateSpanEvaluation(followUpUser, followUpBot)
        }
      );
    }
    
    const overallScore = spans
      .filter(s => s.evaluation)
      .reduce((sum, s) => sum + (s.evaluation?.score || 0), 0) / spans.filter(s => s.evaluation).length;
    
    conversations.push({
      id: `conv_${i + 1}`,
      userId: `user_${Math.floor(Math.random() * 100)}`,
      botId: `bot_${Math.floor(Math.random() * 4) + 1}`,
      startTime,
      endTime,
      spans,
      overallScore: overallScore || 70,
      metrics: {
        bleuScore: 70 + Math.random() * 25,
        rougeScore: 65 + Math.random() * 30,
        semanticSimilarity: 75 + Math.random() * 20,
        intentAccuracy: 80 + Math.random() * 20,
        sentimentScore: -10 + Math.random() * 80,
        responseRelevance: 70 + Math.random() * 25
      },
      flow: {
        id: `flow_${i}`,
        steps: [
          { id: 'greeting', name: 'Greeting', intent: 'greeting', success: true, duration: 1000, nextSteps: ['inquiry'] },
          { id: 'inquiry', name: 'User Inquiry', intent: 'help_request', success: true, duration: 2000, nextSteps: ['response'] },
          { id: 'response', name: 'Bot Response', intent: 'provide_help', success: Math.random() > 0.2, duration: 1500, nextSteps: ['closure'] }
        ],
        successRate: 85 + Math.random() * 15,
        averageSteps: 3 + Math.random() * 2,
        dropoffPoints: Math.random() > 0.8 ? ['response'] : []
      },
      summary: {
        intent: ['support', 'billing', 'technical', 'sales'][Math.floor(Math.random() * 4)],
        resolved: Math.random() > 0.2,
        satisfaction: 60 + Math.random() * 40,
        keyTopics: ['order', 'account', 'payment', 'shipping', 'login'].slice(0, 2 + Math.floor(Math.random() * 2))
      }
    });
  }
  
  return conversations;
}

function generateSpanEvaluation(userText: string, botText: string): SpanEvaluation {
  const bleuScore = MetricsCalculator.calculateBLEUScore(userText, botText);
  const rougeScore = MetricsCalculator.calculateROUGEScore(userText, botText);
  const semanticSimilarity = MetricsCalculator.calculateSemanticSimilarity(userText, botText);
  const sentimentScore = MetricsCalculator.calculateSentimentScore(botText);
  const responseRelevance = MetricsCalculator.calculateResponseRelevance(userText, botText);
  
  const overallScore = Math.round((bleuScore + rougeScore + semanticSimilarity + responseRelevance) / 4);
  
  // Generate issues based on score
  const issues: QAIssue[] = [];
  if (overallScore < 70) {
    if (Math.random() > 0.5) {
      issues.push({
        id: `issue_${Date.now()}_1`,
        type: 'accuracy',
        severity: overallScore < 50 ? 'high' : 'medium',
        description: 'Response may not fully address the user query',
        automated: true
      });
    }
    if (Math.random() > 0.7) {
      issues.push({
        id: `issue_${Date.now()}_2`,
        type: 'relevance',
        severity: 'medium',
        description: 'Response relevance could be improved',
        automated: true
      });
    }
  }
  
  if (sentimentScore < -20) {
    issues.push({
      id: `issue_${Date.now()}_3`,
      type: 'tone',
      severity: 'low',
      description: 'Tone could be more positive',
      automated: true
    });
  }
  
  return {
    score: overallScore,
    bleuScore,
    rougeScore,
    semanticSimilarity,
    sentimentScore,
    issues,
    annotations: [],
    evaluatedBy: 'auto_evaluator',
    evaluatedAt: new Date()
  };
}

// Generate trend data
export function generateMockTrends(): MetricTrend[] {
  const metrics: (keyof QAMetrics)[] = ['bleuScore', 'rougeScore', 'intentAccuracy', 'userSatisfaction'];
  const trends: MetricTrend[] = [];
  
  metrics.forEach(metric => {
    const values = [];
    let baseValue = 70 + Math.random() * 20;
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Add some trend and noise
      const trendFactor = (30 - i) * 0.3; // Slight upward trend
      const noise = (Math.random() - 0.5) * 10;
      const value = Math.max(0, Math.min(100, baseValue + trendFactor + noise));
      
      values.push({ date, value });
    }
    
    const firstValue = values[0].value;
    const lastValue = values[values.length - 1].value;
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;
    
    trends.push({
      metric,
      values,
      trend: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      changePercent
    });
  });
  
  return trends;
}

// Generate heatmap data
export function generateMockHeatmapData(): HeatmapData[] {
  const data: HeatmapData[] = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  days.forEach(day => {
    for (let hour = 0; hour < 24; hour++) {
      // Simulate realistic patterns - higher activity during business hours
      let baseValue = 20;
      if (hour >= 9 && hour <= 17 && !['Sat', 'Sun'].includes(day)) {
        baseValue = 80; // Business hours
      } else if (hour >= 19 && hour <= 22) {
        baseValue = 60; // Evening hours
      } else if (['Sat', 'Sun'].includes(day) && hour >= 10 && hour <= 16) {
        baseValue = 50; // Weekend activity
      }
      
      const noise = (Math.random() - 0.5) * 20;
      const value = Math.max(0, Math.min(100, baseValue + noise));
      
      data.push({
        hour,
        day,
        value,
        metric: 'conversationVolume'
      });
    }
  });
  
  return data;
}

// Generate aggregated metrics
export function generateMockAggregatedMetrics(): QAMetrics {
  return {
    defectDensity: 15.3,
    testCoverage: 87.5,
    passRate: 78.9,
    failRate: 12.4,
    
    bleuScore: 73.2,
    rougeScore: 68.7,
    semanticSimilarity: 81.4,
    intentAccuracy: 84.6,
    sentimentScore: 23.8,
    responseRelevance: 79.3,
    
    conversationCompletionRate: 89.2,
    averageResponseTime: 2.1,
    tokenEfficiency: 76.8,
    contextMaintenance: 82.5,
    
    userSatisfaction: 75.6,
    taskSuccessRate: 84.3,
    escalationRate: 8.7,
    resolutionTime: 4.2
  };
}