import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getConversation, listSpans } from "@/lib/conversationsApi";
import { getEvaluation, runQAEvaluations, updateEvaluationReview } from "@/lib/evaluationsApi";
import { useQACompletionRefresh } from "@/hooks/use-auto-refresh";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ConversationDetailProps = {
  id?: string;
};

const ConversationDetail = ({ id: idProp }: ConversationDetailProps) => {
  const { id: routeId } = useParams<{ id: string }>();
  const id = idProp ?? routeId;
  const queryClient = useQueryClient();
  const { refreshAfterQA } = useQACompletionRefresh();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState<boolean>(false);
  const getAudioUrl = async (cid: string): Promise<string | null> => {
    try {
      const resp = await fetch(`https://apicms.bivaapp.com/api/audio/${cid}`);
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data: any = await resp.json();
        return (
          data?.url ||
          data?.audio_url ||
          data?.data?.url ||
          null
        );
      } else if (ct.includes("text/")) {
        const txt = await resp.text();
        const m = txt.match(/https?:\/\/[^\s\"]+/);
        return m ? m[0] : null;
      } else {
        // If server redirects to the audio file, resp.url may be the final URL
        return resp.url || null;
      }
    } catch (e) {
      return null;
    }
  };

  const { data: conv, isLoading: convLoading } = useQuery({
    queryKey: ["conversation", { id }],
    queryFn: () => getConversation(id!),
    enabled: !!id,
  });

  const { data: spans, isLoading: spansLoading, isError: spansError } = useQuery({
    queryKey: ["spans", { conversation_id: id }],
    queryFn: () => listSpans(id!),
    enabled: !!id,
  });

  const { data: evalData, isLoading: evalLoading } = useQuery({
    queryKey: ["evaluation", { conversation_id: id }],
    queryFn: () => getEvaluation(id!),
    enabled: !!id,
    // Don't error toast on 404
    meta: { suppressToast: true },
    staleTime: 30 * 1000, // Reduce to 30 seconds for faster refresh
    gcTime: 5 * 60 * 1000,
    refetchInterval: !!id ? 30000 : false, // Poll every 30s
  });

  // Draft state for review; only save when clicking the save button
  const [reviewedDraft, setReviewedDraft] = useState<boolean>(false);
  const [reviewNoteDraft, setReviewNoteDraft] = useState<string>("");
  useEffect(() => {
    const rv = (evalData as any)?.reviewed ?? false;
    const rn = (evalData as any)?.review_note ?? "";
    setReviewedDraft(!!rv);
    setReviewNoteDraft(rn ?? "");
  }, [evalData]);

  // Confirm dialog state for Run QA
  const [runConfirmOpen, setRunConfirmOpen] = useState<boolean>(false);
  const [runConfirmLoading, setRunConfirmLoading] = useState<boolean>(false);
  const [isRunningQA, setIsRunningQA] = useState<boolean>(false);

  // Auto-fetch audio on load/id change
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!id) return;
      try {
        setAudioLoading(true);
        const url = await getAudioUrl(id);
        if (!cancelled) setAudioUrl(url);
      } finally {
        if (!cancelled) setAudioLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant={reviewedDraft ? "secondary" : "outline"}
            size="sm"
            onClick={() => setReviewedDraft((v) => !v)}
          >
            {reviewedDraft ? "Đã review" : "Chưa review"}
          </Button>
          <div className="text-lg font-semibold">Conversation {id}</div>
        </div>
        <div className="flex gap-2">
          <Link to="/">
            <Button variant="outline">Back</Button>
          </Link>
          <Button onClick={() => setRunConfirmOpen(true)} disabled={isRunningQA}>
            {isRunningQA ? "Đang chạy QA" : "Run QA"}
          </Button>
        </div>
      </div>

      {convLoading ? (
        <div className="text-sm text-muted-foreground">Loading conversation...</div>
      ) : conv ? (
        <></>
      ) : (
        <div className="text-sm text-destructive">Conversation not found</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-base font-semibold mb-2 text-foreground">Audio</div>
          <div className="mb-3">
            {audioLoading && <div className="text-sm text-foreground/80">Đang tải audio...</div>}
            {audioUrl && (
              <div className="mb-4">
                <audio controls src={audioUrl} className="w-full" />
              </div>
            )}
          </div>

          <div className="text-base font-semibold mb-2 text-foreground">Chat logs</div>
          {spansLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : spansError ? (
            <div className="text-sm text-destructive">Failed to load</div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-auto">
              {(spans ?? []).map((s) => (
                <div key={s.id} className={`flex ${s.role === "assistant" ? "justify-end" : s.role === "user" ? "justify-start" : "justify-center"}`}>
                  <div className={`max-w-[75%] rounded-lg p-3 shadow-sm ${s.role === "assistant" ? "bg-primary/15 text-foreground border border-primary/30 rounded-br-lg" : s.role === "user" ? "bg-muted text-foreground rounded-bl-lg" : "bg-accent/30 text-foreground"}`}>
                    <div className="mb-1 text-xs text-foreground/80">{s.role} • turn {s.turn_idx} • {new Date(s.created_at).toLocaleString()}</div>
                    <div className="whitespace-pre-wrap text-base leading-relaxed">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-base font-semibold text-foreground">QA details</div>
          {evalLoading ? (
            <div className="text-sm text-foreground/80">Loading...</div>
          ) : !evalData ? (
            <div className="text-sm text-foreground/80">No evaluation found.</div>
          ) : (
            (() => {
              const er: any = (evalData as any).evaluation_result || {};
              const reviewed = (evalData as any).reviewed ?? false;
              const reviewNote = (evalData as any).review_note ?? "";
              const summary = er.summary || {};
              const overall: string = summary.overall ?? "";
              const highlights: string[] = Array.isArray(summary.highlights) ? summary.highlights : [];
              const counts = summary.counts || {};
              const stats = er.stats || {};
              const nhan_xet = er.nhan_xet || {};
              const errors: any[] = Array.isArray(er.errors) ? er.errors : [];
              const getOverallClasses = (t: string) => {
                const s = String(t || "").toLowerCase();
                if (s.includes("fail") || s.includes("lỗi") || s.includes("error")) return "bg-red-500/15 text-red-600";
                if (s.includes("pass") || s.includes("tốt") || s.includes("ok") || s.includes("good")) return "bg-green-500/15 text-green-600";
                if (s.includes("warn") || s.includes("medium") || s.includes("average") || s.includes("cảnh báo")) return "bg-yellow-500/15 text-yellow-700";
                return "bg-muted text-foreground";
              };
              return (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Phần Nhận xét</div>
                    <div className="space-y-1">
                      <Label className="text-sm">Ghi chú</Label>
                      <Textarea value={reviewNoteDraft} onChange={(e) => setReviewNoteDraft(e.target.value)} placeholder="Nhập ghi chú..." />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={async () => {
                        try {
                          // Always mark as reviewed on save
                          if (!reviewedDraft) setReviewedDraft(true);
                          await updateEvaluationReview(id!, { reviewed: true, review_note: reviewNoteDraft });
                          await queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: id }] });
                          await queryClient.invalidateQueries({ queryKey: ["evaluations"] });
                          toast({ title: "Đã lưu review" });
                        } catch (err) {
                          const m = err instanceof Error ? err.message : "Lưu review thất bại";
                          toast({ title: "Lỗi", description: m });
                        }
                      }}
                    >
                      Lưu
                    </Button>
                  </div>
                  {/* <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${getOverallClasses(overall)}`}>{overall || "n/a"}</span>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                      {Object.entries(counts).map(([k, v]) => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-accent/40 text-foreground">{k}: {String(v)}</span>
                      ))}
                    </div>
                  </div> */}
                  {highlights.length > 0 && (
                    <div className="text-sm">
                      <div className="mb-1 text-foreground/80">Highlights</div>
                      <ul className="list-disc pl-4 space-y-1">
                        {highlights.map((h, i) => (
                          <li key={i} className="text-foreground">{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* {Object.keys(stats).length > 0 && (
                    <div className="text-xs">
                      <div className="mb-1 text-muted-foreground">Stats</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(stats).map(([k, v]) => (
                          <div key={k} className="rounded border border-border p-2">
                            <div className="text-muted-foreground mb-0.5">{k}</div>
                            <div className="text-foreground break-words">{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )} */}
                  {nhan_xet && (
                    <div className="text-sm space-y-2">
                      {nhan_xet.topline && (
                        <div>
                          <div className="mb-1 text-foreground/80">Tổng quan</div>
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{String(nhan_xet.topline)}</p>
                        </div>
                      )}
                      {Array.isArray(nhan_xet.strengths) && nhan_xet.strengths.length > 0 && (
                        <div>
                          <div className="mb-1 text-foreground/80">Điểm mạnh</div>
                          <ul className="list-disc pl-4 space-y-1">
                            {nhan_xet.strengths.map((s: string, i: number) => (
                              <li key={i} className="text-foreground">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(nhan_xet.issues) && nhan_xet.issues.length > 0 && (
                        <div>
                          <div className="mb-1 text-foreground/80">Vấn đề</div>
                          <ul className="list-disc pl-4 space-y-1">
                            {nhan_xet.issues.map((s: string, i: number) => (
                              <li key={i} className="text-foreground">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* {Array.isArray(nhan_xet.next_actions) && nhan_xet.next_actions.length > 0 && (
                        <div>
                          <div className="mb-1 text-foreground/80">Hành động tiếp theo</div>
                          <ul className="list-disc pl-4 space-y-1">
                            {nhan_xet.next_actions.map((s: string, i: number) => (
                              <li key={i} className="text-foreground">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )} */}
                    </div>
                  )}
                  {/* {errors.length > 0 && (
                    <div className="text-sm">
                      <div className="mb-1 text-foreground/80">Errors ({errors.length})</div>
                      <div className="space-y-2">
                        {errors.map((e, i) => (
                          <div key={i} className="rounded border border-border p-2">
                            <div className="mb-1 text-foreground/80">turn {e.turn} • {e.type} • {e.severity}</div>
                            {e.suggestion && <div className="text-foreground whitespace-pre-wrap leading-relaxed">{e.suggestion}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )} */}
                  {/* <details className="rounded border border-border p-2">
                    <summary className="text-xs cursor-pointer text-muted-foreground">Raw</summary>
                    <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(er, null, 2)}</pre>
                  </details> */}
                </div>
              );
            })()
          )}
        </Card>
      </div>
      {id && (
        <Dialog open={runConfirmOpen} onOpenChange={(open) => !runConfirmLoading && setRunConfirmOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xác nhận chạy QA</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">Bạn có chắc muốn chạy QA cho hội thoại {id}?</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRunConfirmOpen(false)} disabled={runConfirmLoading}>Hủy</Button>
              <Button
                onClick={async () => {
                  if (!id) return;
                  setRunConfirmLoading(true);
                  setRunConfirmOpen(false);
                  setIsRunningQA(true);
                  try {
                    await runQAEvaluations({ conversation_ids: [id] });

                    // Use the new refresh hook for comprehensive updates
                    await refreshAfterQA([id]);

                    toast({ title: "QA started", description: "Evaluation sẽ tự động cập nhật khi hoàn thành." });
                  } catch (e) {
                    const m = e instanceof Error ? e.message : "Failed to run QA";
                    toast({ title: "Run QA failed", description: m });
                  } finally {
                    setRunConfirmLoading(false);
                    setIsRunningQA(false);
                  }
                }}
                disabled={runConfirmLoading}
              >
                {runConfirmLoading ? "Đang chạy..." : "Run"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ConversationDetail;


