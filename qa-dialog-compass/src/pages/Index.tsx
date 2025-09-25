// BIVA QA Agent - Quality Assurance System Dashboard

import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, MessageSquare, Settings, BarChart3, PlusCircle, Users, TrendingUp, Activity, Clock, CheckCircle, LogOut } from "lucide-react";
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
import { getSheetsList, getConversationsForSheets, updateGoogleSheets, type SheetInfo, type ConversationRow, type UpdateRequest } from "@/lib/sheetsApi";
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
import { Header } from "@/components/layout/Header";

const Index = () => {
  const { logout } = useAuth() || { logout: async () => {} };
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
  const [searchInput, setSearchInput] = useState<string>("");

  // Debounced search input for performance
  const [debouncedSearchInput, setDebouncedSearchInput] = useState<string>("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchInput(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
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

  // Sheets dialog states
  const [sheetsDialogOpen, setSheetsDialogOpen] = useState<boolean>(false);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [selectedConversations, setSelectedConversations] = useState<any[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState<boolean>(false);
  const [updateLoading, setUpdateLoading] = useState<boolean>(false);
  
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

  const [clientPage, setClientPage] = useState<number>(1);
  const clientPageSize = 20;

  // Get ALL conversations for client-side filtering and pagination
  // Backend filters: bot_id, time range, phone_like, qa_status (basic + QA filters)
  // Frontend filters: review status, overall rating (remaining complex filters)
  const { data: allConversationsData, isLoading: conversationsLoading, isError: conversationsError, error: conversationsErrorObj, refetch: refetchConversations } = useQuery({
    queryKey: ["conversations", "all", {
      bot_id: conversationsBotFilter,
      start_ts: convStartTs || undefined,
      end_ts: convEndTs || undefined,
      phone_like: debouncedSearchInput || undefined,
      qa_status: qaFilter === "all" ? null : qaFilter // Send QA filter to backend
    }],
    queryFn: () => listConversations({
      bot_id: conversationsBotFilter ?? undefined,
      start_ts: convStartTs || undefined,
      end_ts: convEndTs || undefined,
      phone_like: debouncedSearchInput || undefined,
      qa_status: qaFilter === "all" ? null : qaFilter, // Send QA filter to backend
      limit: 1000, // Get up to 1000 conversations for client-side filtering
      offset: 0,
    }),
    enabled: activeTab === "conversations",
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Get paginated conversations for server-side pagination (keeping for compatibility)
  const { data: serverConversationsData } = useQuery({
    queryKey: ["conversations", {
      bot_id: conversationsBotFilter,
      start_ts: convStartTs || undefined,
      end_ts: convEndTs || undefined,
      qa_status: qaFilter === "all" ? null : qaFilter,
      limit: clientPageSize,
      offset: (clientPage - 1) * clientPageSize
    }],
    queryFn: () => listConversations({
      bot_id: conversationsBotFilter ?? undefined,
      start_ts: convStartTs || undefined,
      end_ts: convEndTs || undefined,
      phone_like: debouncedSearchInput || undefined,
      qa_status: qaFilter === "all" ? null : qaFilter, // Send QA filter to backend
      limit: clientPageSize,
      offset: (clientPage - 1) * clientPageSize,
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

  // Reset to first page when any filter changes
  useEffect(() => {
    setClientPage(1);
  }, [qaFilter, reviewFilter, overallFilter, conversationsBotFilter, convStartTs, convEndTs, convPhoneFilter, convSortDir, debouncedSearchInput]);

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

  // Client-side filtering and pagination logic (moved after evalMap definition)
  // This provides real-time filtering as user changes filters
  const { filteredConversations, totalPages, totalFiltered } = useMemo(() => {
    if (!allConversationsData) {
      return { filteredConversations: [], totalPages: 1, totalFiltered: 0 };
    }

    // Filter conversations based on remaining frontend filters
    // QA status filter is now handled by backend, so only review and overall filters remain
    const filtered = allConversationsData.filter((conv) => {
      const convId = conv.conversation_id ?? String(conv.id);
      const rec = evalMap.get(convId);
      const hasEvaluation = !!rec;

      // Apply review filter (frontend filter)
      if (reviewFilter !== "all") {
        const reviewed = rec?.reviewed === true;
        if (reviewFilter === "reviewed" && !reviewed) return false;
        if (reviewFilter === "notreviewed" && reviewed) return false;
      }

      // Apply overall filter (frontend filter)
      if (overallFilter !== "all") {
        if (!hasEvaluation) return false;
        const overall = (rec?.evaluation_result as any)?.summary?.overall ?? "";
        return getOverallBucket(overall) === overallFilter;
      }

      return true;
    });

    // Sort by creation date (newest first)
    const sorted = filtered.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return convSortDir === "desc" ? tb - ta : ta - tb;
    });

    // Apply client-side pagination
    const startIndex = (clientPage - 1) * clientPageSize;
    const endIndex = startIndex + clientPageSize;
    const paginated = sorted.slice(startIndex, endIndex);

    return {
      filteredConversations: paginated,
      totalPages: Math.max(1, Math.ceil(sorted.length / clientPageSize)),
      totalFiltered: sorted.length
    };
  }, [allConversationsData, evalMap, qaFilter, reviewFilter, overallFilter, clientPage, clientPageSize, convSortDir]);


  // Use filtered data for display
  const conversationsData = filteredConversations;

  // Sheets data - eager loading for better UX
  const {
    data: sheetsList,
    isLoading: sheetsListLoading,
    isError: sheetsListError,
    error: sheetsError,
    refetch: refetchSheets,
    isRefetching: isRefetchingSheets
  } = useQuery({
    queryKey: ["sheets-list"],
    queryFn: async () => {
      console.log('🔄 Fetching sheets list...');
      const result = await getSheetsList();
      console.log('✅ Sheets loaded:', result);
      return result;
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000,     // Keep in cache for 30 minutes
    retry: (failureCount, error: any) => {
      console.log('❌ Sheets query failed:', error);
      // Don't retry on 401/403 (auth issues)
      if (error?.status === 401 || error?.status === 403) return false;
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: true,         // Always refetch when component mounts
    enabled: true,                // Always enabled
  });

  // Debug logging - move after sheetsList declaration
  useEffect(() => {
    console.log('🔄 Sheets state:', {
      loading: sheetsListLoading,
      error: sheetsListError,
      hasData: !!sheetsList,
      dataLength: sheetsList?.length || 0,
      refetching: isRefetchingSheets
    });
  }, [sheetsList, sheetsListLoading, sheetsListError, isRefetchingSheets]);

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

  // Helper functions for sheets dialog
  const formatDateForSheet = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const handleUpdateSheets = async () => {
    if (selectedSheets.length === 0 || selectedConversations.length === 0) {
      toast({ title: "Lỗi", description: "Vui lòng chọn sheet và ít nhất một conversation" });
      return;
    }

    setUpdateLoading(true);
    try {
      const requests: UpdateRequest[] = selectedSheets.map(sheetName => ({
        sheet_name: sheetName,
        records: selectedConversations.map(conv => {
          const convId = conv.conversation_id ?? String(conv.id);
          const evalObj: any = evalMap.get(convId)?.evaluation_result || null;

          // Get detailed note from evaluation
          const getDetailedNote = () => {
            if (!evalObj) return "Chưa có đánh giá";

            const override = qaOverrideSummary.get(convId);
            if (override) return override;

            const summary = evalObj.summary;
            if (!summary) return "Chưa có đánh giá chi tiết";

            // Create detailed note from available information
            const details = [];
            const metrics = [];

            // Add metrics with better formatting
            if (summary.overall) metrics.push(`Overall: ${summary.overall}`);
            if (summary.relevance) metrics.push(`Relevance: ${summary.relevance}`);
            if (summary.accuracy) metrics.push(`Accuracy: ${summary.accuracy}`);
            if (summary.helpfulness) metrics.push(`Helpfulness: ${summary.helpfulness}`);
            if (summary.safety) metrics.push(`Safety: ${summary.safety}`);

            // Add additional context from evaluation
            if (evalObj.feedback) details.push(`Feedback: ${evalObj.feedback}`);
            if (evalObj.notes) details.push(`Notes: ${evalObj.notes}`);

            // Combine metrics and details
            const result = [];
            if (metrics.length > 0) {
              result.push("QA Metrics: " + metrics.join(" | "));
            }
            if (details.length > 0) {
              result.push("Additional Info: " + details.join(" | "));
            }

            return result.length > 0 ? result.join(" | ") : "Chưa có đánh giá chi tiết";
          };

          // Get review note with fallback to QA summary
          const getReviewNote = () => {
            if (!evalObj) return "Chưa có đánh giá";

            const override = qaOverrideSummary.get(convId);
            if (override) return override;

            // If has review_note, use it
            if (evalObj.review_note) {
              return evalObj.review_note;
            }

            // If no review_note, use QA highlight and content as fallback
            const summary = evalObj.summary;
            if (summary) {
              const content = [];

              // Add QA highlights if available
              if (summary.highlights && summary.highlights.length > 0) {
                content.push(`🎯 QA Highlights:\n${summary.highlights.map(h => `  • ${h}`).join('\n')}`);
              }

              // Add overall summary if available
              if (summary.overall) {
                content.push(`📊 Overall: ${summary.overall}`);
              }

              // Add detailed metrics if available
              const metrics = [];
              if (summary.relevance) metrics.push(`Relevance: ${summary.relevance}`);
              if (summary.accuracy) metrics.push(`Accuracy: ${summary.accuracy}`);
              if (summary.helpfulness) metrics.push(`Helpfulness: ${summary.helpfulness}`);
              if (summary.safety) metrics.push(`Safety: ${summary.safety}`);

              if (metrics.length > 0) {
                content.push(`📈 Metrics: ${metrics.join(", ")}`);
              }

              // Add feedback and notes if available
              if (evalObj.feedback) content.push(`💬 Feedback: ${evalObj.feedback}`);
              if (evalObj.notes) content.push(`📝 Notes: ${evalObj.notes}`);

              if (content.length > 0) {
                return content.join("\n\n");
              }
            }

            return "Chưa có đánh giá";
          };

          return {
            ngay: formatDateForSheet(conv.created_at),
            nha_xe: `Bot ${conv.bot_id ?? "-"}`,
            conversation_id: convId,
            note: getReviewNote()
          };
        })
      }));

      await updateGoogleSheets(requests);
      toast({ title: "Thành công", description: `Đã cập nhật ${selectedConversations.length} records lên ${selectedSheets.length} sheets` });

      setSheetsDialogOpen(false);
      setSelectedSheets([]);
      setSelectedConversations([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lỗi cập nhật sheets";

      // Handle configuration error gracefully
      if (message.includes('not configured')) {
        toast({
          title: "Chưa cấu hình Google Sheets",
          description: "Vui lòng liên hệ admin để cấu hình Google Sheets credentials",
          variant: "destructive"
        });
      } else if (message.includes('Database configuration issue') || message.includes('doesn\'t exist') || message.includes('does not exist')) {
        toast({
          title: "Database chưa thiết lập",
          description: "Các bảng database cần thiết không tồn tại hoặc có vấn đề cấu hình. Vui lòng liên hệ admin.",
          variant: "destructive"
        });
      } else if (message.includes('Database not properly set up') || message.includes('Legacy conversation table not found')) {
        toast({
          title: "Database chưa thiết lập",
          description: "Bảng conversation không tồn tại. Vui lòng liên hệ admin để import dữ liệu legacy.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Lỗi", description: message, variant: "destructive" });
      }
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex relative">
        {/* Sidebar Overlay when collapsed on mobile */}
        {sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/20 z-10 md:hidden"
            onClick={() => setSidebarCollapsed(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`border-r bg-card h-screen ${sidebarCollapsed ? "w-16 -translate-x-0" : "w-64"} flex flex-col shadow-lg transition-all duration-300 ease-in-out fixed left-0 top-0 z-20 md:relative md:translate-x-0 overflow-hidden`}>
          {/* Logo */}
          <div className="p-4 border-b border-border">
            <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "space-x-3 justify-between"}`}>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg hover:from-primary/90 hover:to-secondary/90 transition-all duration-200 cursor-pointer"
                title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
              >
                <Brain className="h-6 w-6 text-white" />
              </button>
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
                title={sidebarCollapsed ? item.label : undefined}
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
            <div className={`space-y-2 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} w-full`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Users className="h-4 w-4 text-white" />
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">QA Admin</p>
                    <p className="text-xs text-muted-foreground">admin@biva.com</p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await logout();
                    navigate('/login');
                    toast({ title: "Đã đăng xuất", description: "Hẹn gặp lại!" });
                  } catch (error) {
                    toast({ title: "Lỗi", description: "Không thể đăng xuất", variant: "destructive" });
                  }
                }}
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : ''} text-muted-foreground hover:text-destructive hover:bg-destructive/10`}
              >
                <LogOut className="h-4 w-4" />
                {!sidebarCollapsed && <span className="ml-2">Đăng xuất</span>}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-1 transition-all duration-300 ease-in-out ${!sidebarCollapsed ? 'ml-64 md:ml-0' : 'ml-0'} overflow-auto`}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            {/* Dashboard */}
            <TabsContent value="dashboard" className="m-0 h-full overflow-auto">
              <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 min-h-full">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground">BIVA QA Agent Dashboard</h2>
                      <p className="text-sm text-muted-foreground">Quality Assurance & Analytics Overview</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-xs sm:text-sm">
                      <Activity className="h-3 w-3 mr-1" />
                      Live System
                    </Badge>
                  </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Bots</CardTitle>
                      <Brain className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{bots?.length || 0}</div>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        {botsLoading ? "Loading..." : "Active AI agents"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">QA Evaluations</CardTitle>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {(evalsData?.length || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Completed assessments
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Success Rate</CardTitle>
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {evalsData?.length ? Math.round((evalsData.filter(e => getOverallBucket((e.evaluation_result as any)?.summary?.overall || "") === "good").length / evalsData.length) * 100) : 0}%
                      </div>
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        Overall performance
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">Last 24h</CardTitle>
                      <Clock className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {evalsData ? evalsData.filter(e => {
                          // Since we don't have created_at in EvaluationRecord,
                          // we'll show a placeholder or calculate based on available data
                          return true; // For now, show all evaluations as "recent"
                        }).length : 0}
                      </div>
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Recent evaluations
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-card border-border hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Conversations
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Manage and evaluate customer conversations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => setActiveTab("conversations")} className="w-full">
                        Open Conversations
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        Bot Management
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Create and manage AI bots
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => setActiveTab("bots")} variant="outline" className="w-full">
                        Manage Bots
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Analytics
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        View detailed performance metrics
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        View Reports
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* System Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-foreground">System Status</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Current system health and performance indicators
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">API Response Time</span>
                          <span className="font-medium text-green-600">Fast</span>
                        </div>
                        <Progress value={85} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Database Health</span>
                          <span className="font-medium text-green-600">Good</span>
                        </div>
                        <Progress value={92} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">QA Queue</span>
                          <span className="font-medium text-blue-600">5 pending</span>
                        </div>
                        <Progress value={30} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Storage Usage</span>
                          <span className="font-medium text-yellow-600">65%</span>
                        </div>
                        <Progress value={65} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Bot Management */}
            <TabsContent value="bots" className="m-0 h-full overflow-auto">
              <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">Bot Management</h2>
                    <p className="text-sm text-muted-foreground">Manage and monitor your AI bots</p>
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

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Input placeholder="Search bots..." className="max-w-sm" />
                  <Select>
                    <SelectTrigger className="w-full sm:w-[180px]">
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
                                  setClientPage(1);
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
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center justify-center sm:justify-start gap-2">
                          <Button size="sm" variant="outline" disabled={botsPage <= 1} onClick={() => setBotsPage((p) => Math.max(1, p - 1))} className="text-xs sm:text-sm">Prev</Button>
                          <span className="text-xs text-muted-foreground">Page {botsPage} / {botsTotalPages}</span>
                          <Button size="sm" variant="outline" disabled={botsPage >= botsTotalPages} onClick={() => setBotsPage((p) => Math.min(botsTotalPages, p + 1))} className="text-xs sm:text-sm">Next</Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Go to"
                            inputMode="numeric"
                            className="w-16 sm:w-20 text-xs sm:text-sm"
                            value={botsPageInput}
                            onChange={(e) => setBotsPageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const n = parseInt(botsPageInput || "1", 10);
                                if (!isNaN(n) && n >= 1) setBotsPage(Math.min(Math.max(1, n), botsTotalPages));
                              }
                            }}
                          />
                          <Button size="sm" variant="outline" onClick={() => { const n = parseInt(botsPageInput || "1", 10); if (!isNaN(n) && n >= 1) setBotsPage(Math.min(Math.max(1, n), botsTotalPages)); }} className="text-xs sm:text-sm">Go</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Conversations */}
            <TabsContent value="conversations" className="m-0 h-full overflow-hidden">
              <div className="flex h-full">
                <div className="w-full h-screen border-r border-border p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-5 flex flex-col overflow-hidden">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-foreground">Conversations</h2>
                      </div>
                    </div>
                    {conversationsBotFilter != null && (
                      <div className="mb-4 p-2 rounded-md bg-accent/30 text-xs text-muted-foreground flex items-center justify-between">
                        <span>Filtered by bot index: {conversationsBotFilter}</span>
                        <Button variant="outline" size="sm" onClick={() => setConversationsBotFilter(null)}>Xoá</Button>
                      </div>
                    )}
                    <div className="mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                      <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedConvIds.length === 0) {
                            toast({
                              title: "Không có conversation nào được chọn",
                              description: "Vui lòng chọn ít nhất một conversation trước khi cập nhật sheets",
                              variant: "destructive"
                            });
                            return;
                          }

                          // Get selected conversations data from filtered results
                          const selectedConversationsData = (allConversationsData ?? [])
                            .filter(conv => selectedConvIds.includes(conv.conversation_id ?? String(conv.id)));

                          setSelectedConversations(selectedConversationsData);
                          setSheetsDialogOpen(true);
                        }}
                        className="text-xs sm:text-sm"
                      >
                        📊 Update Sheets
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setFiltersOpen((o) => !o)} className="text-xs sm:text-sm">
                        {filtersOpen ? "Thu gọn bộ lọc" : "Hiển thị bộ lọc"}
                      </Button>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        setConvPage(1);
                        setClientPage(1);
                        if (!convEndTs.trim()) {
                          setConvEndTs(nowTz7String());
                        } else {
                          refetchConversations();
                        }
                      }} className="text-xs sm:text-sm">Áp dụng</Button>
                    </div>
                    <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <CollapsibleContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
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
                        <Input placeholder="Lọc theo số điện thoại" className="w-full" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Bot</Label>
                        <Select value={conversationsBotFilter !== null ? String(conversationsBotFilter) : "__all__"} onValueChange={(v) => { setConversationsBotFilter(v && v !== "__all__" ? Number(v) : null); setConvPage(1); setClientPage(1); }}>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <div className="space-y-1">
                        <Label>Trạng thái QA</Label>
                        <Select value={qaFilter} onValueChange={(v) => { setQaFilter(v as any); setConvPage(1); setClientPage(1); }}>
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
                        <Select value={overallFilter} onValueChange={(v) => { setOverallFilter(v as any); setConvPage(1); setClientPage(1); }}>
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
                        <Select value={reviewFilter} onValueChange={(v) => { setReviewFilter(v as any); setConvPage(1); setClientPage(1); }}>
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
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-4">
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
                              setClientPage(1);
                              toast({ title: "Loaded", description: `Conversation ${convIdSearch.trim()} loaded` });
                            } catch (err) {
                              const m = err instanceof Error ? err.message : "Conversation not found";
                              toast({ title: "Load failed", description: m });
                            } finally {
                              setIsSearchingConvId(false);
                            }
                          }
                        }}
                        className="flex-1 text-xs sm:text-sm"
                      />
                      <div className="flex gap-2">
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
                              setClientPage(1);
                              toast({ title: "Loaded", description: `Conversation ${convIdSearch.trim()} loaded` });
                            } catch (err) {
                              const m = err instanceof Error ? err.message : "Conversation not found";
                              toast({ title: "Load failed", description: m });
                            } finally {
                              setIsSearchingConvId(false);
                            }
                          }}
                          className="text-xs sm:text-sm"
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
                          className="text-xs sm:text-sm"
                        >
                          {qaRunningIds.has(convIdSearch.trim()) ? "Running..." : "Run QA"}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-2">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedConvIds([])} className="text-xs sm:text-sm">Clear Selection</Button>
                        <Button size="sm" disabled={selectedConvIds.length === 0 || selectedConvIds.length > 20} onClick={() => setConfirmOpen(true)} className="text-xs sm:text-sm">RUN_QAS</Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="px-2 sm:px-3 py-1 text-xs sm:text-sm">Selected: {selectedConvIds.length}</Badge>
                        <span className="text-xs text-muted-foreground">(max 20)</span>
                      </div>
                    </div>

                    {/* Pagination moved to top */}
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <Button size="sm" variant="outline" disabled={clientPage <= 1} onClick={() => setClientPage((p) => Math.max(1, p - 1))} className="text-xs sm:text-sm">Prev</Button>
                        <span className="text-xs text-muted-foreground">Page {clientPage} of {totalPages}</span>
                        <Button size="sm" variant="outline" disabled={clientPage >= totalPages} onClick={() => setClientPage((p) => Math.min(totalPages, p + 1))} className="text-xs sm:text-sm">Next</Button>
                        <span className="text-xs text-muted-foreground ml-2">({totalFiltered} results)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Go to"
                          inputMode="numeric"
                          className="w-16 sm:w-20 text-xs sm:text-sm"
                          value={convPageInput}
                          onChange={(e) => setConvPageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const n = parseInt(convPageInput || "1", 10);
                              if (!isNaN(n) && n >= 1 && n <= totalPages) setClientPage(n);
                            }
                          }}
                        />
                        <Button size="sm" variant="outline" onClick={() => { const n = parseInt(convPageInput || "1", 10); if (!isNaN(n) && n >= 1 && n <= totalPages) setClientPage(n); }} className="text-xs sm:text-sm">Go</Button>
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
                            </>
                        );
                      })()}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Sheets Update Dialog */}
            <Dialog open={sheetsDialogOpen} onOpenChange={setSheetsDialogOpen}>
              <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Cập nhật Google Sheets</DialogTitle>
                  <DialogDescription>
                    Chọn sheets để cập nhật dữ liệu từ {selectedConversations.length} conversations đã chọn
                  </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                  {/* Left Panel - Sheets Selection */}
                  <div className="w-1/3 border-r pr-4 overflow-y-auto">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">Chọn Sheets</h3>
                        <div className="flex items-center gap-2">
                          {isRefetchingSheets && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <div className="animate-spin rounded-full h-3 w-3 border border-primary border-t-transparent"></div>
                              <span>Đang tải...</span>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchSheets()}
                            disabled={sheetsListLoading || isRefetchingSheets}
                            className="text-xs"
                          >
                            🔄 Làm mới
                          </Button>
                        </div>
                      </div>

                      {sheetsListLoading ? (
                        <div className="space-y-3">
                          <div className="text-xs text-muted-foreground mb-2">Loading sheets...</div>
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center space-x-2 p-2">
                              <div className="h-4 w-4 bg-muted animate-pulse rounded"></div>
                              <div className="h-4 flex-1 bg-muted animate-pulse rounded"></div>
                            </div>
                          ))}
                        </div>
                      ) : sheetsListError ? (
                        <div className="text-sm text-muted-foreground p-4 border border-destructive/20 rounded bg-destructive/5">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-destructive">⚠️ Lỗi kết nối Google Sheets</span>
                          </div>
                          <p className="text-xs mb-2">
                            {sheetsError?.message || "Không thể kết nối đến Google Sheets API"}
                          </p>
                          <p className="text-xs mb-3">Có thể do:</p>
                          <ul className="text-xs list-disc list-inside space-y-1 mb-3">
                            <li>Credentials không hợp lệ</li>
                            <li>Spreadsheet ID không đúng</li>
                            <li>Mất kết nối internet</li>
                            <li>API quota exceeded</li>
                          </ul>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchSheets()}
                            className="text-xs"
                          >
                            🔄 Thử lại
                          </Button>
                        </div>
                      ) : sheetsList && sheetsList.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-2">
                          <div className="text-xs text-muted-foreground mb-2">
                            Loaded {sheetsList.length} sheets
                          </div>
                          {sheetsList.map((sheet) => (
                            <div key={sheet.sheetId} className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded transition-colors">
                              <input
                                type="checkbox"
                                id={`sheet-${sheet.sheetId}`}
                                checked={selectedSheets.includes(sheet.title)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSheets(prev => [...prev, sheet.title]);
                                  } else {
                                    setSelectedSheets(prev => prev.filter(s => s !== sheet.title));
                                  }
                                }}
                                className="rounded border-muted-foreground/30"
                              />
                              <label
                                htmlFor={`sheet-${sheet.sheetId}`}
                                className="text-sm cursor-pointer flex-1 select-none"
                                title={`Sheet ID: ${sheet.sheetId}`}
                              >
                                <div className="font-medium">{sheet.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  Sheet ID: {sheet.sheetId}
                                </div>
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground p-4 border border-dashed rounded">
                          <p className="mb-2">⚠️ Không tìm thấy sheets nào</p>
                          <p className="text-xs mb-2">Có thể do:</p>
                          <ul className="text-xs list-disc list-inside space-y-1 mb-3">
                            <li>Spreadsheet không tồn tại</li>
                            <li>Không có quyền truy cập</li>
                            <li>Spreadsheet trống</li>
                          </ul>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchSheets()}
                            className="text-xs"
                          >
                            🔄 Thử lại
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Panel - Conversations Table */}
                  <div className="flex-1 pl-4 overflow-y-auto">
                    <div className="mb-4 h-full">
                      <h3 className="font-semibold mb-2">
                        Conversations đã chọn ({selectedConversations.length})
                      </h3>

                      {selectedConversations.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden h-[calc(100%-2rem)]">
                          <div className="overflow-auto h-full">
                            <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[180px]">Conversation ID</TableHead>
                                <TableHead className="w-[150px]">QA Highlight</TableHead>
                                <TableHead className="flex-1">Review Note</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedConversations.map((conv) => {
                                const convId = conv.conversation_id ?? String(conv.id);
                                const evalObj: any = evalMap.get(convId)?.evaluation_result || null;
                                const qaOverall = (() => {
                                  const override = qaOverrideSummary.get(convId);
                                  if (override) return override;
                                  const summary = evalObj?.summary || null;
                                  return summary?.overall ?? "Chưa đánh giá";
                                })();

                                return (
                                  <TableRow key={convId} className={evalObj ? "border-l-4" : ""} style={evalObj ? { borderLeftColor: qaOverall.includes("Good") || qaOverall.includes("tốt") ? "#10b981" : qaOverall.includes("Warn") || qaOverall.includes("trung bình") ? "#f59e0b" : qaOverall.includes("Bad") || qaOverall.includes("kém") ? "#ef4444" : "#6b7280" } : {}}>
                                    <TableCell className="font-mono text-sm bg-muted/20">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">ID:</span>
                                        <span className="font-semibold">{convId}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      <div className="space-y-1">
                                        <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getOverallClasses(qaOverall)}`}>
                                          <div className={`w-2 h-2 rounded-full mr-2 ${qaOverall.includes("Good") || qaOverall.includes("tốt") ? "bg-emerald-500" : qaOverall.includes("Warn") || qaOverall.includes("trung bình") ? "bg-amber-500" : qaOverall.includes("Bad") || qaOverall.includes("kém") ? "bg-rose-500" : "bg-gray-400"}`}></div>
                                          {qaOverall}
                                        </div>
                                        {evalObj && evalObj.summary?.highlights && evalObj.summary.highlights.length > 0 && (
                                          <div className="text-xs text-muted-foreground">
                                            <div className="text-xs font-medium mb-1">Highlights:</div>
                                            <ul className="space-y-1">
                                              {evalObj.summary.highlights.slice(0, 2).map((highlight: string, index: number) => (
                                                <li key={index} className="text-xs text-muted-foreground leading-tight">
                                                  • {highlight}
                                                </li>
                                              ))}
                                              {evalObj.summary.highlights.length > 2 && (
                                                <li className="text-xs text-muted-foreground italic">
                                                  +{evalObj.summary.highlights.length - 2} more...
                                                </li>
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                        {evalObj && (
                                          <div className="text-xs text-muted-foreground">
                                            {evalObj.reviewed && <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">Đã review</span>}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-3 rounded border-l-2 border-primary/20 min-h-[80px]">
                                        {evalObj && evalObj.review_note ? (
                                          <div className="text-foreground">{evalObj.review_note}</div>
                                        ) : evalObj && evalObj.summary?.highlights && evalObj.summary.highlights.length > 0 ? (
                                          <div className="text-muted-foreground">
                                            <div className="font-medium text-foreground mb-2">🎯 QA Highlights:</div>
                                            <ul className="space-y-1">
                                              {evalObj.summary.highlights.map((highlight: string, index: number) => (
                                                <li key={index} className="text-xs leading-relaxed">
                                                  • {highlight}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ) : evalObj && evalObj.summary?.overall ? (
                                          <div className="text-muted-foreground">
                                            <div className="font-medium text-foreground mb-2">📊 Summary:</div>
                                            <div className="text-sm">{evalObj.summary.overall}</div>
                                          </div>
                                        ) : (
                                          <div className="text-muted-foreground">Chưa có đánh giá</div>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground p-4 border border-dashed rounded">
                          <p className="mb-2">ℹ️ Chưa có conversation nào được chọn</p>
                          <p className="text-xs">Vui lòng chọn các conversation từ bảng Conversations trước khi cập nhật sheets.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex-shrink-0 border-t pt-4">
                  <Button variant="outline" onClick={() => setSheetsDialogOpen(false)}>
                    Hủy
                  </Button>
                  <Button
                    onClick={handleUpdateSheets}
                    disabled={updateLoading || selectedSheets.length === 0 || selectedConversations.length === 0}
                  >
                    {updateLoading ? "Đang cập nhật..." : `Cập nhật ${selectedConversations.length} records`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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