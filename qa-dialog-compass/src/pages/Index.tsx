// BIVA QA Agent - Quality Assurance System Dashboard

import { useMemo, useState } from "react";
import { Brain, Bot, Activity, FileText, MessageSquare, Search, Settings, BarChart3, PlusCircle, Users, CheckCircle, AlertTriangle, XCircle, TrendingUp, Zap, Target, Clock, Award } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import heroImage from "@/assets/hero-bg.jpg";
import { AdvancedCharts } from "@/components/charts/AdvancedCharts";
import { QAEvaluator } from "@/components/qa-evaluation/QAEvaluator";
import { generateMockConversations, generateMockTrends, generateMockHeatmapData, generateMockAggregatedMetrics } from "@/data/mockData";
import { ConversationAnalysis, SpanEvaluation } from "@/types/qa";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBots, createBotByLegacyIndex, regenerateKnowledgeBase } from "@/lib/botsApi";
import type { BotResponse } from "@/types/bots";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { listConversations, listSpans, getConversation } from "@/lib/conversationsApi";
import { getEvaluation, runQAEvaluations } from "@/lib/evaluationsApi";
import type { EvaluationRecord } from "@/types/evaluations";
import type { SpanResponse, ConversationResponse } from "@/types/conversations";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedConversation, setSelectedConversation] = useState<ConversationAnalysis | null>(null);
  const [conversationsBotFilter, setConversationsBotFilter] = useState<number | null>(null);
  const [convStartTs, setConvStartTs] = useState<string>("");
  const [convEndTs, setConvEndTs] = useState<string>("");
  const [convPhoneFilter, setConvPhoneFilter] = useState<string>("");
  const [convSortDir, setConvSortDir] = useState<"desc" | "asc">("desc");
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showEvalDetails, setShowEvalDetails] = useState(false);
  const [qaRunningId, setQaRunningId] = useState<string | null>(null);
  const [convPage, setConvPage] = useState<number>(1);
  const pageSize = 20;
  const [convIdSearch, setConvIdSearch] = useState<string>("");
  const [isSearchingConvId, setIsSearchingConvId] = useState<boolean>(false);
  const [pinnedConv, setPinnedConv] = useState<ConversationResponse | null>(null);
  
  // Mock data
  const conversations = generateMockConversations();
  const trends = generateMockTrends();
  const heatmapData = generateMockHeatmapData();
  const aggregatedMetrics = generateMockAggregatedMetrics();

  const metrics = [
    { label: "Total Bots", value: 12, icon: Brain, color: "text-primary", change: "+2", trend: "up" },
    { label: "Active QA Runs", value: 3, icon: Activity, color: "text-secondary", change: "+1", trend: "up" },
    { label: "Conversations Analyzed", value: conversations.length, icon: MessageSquare, color: "text-green-500", change: `+${Math.floor(conversations.length * 0.12)}`, trend: "up" },
    { label: "Avg Quality Score", value: Math.round(aggregatedMetrics.bleuScore), icon: Award, color: "text-purple-500", change: "+3.2%", trend: "up" }
  ];

  const statusData = [
    { name: 'Passed', value: 65, color: '#10b981' },
    { name: 'Warning', value: 25, color: '#f59e0b' },
    { name: 'Failed', value: 10, color: '#ef4444' }
  ];

  const businessData = [
    { name: 'Support', value: 45 },
    { name: 'Sales', value: 30 },
    { name: 'HR', value: 15 },
    { name: 'Other', value: 10 }
  ];

  const recentActivity = [
    { id: 1, type: "QA Run", status: "Success", time: "2 mins ago", bot: "Support Bot v2.1" },
    { id: 2, type: "Proposal", status: "Pending", time: "15 mins ago", bot: "Sales Bot v1.3" },
    { id: 3, type: "Issue", status: "Warning", time: "1 hour ago", bot: "HR Bot v1.0" },
    { id: 4, type: "QA Run", status: "Failed", time: "2 hours ago", bot: "General Bot v3.2" }
  ];

  const queryClient = useQueryClient();
  const { data: botsData, isLoading: botsLoading, isError: botsError, error: botsErrorObj, refetch: refetchBots } = useQuery({
    queryKey: ["bots", { limit: 100 }],
    queryFn: () => listBots({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [legacyIndexInput, setLegacyIndexInput] = useState("");
  const createBotMutation = useMutation({
    mutationFn: (index: number) => createBotByLegacyIndex(index),
    onSuccess: (bot: BotResponse) => {
      toast({ title: "Bot created", description: `${bot.name} (index ${bot.index})` });
      setCreateOpen(false);
      setLegacyIndexInput("");
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to create bot";
      toast({ title: "Create bot failed", description: message });
    },
  });

  const bots = useMemo(() => botsData ?? [], [botsData]);
  const isLegacyIndexValid = /^\d+$/.test(legacyIndexInput.trim());

  const { data: conversationsData, isLoading: conversationsLoading, isError: conversationsError, error: conversationsErrorObj, refetch: refetchConversations } = useQuery({
    queryKey: ["conversations", { bot_id: conversationsBotFilter, start_ts: convStartTs || undefined, end_ts: convEndTs || undefined, limit: 500 }],
    queryFn: () => listConversations({
      bot_id: conversationsBotFilter ?? undefined,
      start_ts: convStartTs || undefined,
      end_ts: convEndTs || undefined,
      limit: 500,
    }),
    enabled: activeTab === "conversations",
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: spansData, isLoading: spansLoading, isError: spansError, error: spansErrorObj } = useQuery({
    queryKey: ["spans", { conversation_id: activeConversationId }],
    queryFn: () => listSpans(activeConversationId as string),
    enabled: activeTab === "conversations" && !!activeConversationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: evalData, isLoading: evalLoading, isError: evalError } = useQuery({
    queryKey: ["evaluation", { conversation_id: activeConversationId }],
    queryFn: () => getEvaluation(activeConversationId as string),
    enabled: activeTab === "conversations" && !!activeConversationId,
    meta: { suppressToast: true },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const proposals = [
    { id: 1, type: "new", title: "Improve greeting response", status: "pending", bot: "Support Bot", created: "2 hours ago" },
    { id: 2, type: "update", title: "Fix product recommendation logic", status: "approved", bot: "Sales Bot", created: "1 day ago" },
    { id: 3, type: "new", title: "Add FAQ automation", status: "rejected", bot: "General Bot", created: "3 days ago" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="border-r bg-card h-screen w-64 flex flex-col shadow-lg">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">BIVA QA Agent</h2>
                <p className="text-xs text-muted-foreground">Quality Assurance</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: BarChart3 },
              { id: "bots", label: "Bot Management", icon: Brain },
              { id: "conversations", label: "Conversations", icon: MessageSquare },
              { id: "proposals", label: "Proposals", icon: FileText },
              { id: "reports", label: "Reports", icon: TrendingUp },
              { id: "settings", label: "Settings", icon: Settings }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">QA Admin</p>
                <p className="text-xs text-muted-foreground">admin@biva.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            {/* Dashboard */}
            <TabsContent value="dashboard" className="m-0 h-full">
              <div className="space-y-6 p-6">
                {/* Hero Section */}
                <div 
                  className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary to-secondary p-8 text-white shadow-xl"
                  style={{
                    backgroundImage: `linear-gradient(rgba(45, 125, 114, 0.8), rgba(230, 164, 35, 0.8)), url(${heroImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="relative z-10">
                    <div className="flex items-center space-x-3 mb-4">
                      <Brain className="h-12 w-12 text-white drop-shadow-lg" />
                      <div>
                        <h1 className="text-4xl font-bold drop-shadow-lg">BIVA QA Agent</h1>
                        <p className="text-xl opacity-90">Quality Assurance System</p>
                      </div>
                    </div>
                    <p className="text-lg mb-6 opacity-90 max-w-2xl">
                      Automated conversation analysis and bot performance monitoring with AI-powered insights
                    </p>
                    <div className="flex space-x-3">
                      <Button variant="secondary" size="lg" className="shadow-lg">
                        <Activity className="h-4 w-4 mr-2" />
                        Start QA Run
                      </Button>
                      <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-primary shadow-lg">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Reports
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {metrics.map((metric, index) => (
                    <Card key={index} className="hover:shadow-lg transition-all duration-300 bg-card border-border">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {metric.label}
                        </CardTitle>
                        <metric.icon className={`h-5 w-5 ${metric.color}`} />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-foreground">{metric.value.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className={metric.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}>
                            {metric.change}
                          </span> from last week
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Charts Row */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">QA Status Breakdown</CardTitle>
                      <CardDescription className="text-muted-foreground">Distribution of conversation quality</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Business Categories</CardTitle>
                      <CardDescription className="text-muted-foreground">Conversation distribution by type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={businessData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Recent Activity</CardTitle>
                    <CardDescription className="text-muted-foreground">Latest QA operations and alerts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-2 h-2 rounded-full ${
                              activity.status === 'Success' ? 'bg-green-500' :
                              activity.status === 'Warning' ? 'bg-yellow-500' :
                              activity.status === 'Pending' ? 'bg-blue-500' : 'bg-red-500'
                            }`} />
                            <div>
                              <p className="text-sm font-medium text-foreground">{activity.type}</p>
                              <p className="text-xs text-muted-foreground">{activity.bot}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={
                              activity.status === 'Success' ? 'default' :
                              activity.status === 'Warning' ? 'secondary' :
                              activity.status === 'Pending' ? 'outline' : 'destructive'
                            }>
                              {activity.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Bot Management */}
            <TabsContent value="bots" className="m-0 h-full">
              <div className="space-y-6 p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Bot Management</h2>
                    <p className="text-muted-foreground">Manage and monitor your AI bots</p>
                  </div>
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-primary text-primary-foreground">
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Create Bot
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Bot</DialogTitle>
                        <DialogDescription>Enter legacy bot index to import.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <label className="text-sm text-foreground">Legacy Index</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Enter legacy index"
                          value={legacyIndexInput}
                          onChange={(e) => setLegacyIndexInput(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => isLegacyIndexValid && createBotMutation.mutate(Number(legacyIndexInput.trim()))}
                          disabled={createBotMutation.isPending || !isLegacyIndexValid}
                        >
                          {createBotMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="flex space-x-4">
                  <Input placeholder="Search bots..." className="max-w-sm" />
                  <Select>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {botsLoading && (
                  <div className="text-sm text-muted-foreground">Loading bots...</div>
                )}
                {botsError && (
                  <div className="text-sm text-destructive">Error: {botsErrorObj instanceof Error ? botsErrorObj.message : "Failed to load"}</div>
                )}
                {!botsLoading && !botsError && (
                  <div className="grid gap-4">
                    {bots.length === 0 && (
                      <div className="text-sm text-muted-foreground">No bots found.</div>
                    )}
                    {bots.map((bot) => (
                      <Card key={bot.id} className="bg-card border-border">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Brain className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-foreground">{bot.name}</h3>
                                <p className="text-xs text-muted-foreground">Index: {bot.index} • Created: {new Date(bot.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setConversationsBotFilter(bot.index);
                                  setActiveTab("conversations");
                                }}
                              >
                                View Details
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const ver = await regenerateKnowledgeBase(bot.index);
                                    toast({ title: "Knowledge base regenerated", description: `New version at ${new Date(ver.created_at).toLocaleString()}` });
                                  } catch (e) {
                                    const m = e instanceof Error ? e.message : "Failed to regenerate";
                                    toast({ title: "Regenerate failed", description: m });
                                  }
                                }}
                              >
                                Regen KB
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Conversations */}
            <TabsContent value="conversations" className="m-0 h-full">
              <div className="flex h-full">
                <div className="w-1/2 h-[100vh] border-r border-border p-6 space-y-5 flex flex-col">
                  <div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Conversations</h2>
                    {conversationsBotFilter != null && (
                      <div className="mb-4 p-2 rounded-md bg-accent/30 text-xs text-muted-foreground flex items-center justify-between">
                        <span>Filtered by bot index: {conversationsBotFilter}</span>
                        <Button variant="outline" size="sm" onClick={() => setConversationsBotFilter(null)}>Clear</Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="justify-start font-normal">
                            {convStartTs ? new Date(convStartTs).toLocaleString() : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <div className="p-2 space-y-2">
                            <Calendar mode="single" selected={convStartTs ? new Date(convStartTs) : undefined} onSelect={(d) => d && setConvStartTs(new Date(d).toISOString().slice(0,16))} />
                            <Input type="time" value={convStartTs ? new Date(convStartTs).toISOString().slice(11,16) : ""} onChange={(e) => {
                              if (!convStartTs) return;
                              const base = new Date(convStartTs);
                              const [hh, mm] = e.target.value.split(":");
                              base.setHours(Number(hh || 0), Number(mm || 0));
                              setConvStartTs(base.toISOString().slice(0,16));
                            }} placeholder="--:--" />
                            <div className="flex gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setConvStartTs(new Date().toISOString().slice(0,16))}>Now</Button>
                              <Button size="sm" variant="outline" onClick={() => setConvStartTs("")}>Clear</Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="justify-start font-normal">
                            {convEndTs ? new Date(convEndTs).toLocaleString() : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <div className="p-2 space-y-2">
                            <Calendar mode="single" selected={convEndTs ? new Date(convEndTs) : undefined} onSelect={(d) => d && setConvEndTs(new Date(d).toISOString().slice(0,16))} />
                            <Input type="time" value={convEndTs ? new Date(convEndTs).toISOString().slice(11,16) : ""} onChange={(e) => {
                              if (!convEndTs) return;
                              const base = new Date(convEndTs);
                              const [hh, mm] = e.target.value.split(":");
                              base.setHours(Number(hh || 0), Number(mm || 0));
                              setConvEndTs(base.toISOString().slice(0,16));
                            }} placeholder="--:--" />
                            <div className="flex gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setConvEndTs(new Date().toISOString().slice(0,16))}>Now</Button>
                              <Button size="sm" variant="outline" onClick={() => setConvEndTs("")}>Clear</Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <Input placeholder="Filter by customer phone" className="flex-1" value={convPhoneFilter} onChange={(e) => setConvPhoneFilter(e.target.value)} />
                      <Select value={convSortDir} onValueChange={(v) => setConvSortDir(v as any)}>
                        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sort" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">Newest first</SelectItem>
                          <SelectItem value="asc">Oldest first</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => { setConvPage(1); refetchConversations(); }}>Apply</Button>
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <Input
                        placeholder="Conversation ID"
                        value={convIdSearch}
                        onChange={(e) => setConvIdSearch(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            try {
                              if (!convIdSearch.trim()) return;
                              setIsSearchingConvId(true);
                              const conv = await getConversation(convIdSearch.trim());
                              setActiveConversationId(convIdSearch.trim());
                              setPinnedConv(conv);
                              setConvPage(1);
                              toast({ title: "Loaded", description: `Conversation ${convIdSearch.trim()} loaded` });
                            } catch (err) {
                              const m = err instanceof Error ? err.message : "Conversation not found";
                              toast({ title: "Load failed", description: m });
                            } finally {
                              setIsSearchingConvId(false);
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        disabled={isSearchingConvId || !convIdSearch.trim()}
                        onClick={async () => {
                          try {
                            if (!convIdSearch.trim()) return;
                            setIsSearchingConvId(true);
                            const conv = await getConversation(convIdSearch.trim());
                            setActiveConversationId(convIdSearch.trim());
                            setPinnedConv(conv);
                            setConvPage(1);
                            toast({ title: "Loaded", description: `Conversation ${convIdSearch.trim()} loaded` });
                          } catch (err) {
                            const m = err instanceof Error ? err.message : "Conversation not found";
                            toast({ title: "Load failed", description: m });
                          } finally {
                            setIsSearchingConvId(false);
                          }
                        }}
                      >
                        {isSearchingConvId ? "Loading..." : "Load"}
                      </Button>
                      <Button
                        onClick={async () => {
                          const cid = convIdSearch.trim();
                          if (!cid) return;
                          try {
                            setQaRunningId(cid);
                            await runQAEvaluations({ conversation_ids: [cid] });
                            await queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: cid }] });
                            toast({ title: "QA run started", description: "Evaluation will refresh when ready." });
                          } catch (err) {
                            const m = err instanceof Error ? err.message : "Failed to run QA";
                            toast({ title: "Run QA failed", description: m });
                          } finally {
                            setQaRunningId(null);
                          }
                        }}
                        disabled={!convIdSearch.trim() || qaRunningId === convIdSearch.trim()}
                      >
                        {qaRunningId === convIdSearch.trim() ? "Running..." : "Run QA"}
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 pr-2">
                    {conversationsLoading && (
                      <div className="text-sm text-muted-foreground">Loading conversations...</div>
                    )}
                    {conversationsError && (
                      <div className="text-sm text-destructive">Error: {conversationsErrorObj instanceof Error ? conversationsErrorObj.message : "Failed to load"}</div>
                    )}
                    {!conversationsLoading && !conversationsError && (
                      <div className="space-y-4">
                        {(conversationsData ?? []).length === 0 && (
                          <div className="text-sm text-muted-foreground">No conversations found.</div>
                        )}
                        {(() => {
                          let all = (conversationsData ?? [])
                            .filter((c) => (convPhoneFilter.trim() ? (c.customer_phone || "").includes(convPhoneFilter.trim()) : true))
                            .sort((a, b) => {
                              const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                              const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                              return convSortDir === "desc" ? tb - ta : ta - tb;
                            });

                          // Pin the searched conversation to the top if available
                          if (pinnedConv) {
                            const pid = pinnedConv.conversation_id ?? String(pinnedConv.id);
                            all = [pinnedConv, ...all.filter((c) => (c.conversation_id ?? String(c.id)) !== pid)];
                          }
                          const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
                          const currentPage = Math.min(convPage, totalPages);
                          const start = (currentPage - 1) * pageSize;
                          const pageItems = all.slice(start, start + pageSize);
                          return pageItems.map((conv) => {
                          const convId = conv.conversation_id ?? String(conv.id);
                          const phone = conv.customer_phone ?? "Unknown";
                          const created = conv.created_at ? new Date(conv.created_at).toLocaleString() : "";
                          const updated = conv.updated_at ? new Date(conv.updated_at).toLocaleString() : "";
                          const isSelected = selectedConvIds.includes(convId);
                          const isActive = activeConversationId === convId;
                          return (
                            <Card
                              key={convId}
                              className={`p-5 rounded-lg cursor-pointer hover:bg-accent/30 transition-colors bg-card border-border ${isSelected ? "ring-2 ring-primary" : ""} ${isActive ? "border-primary" : ""}`}
                              onClick={() => setActiveConversationId(convId)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      setSelectedConvIds((prev) => e.target.checked ? [...prev, convId] : prev.filter((id) => id !== convId));
                                    }}
                                  />
                                  <p className="font-medium text-sm text-foreground">{phone}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        setQaRunningId(convId);
                                        await runQAEvaluations({ conversation_ids: [convId] });
                                        await queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: convId }] });
                                        toast({ title: "QA run started", description: "Evaluation will refresh when ready." });
                                      } catch (err) {
                                        const m = err instanceof Error ? err.message : "Failed to run QA";
                                        toast({ title: "Run QA failed", description: m });
                                      } finally {
                                        setQaRunningId(null);
                                      }
                                    }}
                                    disabled={qaRunningId === convId}
                                  >
                                    {qaRunningId === convId ? "Running..." : "QA Run"}
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <div><span className="text-foreground">Bot:</span> {conv.bot_id ?? "-"}</div>
                                <div><span className="text-foreground">Created:</span> {created}</div>
                                <div className="col-span-2 truncate"><span className="text-foreground">Updated:</span> {updated}</div>
                              </div>
                              <div className="mt-2 text-[11px] font-mono text-muted-foreground">
                                <span className="block w-full truncate" title={convId}>ID: {convId}</span>
                              </div>
                            </Card>
                          );
                        })
                        })()}
                      </div>
                    )}
                  </ScrollArea>
                  {!conversationsLoading && !conversationsError && (conversationsData ?? []).length > 0 && (
                    <div className="pt-3 flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedConvIds([])}>Clear Selection</Button>
                        <Button size="sm" disabled={selectedConvIds.length === 0}>Run QA</Button>
                      </div>
                      {(() => {
                        const all = (conversationsData ?? [])
                          .filter((c) => (convPhoneFilter.trim() ? (c.customer_phone || "").includes(convPhoneFilter.trim()) : true));
                        const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
                        const currentPage = Math.min(convPage, totalPages);
                        return (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setConvPage((p) => Math.max(1, p - 1))}>Prev</Button>
                            <span className="text-xs text-muted-foreground">Page {currentPage} / {totalPages}</span>
                            <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setConvPage((p) => p + 1)}>Next</Button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="w-1/2 p-6 h-[100vh] flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-foreground">Conversation Detail</h3>
                    {!activeConversationId && (
                      <p className="text-sm text-muted-foreground">Select a conversation to load spans.</p>
                    )}
                  </div>
                  <ScrollArea className="rounded-md border border-border p-4 h-[50vh]">
                    {!activeConversationId && (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <MessageSquare className="h-12 w-12 mx-auto mb-2" />
                          <div>Chọn một cuộc hội thoại ở bên trái.</div>
                        </div>
                      </div>
                    )}
                    {activeConversationId && spansLoading && (
                      <div className="text-sm text-muted-foreground">Đang tải tin nhắn...</div>
                    )}
                    {activeConversationId && spansError && (
                      <div className="text-sm text-destructive">Lỗi: {spansErrorObj instanceof Error ? spansErrorObj.message : "Không tải được"}</div>
                    )}
                    {activeConversationId && !spansLoading && !spansError && (
                      <div className="space-y-3">
                        {(spansData ?? []).length === 0 && (
                          <div className="text-sm text-muted-foreground">No spans.</div>
                        )}
                        {(spansData ?? []).map((span) => {
                          const isUser = span.role === "user";
                          const isAssistant = span.role === "assistant";
                          return (
                            <div key={span.id} className={`flex ${isAssistant ? "justify-end" : isUser ? "justify-start" : "justify-center"}`}>
                              <div className={`max-w-[75%] rounded-lg p-3 shadow-sm ${isAssistant ? "bg-primary text-primary-foreground rounded-br-lg" : isUser ? "bg-muted text-foreground rounded-bl-lg" : "bg-accent/30 text-foreground"}`}>
                                <div className="mb-1 text-[11px] opacity-80">
                                  {span.role} • turn {span.turn_idx} • {new Date(span.created_at).toLocaleString()}
                                </div>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed">{span.text}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                  <div className="mt-4 rounded-md border border-border bg-card h-[50vh] p-4 overflow-y-auto">
                    <div className="text-xs text-muted-foreground mb-1">Tổng quan đánh giá</div>
                    <div className="mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!activeConversationId}
                        onClick={async () => {
                          if (!activeConversationId) return;
                          try {
                            await runQAEvaluations({ conversation_ids: [activeConversationId] });
                            // Refresh evaluation after re-run
                            await queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: activeConversationId }] });
                            toast({ title: "Bắt đầu chạy lại đánh giá", description: "Sẽ tự làm mới khi hoàn tất." });
                          } catch (e) {
                            const m = e instanceof Error ? e.message : "Chạy QA thất bại";
                            toast({ title: "Chạy lại đánh giá thất bại", description: m });
                          }
                        }}
                      >
                        Chạy lại đánh giá
                      </Button>
                    </div>
                    {evalLoading && <div className="text-xs text-muted-foreground">Đang tải đánh giá...</div>}
                    {!evalLoading && evalData && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-foreground">Hội thoại {evalData.conversation_id}</div>
                          <Button size="sm" variant="ghost" onClick={() => setShowEvalDetails((v) => !v)}>
                            {showEvalDetails ? "Ẩn chi tiết" : "Xem chi tiết"}
                          </Button>
                        </div>
                        {(() => {
                          const er: any = (evalData as any).evaluation_result || {};
                          const summary = er.summary || {};
                          const counts = summary.counts || {};
                          const errors: any[] = Array.isArray(er.errors) ? er.errors : [];
                          if (!showEvalDetails) {
                            const countEntries = Object.entries(counts).filter(([, v]) => Number(v) > 0);
                            const countText = countEntries.length
                              ? countEntries.map(([k, v]) => `${v} ${k}`).join(" • ")
                              : "không có vấn đề";
                            const highlights: string[] = Array.isArray(summary.highlights) ? summary.highlights : [];
                            return (
                              <div className="text-xs space-y-2">
                                <div className="text-foreground">
                                  {summary.overall ? `Tổng quan: ${summary.overall}` : "Tổng quan: n/a"}
                                </div>
                                <div className="text-muted-foreground">{countText}</div>
                                <div className="text-muted-foreground">Lỗi: {errors.length}</div>
                                {highlights.length > 0 && (
                                  <div className="text-foreground space-y-1">
                                    <div>Điểm nổi bật:</div>
                                    <ul className="list-disc pl-4 space-y-1">
                                      {highlights.slice(0, 3).map((h, i) => (
                                        <li key={i}>{h}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          // Detailed view
                          const stats = er.stats || {};
                          const highlights: string[] = (summary.highlights || []) as string[];
                          const nhan_xet = er.nhan_xet || {};
                          return (
                            <div className="space-y-3">
                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-md border border-border p-2 text-xs">
                                  <div className="text-muted-foreground">Lượt người dùng</div>
                                  <div className="font-medium text-foreground">{stats.user_turns ?? '-'}</div>
                                </div>
                                <div className="rounded-md border border-border p-2 text-xs">
                                  <div className="text-muted-foreground">Lượt trợ lý</div>
                                  <div className="font-medium text-foreground">{stats.assistant_turns ?? '-'}</div>
                                </div>
                                <div className="rounded-md border border-border p-2 text-xs">
                                  <div className="text-muted-foreground">Tổng lượt</div>
                                  <div className="font-medium text-foreground">{stats.turns_total ?? '-'}</div>
                                </div>
                              </div>
                              <div className="text-xs">
                                <div className="mb-1 text-muted-foreground">Tóm tắt</div>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(counts).map(([k, v]) => (
                                    <span key={k} className="px-2 py-1 rounded bg-accent/40 text-foreground">
                                      {k}: {String(v)}
                                    </span>
                                  ))}
                                  {summary.overall && (
                                    <span className="px-2 py-1 rounded bg-primary/20 text-foreground">tổng quan: {summary.overall}</span>
                                  )}
                                </div>
                              </div>
                              {highlights && highlights.length > 0 && (
                                <div className="text-xs">
                                  <div className="mb-1 text-muted-foreground">Điểm nổi bật</div>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {highlights.map((h, i) => (
                                      <li key={i} className="text-foreground">{h}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {Array.isArray(nhan_xet?.issues) && nhan_xet.issues.length > 0 && (
                                <div className="text-xs">
                                  <div className="mb-1 text-muted-foreground">Vấn đề</div>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {nhan_xet.issues.map((it: string, i: number) => (
                                      <li key={i} className="text-foreground">{it}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {nhan_xet?.topline && (
                                <div className="text-xs">
                                  <div className="mb-1 text-muted-foreground">Nhận định tổng quan</div>
                                  <p className="text-foreground leading-relaxed">{nhan_xet.topline}</p>
                                </div>
                              )}
                              {Array.isArray(nhan_xet?.strengths) && nhan_xet.strengths.length > 0 && (
                                <div className="text-xs">
                                  <div className="mb-1 text-muted-foreground">Điểm mạnh</div>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {nhan_xet.strengths.map((s: string, i: number) => (
                                      <li key={i} className="text-foreground">{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {Array.isArray(nhan_xet?.next_actions) && nhan_xet.next_actions.length > 0 && (
                                <div className="text-xs">
                                  <div className="mb-1 text-muted-foreground">Hành động tiếp theo</div>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {nhan_xet.next_actions.map((s: string, i: number) => (
                                      <li key={i} className="text-foreground">{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {errors && errors.length > 0 && (
                                <div className="text-xs">
                                  <div className="mb-1 text-muted-foreground">Lỗi (3 mục đầu)</div>
                                  <div className="space-y-2">
                                    {errors.slice(0, 3).map((e, i) => (
                                      <div key={i} className="rounded border border-border p-2">
                                        <div className="mb-1 text-muted-foreground">lượt {e.turn} • {e.type} • {e.severity}</div>
                                        {e.suggestion && <div className="text-foreground">{e.suggestion}</div>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {!evalLoading && !evalData && <div className="w-full h-full" />}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Proposals */}
            <TabsContent value="proposals" className="m-0 h-full">
              <div className="space-y-6 p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Proposals</h2>
                    <p className="text-muted-foreground">Review and manage bot improvement proposals</p>
                  </div>
                  <Select>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Proposals</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {proposals.map((proposal) => (
                    <Card key={proposal.id} className="bg-card border-border">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Badge variant={proposal.type === 'new' ? 'default' : 'secondary'}>
                            {proposal.type}
                          </Badge>
                          <Badge variant={
                            proposal.status === 'pending' ? 'outline' :
                            proposal.status === 'approved' ? 'default' : 'destructive'
                          }>
                            {proposal.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-foreground">{proposal.title}</CardTitle>
                        <CardDescription className="text-muted-foreground">{proposal.bot}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-4">{proposal.created}</p>
                        {proposal.status === 'pending' && (
                          <div className="flex space-x-2">
                            <Button size="sm" className="flex-1">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1">
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Reports */}
            <TabsContent value="reports" className="m-0 h-full">
              <div className="space-y-6 p-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Reports</h2>
                  <p className="text-muted-foreground">Detailed analytics and performance reports</p>
                </div>

                <div className="flex space-x-4">
                  <Select>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select bot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Bots</SelectItem>
                      <SelectItem value="support">Support Bot</SelectItem>
                      <SelectItem value="sales">Sales Bot</SelectItem>
                      <SelectItem value="hr">HR Bot</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" className="w-[180px]" />
                  <Button variant="outline">
                    Export PDF
                  </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Performance Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={businessData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Quality Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings" className="m-0">
              <div className="space-y-6 p-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Settings</h2>
                  <p className="text-muted-foreground">Configure system parameters and monitor health</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">QA Configuration</CardTitle>
                      <CardDescription className="text-muted-foreground">Adjust quality assessment parameters</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-foreground">Similarity Threshold</label>
                        <div className="mt-2">
                          <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className="w-full" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0.0</span>
                            <span>1.0</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Evaluation Frequency</label>
                        <Select>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="realtime">Real-time</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">System Health</CardTitle>
                      <CardDescription className="text-muted-foreground">Monitor service status and performance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        { name: "Backend API", status: "healthy" },
                        { name: "Database", status: "healthy" },
                        { name: "Redis Cache", status: "warning" },
                        { name: "OpenAI Service", status: "healthy" }
                      ].map((service) => (
                        <div key={service.name} className="flex items-center justify-between">
                          <span className="text-sm text-foreground">{service.name}</span>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              service.status === 'healthy' ? 'bg-green-500' :
                              service.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-xs capitalize text-muted-foreground">{service.status}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;