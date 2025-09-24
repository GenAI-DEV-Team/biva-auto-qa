// BIVA QA Agent - Quality Assurance System Dashboard

import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, MessageSquare, Settings, BarChart3, PlusCircle, Users, PanelLeftOpen, PanelLeftClose } from "lucide-react";
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
import { getEvaluation, runQAEvaluations, listEvaluations, updateEvaluationReview } from "@/lib/evaluationsApi";
import type { EvaluationRecord } from "@/types/evaluations";
import type { SpanResponse, ConversationResponse } from "@/types/conversations";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConversationDetail from "./ConversationDetail";
import { Textarea } from "@/components/ui/textarea";

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
  const [convPageInput, setConvPageInput] = useState<string>("");
  const [pinnedConv, setPinnedConv] = useState<ConversationResponse | null>(null);
  const [qaFilter, setQaFilter] = useState<"all" | "qa" | "notqa">("all");
  const [overallFilter, setOverallFilter] = useState<"all" | "good" | "warn" | "bad" | "other">("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | "reviewed" | "notreviewed">("all");
  const navigate = useNavigate();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [regenOpen, setRegenOpen] = useState<boolean>(false);
  const [regenTargetIndex, setRegenTargetIndex] = useState<number | null>(null);
  const [regenLoading, setRegenLoading] = useState<boolean>(false);
  
  // —— Timezone helpers (TZ+7 Asia/Ho_Chi_Minh) ——
  const TZ7 = "Asia/Ho_Chi_Minh";
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const formatYYYYMMDD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const formatYYYYMMDDHHmm = (d: Date) => `${formatYYYYMMDD(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const getTzShiftedDate = (d: Date, timeZone: string) => {
    // Convert a Date to the same wall-clock in the given timeZone by using Intl and parts diff
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(d).reduce((acc: any, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  };
  const nowTz7String = () => formatYYYYMMDDHHmm(getTzShiftedDate(new Date(), TZ7));
  const displayTz7 = (isoOrLocal: string) => {
    if (!isoOrLocal) return "";
    // Treat stored string as naive local in TZ+7 when no timezone present
    const hasZone = /[zZ]|[\+\-]\d{2}:?\d{2}$/.test(isoOrLocal);
    const base = hasZone ? new Date(isoOrLocal) : getTzShiftedDate(new Date(isoOrLocal), TZ7);
    return base.toLocaleString("vi-VN", { timeZone: TZ7, hour12: false });
  };
  const extractTimeFromLocal = (local: string) => (local ? (local.match(/T(\d{2}:\d{2})/)?.[1] ?? "") : "");
  const extractDateFromLocal = (local: string) => (local ? (local.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "") : "");
  const buildLocalFromParts = (datePart: string, timePart: string) => (datePart ? `${datePart}T${timePart || "00:00"}` : "");
  const calendarSelectedFromLocal = (local: string) => {
    const d = extractDateFromLocal(local);
    if (!d) return undefined;
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, dd ?? 1);
  };

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
  const [botsPage, setBotsPage] = useState<number>(1);
  const botsPageSize = 10;
  const botsTotalPages = Math.max(1, Math.ceil((bots?.length || 0) / botsPageSize));
  useEffect(() => {
    // Reset or clamp page when data changes
    setBotsPage((p) => Math.min(Math.max(1, p), botsTotalPages));
  }, [botsTotalPages]);
  const [botsPageInput, setBotsPageInput] = useState<string>("");
  const botsPageItems = useMemo(() => {
    const start = (botsPage - 1) * botsPageSize;
    return bots.slice(start, start + botsPageSize);
  }, [bots, botsPage, botsPageSize]);
  const isLegacyIndexValid = /^\d+$/.test(legacyIndexInput.trim());

  const [serverPage, setServerPage] = useState<number>(1);
  const serverPageSize = 30;
  const { data: conversationsData, isLoading: conversationsLoading, isError: conversationsError, error: conversationsErrorObj, refetch: refetchConversations } = useQuery({
    queryKey: ["conversations", { bot_id: conversationsBotFilter, start_ts: convStartTs || undefined, end_ts: convEndTs || undefined, limit: serverPageSize, offset: (serverPage - 1) * serverPageSize }],
    queryFn: () => listConversations({
      bot_id: conversationsBotFilter ?? undefined,
      start_ts: convStartTs || undefined,
      end_ts: convEndTs || undefined,
      phone_like: convPhoneFilter || undefined,
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

  const getOverallBucket = (overall: string): "good" | "warn" | "bad" | "other" => {
    const t = String(overall || "").toLowerCase();
    if (["good", "pass", "ok", "tốt", "đạt"].some((k) => t.includes(k))) return "good";
    if (["warn", "warning", "medium", "average", "ổn", "trung bình"].some((k) => t.includes(k))) return "warn";
    if (["fail", "failed", "bad", "poor", "kém", "lỗi", "error"].some((k) => t.includes(k))) return "bad";
    return "other";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className={`border-r bg-card h-screen ${sidebarCollapsed ? "w-16" : "w-64"} flex flex-col shadow-lg transition-all duration-200`}>
          {/* Logo */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3 justify-between">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg mx-auto">
                <Brain className="h-6 w-6 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 pl-2">
                  <h2 className="font-bold text-lg text-foreground leading-none">BIVA QA Agent</h2>
                  <p className="text-xs text-muted-foreground">Quality Assurance</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: BarChart3 },
              { id: "bots", label: "Bot Management", icon: Brain },
              { id: "conversations", label: "Conversations", icon: MessageSquare }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "space-x-3"} px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="p-3 border-t border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
                <Users className="h-4 w-4 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">QA Admin</p>
                  <p className="text-xs text-muted-foreground">admin@biva.com</p>
                </div>
              )}
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
                {/* <Card className="bg-card border-border">
                  <CardHeader>
                      <CardTitle className="text-foreground">Settings</CardTitle>
                      <CardDescription className="text-muted-foreground">Cấu hình hệ thống</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Button variant="outline" onClick={() => setActiveTab("settings")}>Mở Settings</Button>
                  </CardContent>
                </Card> */}
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
                    {botsPageItems.map((bot) => (
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
                                  setServerPage(1);
                                  setActiveTab("conversations");
                                }}
                              >
                                View Details
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => { setRegenTargetIndex(bot.index); setRegenOpen(true); }}
                              >
                                Regen KB
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {bots.length > 0 && (
                      <div className="pt-2 flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={botsPage <= 1} onClick={() => setBotsPage((p) => Math.max(1, p - 1))}>Prev</Button>
                        <span className="text-xs text-muted-foreground">Page {botsPage} / {botsTotalPages}</span>
                        <Input
                          placeholder="Go to"
                          inputMode="numeric"
                          className="w-20"
                          value={botsPageInput}
                          onChange={(e) => setBotsPageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const n = parseInt(botsPageInput || "1", 10);
                              if (!isNaN(n) && n >= 1) setBotsPage(Math.min(Math.max(1, n), botsTotalPages));
                            }
                          }}
                        />
                        <Button size="sm" variant="outline" onClick={() => { const n = parseInt(botsPageInput || "1", 10); if (!isNaN(n) && n >= 1) setBotsPage(Math.min(Math.max(1, n), botsTotalPages)); }}>Go</Button>
                        <Button size="sm" variant="outline" disabled={botsPage >= botsTotalPages} onClick={() => setBotsPage((p) => Math.min(botsTotalPages, p + 1))}>Next</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Conversations */}
            <TabsContent value="conversations" className="m-0 h-full">
              <div className="flex h-full">
                <div className="w-full h-[100vh] border-r border-border p-6 space-y-5 flex flex-col">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSidebarCollapsed((c) => !c)}>
                          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                        </Button>
                        <h2 className="text-xl font-bold text-foreground">Conversations</h2>
                      </div>
                    </div>
                    {conversationsBotFilter != null && (
                      <div className="mb-4 p-2 rounded-md bg-accent/30 text-xs text-muted-foreground flex items-center justify-between">
                        <span>Filtered by bot index: {conversationsBotFilter}</span>
                        <Button variant="outline" size="sm" onClick={() => setConversationsBotFilter(null)}>Xoá</Button>
                      </div>
                    )}
                    <div className="mb-2 flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={() => setFiltersOpen((o) => !o)}>
                        {filtersOpen ? "Thu gọn bộ lọc" : "Hiển thị bộ lọc"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setConvPage(1);
                        setServerPage(1);
                        if (!convEndTs.trim()) {
                          setConvEndTs(nowTz7String());
                        } else {
                          refetchConversations();
                        }
                      }}>Áp dụng</Button>
                    </div>
                    <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <CollapsibleContent>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="space-y-1">
                        <Label>Ngày bắt đầu</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start font-normal">
                              {convStartTs ? displayTz7(convStartTs) : "Ngày bắt đầu (GMT+7)"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-auto p-0">
                            <div className="p-2 space-y-2">
                              <Calendar mode="single" selected={calendarSelectedFromLocal(convStartTs)} onSelect={(d) => d && setConvStartTs(buildLocalFromParts(formatYYYYMMDD(getTzShiftedDate(d, TZ7)), extractTimeFromLocal(convStartTs)))} />
                              <div className="flex items-center gap-2">
                                <Select value={(extractTimeFromLocal(convStartTs).split(":")[0] || "")} onValueChange={(hh) => {
                                  const mm = extractTimeFromLocal(convStartTs).split(":")[1] || "00";
                                  setConvStartTs(buildLocalFromParts(extractDateFromLocal(convStartTs), `${hh}:${mm}`));
                                }}>
                                  <SelectTrigger className="w-[84px]"><SelectValue placeholder="HH" /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                                      <SelectItem key={h} value={h}>{h}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={(extractTimeFromLocal(convStartTs).split(":")[1] || "")} onValueChange={(mm) => {
                                  const hh = extractTimeFromLocal(convStartTs).split(":")[0] || "00";
                                  setConvStartTs(buildLocalFromParts(extractDateFromLocal(convStartTs), `${hh}:${mm}`));
                                }}>
                                  <SelectTrigger className="w-[84px]"><SelectValue placeholder="MM" /></SelectTrigger>
                                  <SelectContent>
                                    {["00","15","30","45"].map((m) => (
                                      <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => setConvStartTs(nowTz7String())}>Bây giờ (GMT+7)</Button>
                                <Button size="sm" variant="outline" onClick={() => setConvStartTs("")}>Xoá</Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label>Ngày kết thúc</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start font-normal">
                              {convEndTs ? displayTz7(convEndTs) : "Ngày kết thúc (GMT+7)"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-auto p-0">
                            <div className="p-2 space-y-2">
                              <Calendar mode="single" selected={calendarSelectedFromLocal(convEndTs)} onSelect={(d) => d && setConvEndTs(buildLocalFromParts(formatYYYYMMDD(getTzShiftedDate(d, TZ7)), extractTimeFromLocal(convEndTs)))} />
                              <div className="flex items-center gap-2">
                                <Select value={(extractTimeFromLocal(convEndTs).split(":")[0] || "")} onValueChange={(hh) => {
                                  const mm = extractTimeFromLocal(convEndTs).split(":")[1] || "00";
                                  setConvEndTs(buildLocalFromParts(extractDateFromLocal(convEndTs), `${hh}:${mm}`));
                                }}>
                                  <SelectTrigger className="w-[84px]"><SelectValue placeholder="HH" /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                                      <SelectItem key={h} value={h}>{h}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={(extractTimeFromLocal(convEndTs).split(":")[1] || "")} onValueChange={(mm) => {
                                  const hh = extractTimeFromLocal(convEndTs).split(":")[0] || "00";
                                  setConvEndTs(buildLocalFromParts(extractDateFromLocal(convEndTs), `${hh}:${mm}`));
                                }}>
                                  <SelectTrigger className="w-[84px]"><SelectValue placeholder="MM" /></SelectTrigger>
                                  <SelectContent>
                                    {["00","15","30","45"].map((m) => (
                                      <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => setConvEndTs(nowTz7String())}>Bây giờ (GMT+7)</Button>
                                <Button size="sm" variant="outline" onClick={() => setConvEndTs("")}>Xoá</Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <Label>Số điện thoại</Label>
                        <Input placeholder="Lọc theo số điện thoại" className="w-full" value={convPhoneFilter} onChange={(e) => setConvPhoneFilter(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Bot</Label>
                        <Select value={conversationsBotFilter !== null ? String(conversationsBotFilter) : "__all__"} onValueChange={(v) => { setConversationsBotFilter(v && v !== "__all__" ? Number(v) : null); setConvPage(1); setServerPage(1); }}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Lọc theo Bot" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Tất cả Bot</SelectItem>
                            {(bots ?? []).map((b) => (
                              <SelectItem key={b.index} value={String(b.index)}>{b.index} - {b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="space-y-1">
                        <Label>Trạng thái QA</Label>
                        <Select value={qaFilter} onValueChange={(v) => { setQaFilter(v as any); setConvPage(1); setServerPage(1); }}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Trạng thái QA" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="qa">AI đã đánh giá</SelectItem>
                            <SelectItem value="notqa">AI chưa đánh giá</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Tổng quan</Label>
                        <Select value={overallFilter} onValueChange={(v) => { setOverallFilter(v as any); setConvPage(1); setServerPage(1); }}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Tổng quan" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả tổng quan</SelectItem>
                            <SelectItem value="good">Tốt</SelectItem>
                            <SelectItem value="warn">Cảnh báo</SelectItem>
                            <SelectItem value="bad">Thất bại</SelectItem>
                            <SelectItem value="other">Khác</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Review</Label>
                        <Select value={reviewFilter} onValueChange={(v) => { setReviewFilter(v as any); setConvPage(1); setServerPage(1); }}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Review" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tất cả</SelectItem>
                            <SelectItem value="reviewed">Đã review</SelectItem>
                            <SelectItem value="notreviewed">Chưa review</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Sắp xếp</Label>
                        <Select value={convSortDir} onValueChange={(v) => setConvSortDir(v as any)}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Sắp xếp" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="desc">Mới nhất</SelectItem>
                            <SelectItem value="asc">Cũ nhất</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    </CollapsibleContent>
                    </Collapsible>
                    <div className="flex items-center gap-3 mb-4">
                      <Input
                        placeholder="Mã hội thoại"
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
                        {isSearchingConvId ? "Đang tải..." : "Tải"}
                      </Button>
                      <Button
                        onClick={async () => {
                          const cid = convIdSearch.trim();
                          if (!cid) return;
                          setSelectedConvIds([cid]);
                          setConfirmOpen(true);
                        }}
                        disabled={!convIdSearch.trim() || qaRunningIds.has(convIdSearch.trim())}
                      >
                        {qaRunningIds.has(convIdSearch.trim()) ? "Running..." : "Run QA"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedConvIds([])}>Clear Selection</Button>
                        <Button size="sm" disabled={selectedConvIds.length === 0 || selectedConvIds.length > 20} onClick={() => setConfirmOpen(true)}>RUN_QAS</Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="px-3 py-1 text-sm">Selected: {selectedConvIds.length}</Badge>
                        <span className="text-xs text-muted-foreground">(max 20)</span>
                      </div>
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
                            .filter((c) => {
                              const cid = c.conversation_id ?? String(c.id);
                              const rec = evalMap.get(cid);
                              const has = !!rec;
                              if (qaFilter === "qa" && !has) return false;
                              if (qaFilter === "notqa" && has) return false;
                              if (reviewFilter !== "all") {
                                const reviewed = rec?.reviewed === true;
                                if (reviewFilter === "reviewed" && !reviewed) return false;
                                if (reviewFilter === "notreviewed" && reviewed) return false;
                              }
                              if (overallFilter !== "all") {
                                if (!has) return false;
                                const overall = (rec?.evaluation_result as any)?.summary?.overall ?? "";
                                return getOverallBucket(overall) === overallFilter;
                              }
                              return true;
                            })
                            .sort((a, b) => {
                              const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                              const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                              return convSortDir === "desc" ? tb - ta : ta - tb;
                            });

                          // Always bring selected conversations to the top within the current page
                          const selectedSet = new Set(selectedConvIds);
                          const selectedItems = all.filter((c) => selectedSet.has(c.conversation_id ?? String(c.id)));
                          const unselectedItems = all.filter((c) => !selectedSet.has(c.conversation_id ?? String(c.id)));
                          const pageItems = [...selectedItems, ...unselectedItems];

                          return (
                            <>
                              {pinnedConv && (
                                <div className="mb-2 p-2 rounded border border-border bg-accent/20 text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium">Pinned: {pinnedConv.conversation_id ?? String(pinnedConv.id)}</div>
                                    <Button size="sm" variant="outline" onClick={() => setPinnedConv(null)}>Unpin</Button>
                                  </div>
                                </div>
                              )}
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[40px]"><input type="checkbox" onChange={(e) => {
                                      const ids = pageItems.map((c) => c.conversation_id ?? String(c.id));
                                      setSelectedConvIds(e.target.checked ? Array.from(new Set([...selectedConvIds, ...ids])) : selectedConvIds.filter((id) => !ids.includes(id)));
                                    }} /></TableHead>
                                    <TableHead>Conversation ID</TableHead>
                                    <TableHead>Số điện thoại</TableHead>
                                    <TableHead>Bot</TableHead>
                                    <TableHead>Thời gian tạo</TableHead>
                                    <TableHead>Tóm tắt QA</TableHead>
                                    <TableHead className="text-right">Thao tác</TableHead>
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
                                    const reviewed = evalMap.get(convId)?.reviewed ?? false;
                                    const reviewNote = evalMap.get(convId)?.review_note ?? "";
                                    const qaCounts: Record<string, unknown> = evalObj?.summary?.counts || {};
                          return (
                                      <TableRow key={convId}>
                                        <TableCell><input type="checkbox" checked={isSelected} onChange={(e) => setSelectedConvIds((prev) => e.target.checked ? [...prev, convId] : prev.filter((id) => id !== convId))} /></TableCell>
                                        <TableCell className={`font-mono text-xs truncate max-w-[220px] px-2 py-1 rounded ${qaOverall ? getOverallClasses(qaOverall) : ""}`} title={convId}>{convId}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={phone}>{phone}</TableCell>
                                        <TableCell className="text-xs">{conv.bot_id ?? "-"}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={created}>{created}</TableCell>
                                        <TableCell className="text-xs align-top max-w-[640px]">
                                          {/* {Object.keys(qaCounts).length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1">
                                              {Object.entries(qaCounts).map(([k, v]) => (
                                                <span key={k} className="px-1.5 py-0.5 rounded bg-accent/40 text-foreground whitespace-nowrap">{k}: {String(v)}</span>
                                              ))}
                                </div>
                                          )} */}
                                          <div className="flex items-center gap-2 mb-1">
                                            {reviewed && (
                                              <Badge variant="secondary" className="text-[10px]">Đã review</Badge>
                                            )}
                                          </div>
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
                                            <Button size="sm" variant="outline" onClick={() => setDetailId(convId)}>Chi tiết</Button>
                                            <Button size="sm" variant="outline" disabled={isRunning} onClick={() => {
                                              setSelectedConvIds([convId]);
                                              setConfirmOpen(true);
                                            }}>{isRunning ? "Đang chạy..." : "Chạy QA"}</Button>
                                            {/* Removed external Review button per request */}
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
                                <Input
                                  placeholder="Go to"
                                  inputMode="numeric"
                                  className="w-20"
                                  value={convPageInput}
                                  onChange={(e) => setConvPageInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const n = parseInt(convPageInput || "1", 10);
                                      if (!isNaN(n) && n >= 1) setServerPage(n);
                                    }
                                  }}
                                />
                                <Button size="sm" variant="outline" onClick={() => { const n = parseInt(convPageInput || "1", 10); if (!isNaN(n) && n >= 1) setServerPage(n); }}>Go</Button>
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
              <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Conversation {detailId}</DialogTitle>
                </DialogHeader>
                {detailId && (
                  <div className="h-[calc(90vh-60px)] overflow-auto">
                    <ConversationDetail id={detailId} />
                          </div>
                        )}
              </DialogContent>
            </Dialog>

            {/* External Review dialog removed as per request */}

            {/* Confirm Regen KB */}
            <Dialog open={regenOpen} onOpenChange={(open) => !regenLoading && setRegenOpen(open)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate Knowledge Base</DialogTitle>
                </DialogHeader>
                <div className="text-sm text-muted-foreground">Bạn có chắc muốn tạo lại KB cho bot index {regenTargetIndex ?? "?"}?</div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRegenOpen(false)} disabled={regenLoading}>Hủy</Button>
                  <Button
                    onClick={async () => {
                      if (regenTargetIndex == null) return;
                      setRegenLoading(true);
                      try {
                        const ver = await regenerateKnowledgeBase(regenTargetIndex);
                        toast({ title: "Knowledge base regenerated", description: `New version at ${new Date(ver.created_at).toLocaleString()}` });
                        setRegenOpen(false);
                      } catch (e) {
                        const m = e instanceof Error ? e.message : "Failed to regenerate";
                        toast({ title: "Regenerate failed", description: m });
                      } finally {
                        setRegenLoading(false);
                      }
                    }}
                    disabled={regenLoading}
                  >
                    {regenLoading ? "Đang chạy..." : "Run"}
                  </Button>
                </DialogFooter>
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
                    if (ids.length > 20) {
                      toast({ title: "Quá số lượng", description: "Chỉ chạy tối đa 20 hội thoại một lần" });
                      return;
                    }
                    setConfirmLoading(true);
                    // Immediately close the dialog after confirmation
                    setConfirmOpen(false);
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