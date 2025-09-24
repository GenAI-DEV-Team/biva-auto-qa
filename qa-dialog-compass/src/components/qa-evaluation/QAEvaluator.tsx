// QA Evaluation Interface Component

import React, { useState, useCallback } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Edit3,
  Save,
  Trash2,
  Flag,
  Target,
  Clock,
  User,
  Bot
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { ConversationAnalysis, SpanEvaluation, QAIssue, Annotation } from '@/types/qa';
import { MetricsCalculator } from '@/utils/metrics';

interface QAEvaluatorProps {
  conversation: ConversationAnalysis;
  onEvaluationUpdate: (spanId: string, evaluation: SpanEvaluation) => void;
  currentUser: string;
}

export function QAEvaluator({ 
  conversation, 
  onEvaluationUpdate, 
  currentUser = "qa_evaluator" 
}: QAEvaluatorProps) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationForm, setEvaluationForm] = useState<Partial<SpanEvaluation>>({
    score: 70,
    issues: [],
    annotations: []
  });

  const selectedSpan = conversation.spans.find(span => span.id === selectedSpanId);

  const handleSpanSelect = useCallback((spanId: string) => {
    setSelectedSpanId(spanId);
    const span = conversation.spans.find(s => s.id === spanId);
    if (span?.evaluation) {
      setEvaluationForm(span.evaluation);
    } else {
      // Auto-calculate basic metrics for new evaluation
      const userSpan = conversation.spans.find(s => s.type === 'user' && 
        conversation.spans.indexOf(s) === conversation.spans.indexOf(span!) - 1);
      
      if (userSpan && span) {
        const bleuScore = MetricsCalculator.calculateBLEUScore(
          userSpan.text, 
          span.text
        );
        const rougeScore = MetricsCalculator.calculateROUGEScore(
          userSpan.text, 
          span.text
        );
        const semanticSimilarity = MetricsCalculator.calculateSemanticSimilarity(
          userSpan.text, 
          span.text
        );
        const responseRelevance = MetricsCalculator.calculateResponseRelevance(
          userSpan.text, 
          span.text
        );
        const sentimentScore = MetricsCalculator.calculateSentimentScore(span.text);

        setEvaluationForm({
          score: Math.round((bleuScore + rougeScore + semanticSimilarity + responseRelevance) / 4),
          bleuScore,
          rougeScore,
          semanticSimilarity,
          sentimentScore,
          issues: [],
          annotations: []
        });
      }
    }
    setIsEvaluating(true);
  }, [conversation.spans]);

  const handleAddIssue = () => {
    const newIssue: QAIssue = {
      id: `issue_${Date.now()}`,
      type: 'accuracy',
      severity: 'medium',
      description: '',
      automated: false
    };
    
    setEvaluationForm(prev => ({
      ...prev,
      issues: [...(prev.issues || []), newIssue]
    }));
  };

  const handleUpdateIssue = (issueId: string, updates: Partial<QAIssue>) => {
    setEvaluationForm(prev => ({
      ...prev,
      issues: prev.issues?.map(issue => 
        issue.id === issueId ? { ...issue, ...updates } : issue
      ) || []
    }));
  };

  const handleRemoveIssue = (issueId: string) => {
    setEvaluationForm(prev => ({
      ...prev,
      issues: prev.issues?.filter(issue => issue.id !== issueId) || []
    }));
  };

  const handleAddAnnotation = (type: Annotation['type']) => {
    if (!selectedSpanId) return;
    
    const newAnnotation: Annotation = {
      id: `annotation_${Date.now()}`,
      spanId: selectedSpanId,
      type,
      annotator: currentUser,
      timestamp: new Date()
    };
    
    setEvaluationForm(prev => ({
      ...prev,
      annotations: [...(prev.annotations || []), newAnnotation]
    }));
  };

  const handleSaveEvaluation = () => {
    if (!selectedSpanId) return;
    
    const finalEvaluation: SpanEvaluation = {
      ...evaluationForm,
      evaluatedBy: currentUser,
      evaluatedAt: new Date(),
      issues: evaluationForm.issues || [],
      annotations: evaluationForm.annotations || []
    } as SpanEvaluation;
    
    onEvaluationUpdate(selectedSpanId, finalEvaluation);
    setIsEvaluating(false);
    setSelectedSpanId(null);
  };

  const getSpanStatusColor = (span: any) => {
    if (!span.evaluation) return 'border-gray-300';
    const score = span.evaluation.score;
    if (score >= 80) return 'border-green-500 bg-green-50';
    if (score >= 60) return 'border-yellow-500 bg-yellow-50';
    return 'border-red-500 bg-red-50';
  };

  const getSpanStatusIcon = (span: any) => {
    if (!span.evaluation) return <MessageSquare className="h-4 w-4 text-gray-400" />;
    const score = span.evaluation.score;
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (score >= 60) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="flex h-full gap-6">
      {/* Conversation View */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Conversation Analysis</h2>
            <p className="text-sm text-muted-foreground">
              {conversation.id} • {conversation.spans.length} messages
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              Overall Score: {conversation.overallScore.toFixed(0)}
            </Badge>
            <Badge variant={conversation.summary.resolved ? "default" : "secondary"}>
              {conversation.summary.resolved ? "Resolved" : "Unresolved"}
            </Badge>
          </div>
        </div>

        {/* Conversation Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Evaluation Progress</span>
              <span className="text-sm text-muted-foreground">
                {conversation.spans.filter(s => s.evaluation).length} / {conversation.spans.length} evaluated
              </span>
            </div>
            <Progress 
              value={(conversation.spans.filter(s => s.evaluation).length / conversation.spans.length) * 100} 
              className="h-2"
            />
          </CardContent>
        </Card>

        {/* Messages */}
        <div className="space-y-3">
          {conversation.spans.map((span, index) => (
            <div key={span.id} className="flex gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                span.type === 'user' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                {span.type === 'user' ? 
                  <User className="h-4 w-4 text-blue-600" /> : 
                  <Bot className="h-4 w-4 text-green-600" />
                }
              </div>
              
              <div className="flex-1">
                <Card 
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedSpanId === span.id ? 'ring-2 ring-primary' : ''
                  } ${getSpanStatusColor(span)}`}
                  onClick={() => handleSpanSelect(span.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {span.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {span.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {getSpanStatusIcon(span)}
                        {span.evaluation && (
                          <span className="text-xs font-medium">
                            {span.evaluation.score}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm mb-2">{span.text}</p>
                    
                    {span.evaluation && span.evaluation.issues.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {span.evaluation.issues.slice(0, 3).map(issue => (
                          <Badge 
                            key={issue.id} 
                            variant="destructive" 
                            className="text-xs"
                          >
                            {issue.type}
                          </Badge>
                        ))}
                        {span.evaluation.issues.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{span.evaluation.issues.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation Panel */}
      <div className="w-96 space-y-4">
        {!isEvaluating ? (
          <Card>
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Select a Message</h3>
              <p className="text-sm text-muted-foreground">
                Click on a message to start evaluating its quality
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Evaluation Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Evaluate Message</span>
                  <Button variant="outline" size="sm" onClick={() => setIsEvaluating(false)}>
                    Cancel
                  </Button>
                </CardTitle>
                <CardDescription>
                  {selectedSpan?.type === 'user' ? 'User Message' : 'Assistant Response'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Overall Score */}
                <div>
                  <Label>Overall Score (0-100)</Label>
                  <div className="flex items-center space-x-3 mt-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={evaluationForm.score || 70}
                      onChange={(e) => setEvaluationForm(prev => ({
                        ...prev,
                        score: parseInt(e.target.value)
                      }))}
                      className="flex-1"
                    />
                    <span className="text-lg font-semibold w-12">
                      {evaluationForm.score || 70}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Auto-calculated Metrics */}
                <div className="space-y-2">
                  <Label>Automatic Metrics</Label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-muted rounded">
                      <div className="font-medium">BLEU</div>
                      <div>{evaluationForm.bleuScore?.toFixed(1) || 'N/A'}</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="font-medium">ROUGE</div>
                      <div>{evaluationForm.rougeScore?.toFixed(1) || 'N/A'}</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="font-medium">Semantic</div>
                      <div>{evaluationForm.semanticSimilarity?.toFixed(1) || 'N/A'}</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="font-medium">Sentiment</div>
                      <div>{evaluationForm.sentimentScore?.toFixed(1) || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Quick Actions */}
                <div>
                  <Label>Quick Annotation</Label>
                  <div className="flex space-x-2 mt-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleAddAnnotation('correct')}
                    >
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      Correct
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleAddAnnotation('incorrect')}
                    >
                      <ThumbsDown className="h-3 w-3 mr-1" />
                      Incorrect
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleAddAnnotation('partial')}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Partial
                    </Button>
                  </div>
                </div>

                {/* Issues Section */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Issues Found</Label>
                    <Button size="sm" variant="outline" onClick={handleAddIssue}>
                      <Flag className="h-3 w-3 mr-1" />
                      Add Issue
                    </Button>
                  </div>
                  
                  <div className="mt-2 space-y-2">
                    {evaluationForm.issues?.map(issue => (
                      <div key={issue.id} className="p-3 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <Select
                            value={issue.type}
                            onValueChange={(value) => handleUpdateIssue(issue.id, { type: value as any })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="accuracy">Accuracy</SelectItem>
                              <SelectItem value="relevance">Relevance</SelectItem>
                              <SelectItem value="tone">Tone</SelectItem>
                              <SelectItem value="completeness">Completeness</SelectItem>
                              <SelectItem value="safety">Safety</SelectItem>
                              <SelectItem value="hallucination">Hallucination</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Select
                            value={issue.severity}
                            onValueChange={(value) => handleUpdateIssue(issue.id, { severity: value as any })}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleRemoveIssue(issue.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <Textarea
                          placeholder="Describe the issue..."
                          value={issue.description}
                          onChange={(e) => handleUpdateIssue(issue.id, { description: e.target.value })}
                          className="text-sm"
                          rows={2}
                        />
                        
                        <Textarea
                          placeholder="Suggestion for improvement (optional)..."
                          value={issue.suggestion || ''}
                          onChange={(e) => handleUpdateIssue(issue.id, { suggestion: e.target.value })}
                          className="text-sm"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <Button onClick={handleSaveEvaluation} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save Evaluation
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* Conversation Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Conversation Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm">Intent:</span>
              <Badge variant="outline">{conversation.summary.intent}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Duration:</span>
              <span className="text-sm">
                {Math.round((conversation.endTime.getTime() - conversation.startTime.getTime()) / 1000 / 60)}m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Key Topics:</span>
              <div className="flex flex-wrap gap-1">
                {conversation.summary.keyTopics.slice(0, 3).map(topic => (
                  <Badge key={topic} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}