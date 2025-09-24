// Advanced Charts for QA Analytics

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
  BarChart,
  Bar,
  ComposedChart
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QAMetrics, MetricTrend, HeatmapData } from '@/types/qa';

interface AdvancedChartsProps {
  metrics: QAMetrics;
  trends: MetricTrend[];
  heatmapData: HeatmapData[];
}

export function AdvancedCharts({ metrics, trends, heatmapData }: AdvancedChartsProps) {
  // Radar Chart Data for Multi-dimensional Quality
  const radarData = [
    { metric: 'Accuracy', value: metrics.intentAccuracy, fullMark: 100 },
    { metric: 'Relevance', value: metrics.responseRelevance, fullMark: 100 },
    { metric: 'BLEU', value: metrics.bleuScore, fullMark: 100 },
    { metric: 'ROUGE', value: metrics.rougeScore, fullMark: 100 },
    { metric: 'Semantic', value: metrics.semanticSimilarity, fullMark: 100 },
    { metric: 'Efficiency', value: metrics.tokenEfficiency, fullMark: 100 }
  ];

  // Quality Distribution Data
  const qualityDistribution = [
    { range: '90-100', count: 245, color: '#10b981' },
    { range: '80-89', count: 189, color: '#3b82f6' },
    { range: '70-79', count: 156, color: '#f59e0b' },
    { range: '60-69', count: 89, color: '#ef4444' },
    { range: '0-59', count: 34, color: '#dc2626' }
  ];

  // Correlation Data for Scatter Plot
  const correlationData = Array.from({ length: 50 }, (_, i) => ({
    bleuScore: 60 + Math.random() * 40,
    userSatisfaction: 50 + Math.random() * 50,
    conversationLength: 5 + Math.random() * 20
  }));

  // Trend Analysis for Multiple Metrics
  const multiTrendData = trends[0]?.values.map((_, index) => ({
    date: trends[0].values[index].date.toLocaleDateString(),
    bleuScore: trends.find(t => t.metric === 'bleuScore')?.values[index]?.value || 0,
    rougeScore: trends.find(t => t.metric === 'rougeScore')?.values[index]?.value || 0,
    intentAccuracy: trends.find(t => t.metric === 'intentAccuracy')?.values[index]?.value || 0,
    userSatisfaction: trends.find(t => t.metric === 'userSatisfaction')?.values[index]?.value || 0
  })) || [];

  // Performance Benchmarks
  const benchmarkData = [
    { metric: 'BLEU Score', current: metrics.bleuScore, benchmark: 75, industry: 68 },
    { metric: 'Intent Accuracy', current: metrics.intentAccuracy, benchmark: 85, industry: 78 },
    { metric: 'User Satisfaction', current: metrics.userSatisfaction, benchmark: 80, industry: 72 },
    { metric: 'Task Success', current: metrics.taskSuccessRate, benchmark: 90, industry: 82 }
  ];

  // Issue Distribution Data
  const issueDistribution = [
    { type: 'Accuracy', count: 45, severity: 'high', color: '#ef4444' },
    { type: 'Relevance', count: 32, severity: 'medium', color: '#f59e0b' },
    { type: 'Tone', count: 28, severity: 'low', color: '#3b82f6' },
    { type: 'Completeness', count: 19, severity: 'high', color: '#ef4444' },
    { type: 'Safety', count: 12, severity: 'critical', color: '#dc2626' },
    { type: 'Hallucination', count: 8, severity: 'critical', color: '#dc2626' }
  ];

  return (
    <div className="space-y-6">
      {/* Multi-dimensional Quality Radar */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-dimensional Quality Assessment</CardTitle>
          <CardDescription>Comprehensive view of AI quality metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar
                name="Quality Score"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Trend Analysis */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quality Trends Over Time</CardTitle>
            <CardDescription>Multi-metric trend analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={multiTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="bleuScore" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  name="BLEU Score"
                />
                <Line 
                  type="monotone" 
                  dataKey="intentAccuracy" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  name="Intent Accuracy"
                />
                <Line 
                  type="monotone" 
                  dataKey="userSatisfaction" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  name="User Satisfaction"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Performance vs Benchmarks</CardTitle>
          <CardDescription>Compare against industry standards</CardDescription>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={benchmarkData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="metric" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="current" fill="hsl(var(--primary))" name="Current" />
                <Bar dataKey="benchmark" fill="hsl(var(--secondary))" name="Target" />
                <Bar dataKey="industry" fill="#94a3b8" name="Industry Avg" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quality Distribution and Issue Analysis */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quality Score Distribution</CardTitle>
            <CardDescription>Distribution of conversation quality scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={qualityDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {qualityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issue Distribution by Type</CardTitle>
            <CardDescription>Analysis of quality issues found</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={issueDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {issueDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Correlation Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>BLEU Score vs User Satisfaction Correlation</CardTitle>
          <CardDescription>Relationship between technical metrics and user experience</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart
              data={correlationData}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <CartesianGrid />
              <XAxis 
                type="number" 
                dataKey="bleuScore" 
                name="BLEU Score" 
                domain={[0, 100]}
                label={{ value: 'BLEU Score', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                type="number" 
                dataKey="userSatisfaction" 
                name="User Satisfaction" 
                domain={[0, 100]}
                label={{ value: 'User Satisfaction', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter 
                name="Conversations" 
                dataKey="userSatisfaction" 
                fill="hsl(var(--primary))"
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversation Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation Activity Heatmap</CardTitle>
          <CardDescription>Peak conversation times and quality patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-24 gap-1 p-4">
            {Array.from({ length: 7 }, (_, day) => 
              Array.from({ length: 24 }, (_, hour) => {
                const intensity = Math.random() * 100;
                const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="w-4 h-4 rounded-sm"
                    style={{
                      backgroundColor: `hsl(var(--primary) / ${intensity / 100})`,
                    }}
                    title={`${dayNames[day]} ${hour}:00 - Quality: ${intensity.toFixed(0)}%`}
                  />
                );
              })
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:59</span>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Performance Metrics</CardTitle>
          <CardDescription>Comprehensive quality assessment overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {metrics.bleuScore.toFixed(1)}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">BLEU Score</div>
              <div className="text-xs text-muted-foreground">Translation Quality</div>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {metrics.rougeScore.toFixed(1)}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">ROUGE Score</div>
              <div className="text-xs text-muted-foreground">Summary Quality</div>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {metrics.semanticSimilarity.toFixed(1)}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Semantic Similarity</div>
              <div className="text-xs text-muted-foreground">Context Understanding</div>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {metrics.contextMaintenance.toFixed(1)}%
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">Context Maintenance</div>
              <div className="text-xs text-muted-foreground">Conversation Flow</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}