// BIVA QA Agent - Quality Assurance System Dashboard

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, MessageSquare, Settings, BarChart3, PlusCircle, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QAEvaluator } from "@/components/qa-evaluation/QAEvaluator";
import { ConversationAnalysis, SpanEvaluation } from "@/types/qa";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBots, createBotByLegacyIndex, regenerateKnowledgeBase } from "@/lib/botsApi";
import type { BotResponse } from "@/types/bots";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { listConversations, listSpans, getConversation } from "@/lib/conversationsApi";
import { getEvaluation, runQAEvaluations, listEvaluations } from "@/lib/evaluationsApi";
import type { EvaluationRecord } from "@/types/evaluations";
import type { SpanResponse, ConversationResponse } from "@/types/conversations";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConversationDetail from "./ConversationDetail";

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
  const [qaRunningIds, setQaRunningIds] = useState<Set<string>>(new Set());
  const [qaOverrideSummary, setQaOverrideSummary] = useState<Map<string, string>>(new Map());
  const [convPage, setConvPage] = useState<number>(1);
  const pageSize = 20;
  const [convIdSearch, setConvIdSearch] = useState<string>("");
  const [isSearchingConvId, setIsSearchingConvId] = useState<boolean>(false);
  const [pinnedConv, setPinnedConv] = useState<ConversationResponse | null>(null);
  const [showOnlyQA, setShowOnlyQA] = useState<boolean>(false);
  const [showOnlyNotQA, setShowOnlyNotQA] = useState<boolean>(false);
  const navigate = useNavigate();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
  
  // Simplified home — no heavy charts/hero; quick actions only

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

  const [serverPage, setServerPage] = useState<number>(1);
  const serverPageSize = 50;
  const { data: conversationsData, isLoading: conversationsLoading, isError: conversationsError, error: conversationsErrorObj, refetch: refetchConversations } = useQuery({
    queryKey: ["conversations", { bot_id: conversationsBotFilter, start_ts: convStartTs || undefined, end_ts: convEndTs || undefined, limit: serverPageSize, offset: (serverPage - 1) * serverPageSize }],
    queryFn: () => listConversations({
      bot_id: conversationsBotFilter ?? undefined,
      start_ts: convStartTs || undefined,
      end_ts: convEndTs || undefined,
      limit: serverPageSize,
      offset: (serverPage - 1) * serverPageSize,
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

  // Recent evaluations for QA summaries and filtering
  const { data: evalsData } = useQuery({
    queryKey: ["evaluations", { limit: 200 }],
    queryFn: () => listEvaluations(200),
    enabled: activeTab === "conversations",
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const evalMap = useMemo(() => {
    const m = new Map<string, EvaluationRecord>();
    for (const e of evalsData ?? []) m.set(e.conversation_id, e);
    return m;
  }, [evalsData]);

  const getOverallClasses = (overall: string) => {
    const t = String(overall || "").toLowerCase();
    const isGood = ["good", "pass", "ok", "tốt", "đạt"].some((k) => t.includes(k));
    const isWarn = ["warn", "warning", "medium", "average", "ổn", "trung bình"].some((k) => t.includes(k));
    const isBad = ["fail", "failed", "bad", "poor", "kém", "lỗi", "error"].some((k) => t.includes(k));
    if (isGood) return "bg-emerald-500/20 text-emerald-700"; // xanh
    if (isWarn) return "bg-amber-500/25 text-amber-800";      // vàng đậm
    if (isBad) return "bg-rose-500/20 text-rose-700";         // đỏ
    return "bg-muted text-foreground";
  };

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
              { id: "conversations", label: "Conversations", icon: MessageSquare }
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
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Brain className="h-6 w-6" />
                  <h2 className="text-xl font-semibold text-foreground">BIVA QA Agent</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Conversations</CardTitle>
                      <CardDescription className="text-muted-foreground">Xem và chạy QA</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => setActiveTab("conversations")}>Mở Conversations</Button>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Bot Management</CardTitle>
                      <CardDescription className="text-muted-foreground">Quản lý bots</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => setActiveTab("bots")}>Mở Bots</Button>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Settings</CardTitle>
                      <CardDescription className="text-muted-foreground">Cấu hình hệ thống</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" onClick={() => setActiveTab("settings")}>Mở Settings</Button>
                    </CardContent>
                  </Card>
                </div>
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
                <div className="w-full h-[100vh] border-r border-border p-6 space-y-5 flex flex-col">
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
                      <Select value={conversationsBotFilter !== null ? String(conversationsBotFilter) : "__all__"} onValueChange={(v) => { setConversationsBotFilter(v && v !== "__all__" ? Number(v) : null); setConvPage(1); }}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by Bot index" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Bots</SelectItem>
                          {(bots ?? []).map((b) => (
                            <SelectItem key={b.index} value={String(b.index)}>{b.index} - {b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={showOnlyQA} onChange={(e) => { const v = e.target.checked; setShowOnlyQA(v); if (v) setShowOnlyNotQA(false); setConvPage(1); }} />
                        Only QA'd
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={showOnlyNotQA} onChange={(e) => { const v = e.target.checked; setShowOnlyNotQA(v); if (v) setShowOnlyQA(false); setConvPage(1); }} />
                        Only not QA'd
                      </label>
                      <Select value={convSortDir} onValueChange={(v) => setConvSortDir(v as any)}>
                        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sort" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">Newest first</SelectItem>
                          <SelectItem value="asc">Oldest first</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => { setConvPage(1); setServerPage(1); refetchConversations(); }}>Apply</Button>
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
                            setQaRunningIds((s) => new Set(s).add(cid));
                            await runQAEvaluations({ conversation_ids: [cid] });
                            await queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: cid }] });
                            toast({ title: "QA run started", description: "Evaluation will refresh when ready." });
                          } catch (err) {
                            const m = err instanceof Error ? err.message : "Failed to run QA";
                            toast({ title: "Run QA failed", description: m });
                          } finally {
                            setQaRunningIds((s) => { const n = new Set(s); n.delete(cid); return n; });
                          }
                        }}
                        disabled={!convIdSearch.trim() || qaRunningIds.has(convIdSearch.trim())}
                      >
                        {qaRunningIds.has(convIdSearch.trim()) ? "Running..." : "Run QA"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedConvIds([])}>Clear Selection</Button>
                        <Button size="sm" disabled={selectedConvIds.length === 0} onClick={() => setConfirmOpen(true)}>RUN_QAS</Button>
                      </div>
                      <div className="text-xs text-muted-foreground">{selectedConvIds.length} selected</div>
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
                      <div>
                        {(() => {
                          let all = (conversationsData ?? [])
                            .filter((c) => (convPhoneFilter.trim() ? (c.customer_phone || "").includes(convPhoneFilter.trim()) : true))
                            .filter((c) => {
                              const cid = c.conversation_id ?? String(c.id);
                              const has = evalMap.has(cid);
                              if (showOnlyQA) return has;
                              if (showOnlyNotQA) return !has;
                              return true;
                            })
                            .sort((a, b) => {
                              const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                              const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                              return convSortDir === "desc" ? tb - ta : ta - tb;
                            });

                          if (pinnedConv) {
                            const pid = pinnedConv.conversation_id ?? String(pinnedConv.id);
                            all = [pinnedConv, ...all.filter((c) => (c.conversation_id ?? String(c.id)) !== pid)];
                          }
                          // Server-side page slice already applied; just show the list as-is for current server page
                          const pageItems = all;

                          return (
                            <>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[40px]"><input type="checkbox" onChange={(e) => {
                                      const ids = pageItems.map((c) => c.conversation_id ?? String(c.id));
                                      setSelectedConvIds(e.target.checked ? Array.from(new Set([...selectedConvIds, ...ids])) : selectedConvIds.filter((id) => !ids.includes(id)));
                                    }} /></TableHead>
                                    <TableHead>Conversation ID</TableHead>
                                    <TableHead>Customer phone</TableHead>
                                    <TableHead>Bot</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>QA summary</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {pageItems.map((conv) => {
                          const convId = conv.conversation_id ?? String(conv.id);
                          const phone = conv.customer_phone ?? "Unknown";
                          const created = conv.created_at ? new Date(conv.created_at).toLocaleString() : "";
                          const isSelected = selectedConvIds.includes(convId);
                                    const isRunning = qaRunningIds.has(convId);
                                    const evalObj: any = evalMap.get(convId)?.evaluation_result || null;
                                    const qaOverall = (() => {
                                      const override = qaOverrideSummary.get(convId);
                                      if (override) return override;
                                      const summary = evalObj?.summary || null;
                                      return summary?.overall ?? "";
                                    })();
                                    const qaHighlights: string[] = Array.isArray(evalObj?.summary?.highlights) ? evalObj?.summary?.highlights : [];
                                    const qaCounts: Record<string, unknown> = evalObj?.summary?.counts || {};
                          return (
                                      <TableRow key={convId}>
                                        <TableCell><input type="checkbox" checked={isSelected} onChange={(e) => setSelectedConvIds((prev) => e.target.checked ? [...prev, convId] : prev.filter((id) => id !== convId))} /></TableCell>
                                        <TableCell className={`font-mono text-xs truncate max-w-[220px] px-2 py-1 rounded ${qaOverall ? getOverallClasses(qaOverall) : ""}`} title={convId}>{convId}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={phone}>{phone}</TableCell>
                                        <TableCell className="text-xs">{conv.bot_id ?? "-"}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={created}>{created}</TableCell>
                                        <TableCell className="text-xs align-top max-w-[640px]">
                                          {Object.keys(qaCounts).length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1">
                                              {Object.entries(qaCounts).map(([k, v]) => (
                                                <span key={k} className="px-1.5 py-0.5 rounded bg-accent/40 text-foreground whitespace-nowrap">{k}: {String(v)}</span>
                                              ))}
                                </div>
                                          )}
                                          {qaHighlights.length > 0 ? (
                                            <ul className="list-disc pl-4 space-y-1">
                                              {qaHighlights.map((h, i) => (
                                                <li key={i} className="text-foreground break-words">{h}</li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <span className="text-muted-foreground"></span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-2">
                                            <Button size="sm" variant="outline" onClick={() => setDetailId(convId)}>Detail</Button>
                                            <Button size="sm" variant="outline" disabled={isRunning} onClick={async () => {
                                              try {
                                                setQaRunningIds((s) => new Set(s).add(convId));
                                        await runQAEvaluations({ conversation_ids: [convId] });
                                        await queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: convId }] });
                                                await queryClient.invalidateQueries({ queryKey: ["evaluations"] });
                                                setQaOverrideSummary((prev) => {
                                                  const n = new Map(prev);
                                                  n.set(convId, "updated"); // temporary tag until evals query refreshes
                                                  return n;
                                                });
                                        toast({ title: "QA run started", description: "Evaluation will refresh when ready." });
                                      } catch (err) {
                                        const m = err instanceof Error ? err.message : "Failed to run QA";
                                        toast({ title: "Run QA failed", description: m });
                                      } finally {
                                                setQaRunningIds((s) => { const n = new Set(s); n.delete(convId); return n; });
                                              }
                                            }}>{isRunning ? "Running..." : "QA Run"}</Button>
                                </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                              <div className="pt-3 flex items-center justify-end gap-2">
                                <Button size="sm" variant="outline" disabled={serverPage <= 1} onClick={() => setServerPage((p) => Math.max(1, p - 1))}>Prev</Button>
                                <span className="text-xs text-muted-foreground">Page {serverPage}</span>
                                <Button size="sm" variant="outline" disabled={(conversationsData ?? []).length < serverPageSize} onClick={() => setServerPage((p) => p + 1)}>Next</Button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
            <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
              <DialogContent className="max-w-5xl h-[85vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Conversation {detailId}</DialogTitle>
                </DialogHeader>
                {detailId && (
                  <div className="h-[calc(85vh-60px)] overflow-auto">
                    <ConversationDetail id={detailId} />
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Confirm RUN_QAS */}
            <Dialog open={confirmOpen} onOpenChange={(open) => setConfirmOpen(open)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Run QA cho {selectedConvIds.length} hội thoại?</DialogTitle>
                </DialogHeader>
                <div className="text-sm text-muted-foreground">
                  Hệ thống sẽ đánh giá các hội thoại đã chọn. Quá trình có thể mất vài phút.
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={confirmLoading}>Hủy</Button>
                  <Button onClick={async () => {
                    const ids = Array.from(new Set(selectedConvIds));
                    if (ids.length === 0) { setConfirmOpen(false); return; }
                    setConfirmLoading(true);
                    try {
                      setQaRunningIds((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n; });
                      await runQAEvaluations({ conversation_ids: ids });
                      await Promise.all(ids.map((id) => queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: id }] })));
                      await queryClient.invalidateQueries({ queryKey: ["evaluations"] });
                      setQaOverrideSummary((prev) => {
                        const n = new Map(prev);
                        ids.forEach((id) => n.set(id, "updated"));
                        return n;
                      });
                      toast({ title: "QA started", description: `Đang chạy QA cho ${ids.length} hội thoại` });
                      setConfirmOpen(false);
                    } catch (err) {
                      const m = err instanceof Error ? err.message : "Failed to run QA";
                      toast({ title: "Run QA failed", description: m });
                    } finally {
                      setConfirmLoading(false);
                      setQaRunningIds((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
                    }
                  }} disabled={confirmLoading}>{confirmLoading ? "Đang chạy..." : "Run"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;