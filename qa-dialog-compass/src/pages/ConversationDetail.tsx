import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getConversation, listSpans } from "@/lib/conversationsApi";
import { getEvaluation, runQAEvaluations } from "@/lib/evaluationsApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type ConversationDetailProps = {
  id?: string;
};

const ConversationDetail = ({ id: idProp }: ConversationDetailProps) => {
  const { id: routeId } = useParams<{ id: string }>();
  const id = idProp ?? routeId;
  const queryClient = useQueryClient();
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
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Conversation {id}</div>
        <div className="flex gap-2">
          <Link to="/">
            <Button variant="outline">Back</Button>
          </Link>
          <Button
            onClick={async () => {
              if (!id) return;
              try {
                await runQAEvaluations({ conversation_ids: [id] });
                await queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: id }] });
                toast({ title: "QA started", description: "Evaluation will refresh when ready." });
              } catch (e) {
                const m = e instanceof Error ? e.message : "Failed to run QA";
                toast({ title: "Run QA failed", description: m });
              }
            }}
          >
            Run QA
          </Button>
        </div>
      </div>

      <Card className="p-4">
        {convLoading ? (
          <div className="text-sm text-muted-foreground">Loading conversation...</div>
        ) : conv ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-foreground">Conversation ID:</span> {conv.conversation_id ?? String(conv.id)}</div>
            <div><span className="text-foreground">Customer phone:</span> {conv.customer_phone ?? "-"}</div>
            <div><span className="text-foreground">Bot index:</span> {conv.bot_id ?? "-"}</div>
            <div><span className="text-foreground">Created:</span> {conv.created_at ? new Date(conv.created_at).toLocaleString() : ""}</div>
          </div>
        ) : (
          <div className="text-sm text-destructive">Conversation not found</div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Audio</div>
          <div className="flex items-center gap-2 mb-3">
            <Button size="sm" variant="outline" disabled={!id || audioLoading} onClick={async () => {
              if (!id) return;
              try {
                setAudioLoading(true);
                const url = await getAudioUrl(id);
                setAudioUrl(url);
              } finally {
                setAudioLoading(false);
              }
            }}>
              {audioLoading ? "Đang tải audio..." : "Lấy & nghe audio"}
            </Button>
            {audioUrl && <span className="text-xs text-muted-foreground truncate" title={audioUrl}>{audioUrl}</span>}
          </div>
          {audioUrl && (
            <div className="mb-4">
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}

          <div className="text-sm font-medium mb-2">Chat logs</div>
          {spansLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : spansError ? (
            <div className="text-sm text-destructive">Failed to load</div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-auto">
              {(spans ?? []).map((s) => (
                <div key={s.id} className={`flex ${s.role === "assistant" ? "justify-end" : s.role === "user" ? "justify-start" : "justify-center"}`}>
                  <div className={`max-w-[75%] rounded-lg p-3 shadow-sm ${s.role === "assistant" ? "bg-primary text-primary-foreground rounded-br-lg" : s.role === "user" ? "bg-muted text-foreground rounded-bl-lg" : "bg-accent/30 text-foreground"}`}>
                    <div className="mb-1 text-[11px] opacity-80">{s.role} • turn {s.turn_idx} • {new Date(s.created_at).toLocaleString()}</div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">QA details</div>
          {evalLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : !evalData ? (
            <div className="text-sm text-muted-foreground">No evaluation found.</div>
          ) : (
            (() => {
              const er: any = (evalData as any).evaluation_result || {};
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
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${getOverallClasses(overall)}`}>{overall || "n/a"}</span>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                      {Object.entries(counts).map(([k, v]) => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-accent/40 text-foreground">{k}: {String(v)}</span>
                      ))}
                    </div>
                  </div>
                  {highlights.length > 0 && (
                    <div className="text-xs">
                      <div className="mb-1 text-muted-foreground">Highlights</div>
                      <ul className="list-disc pl-4 space-y-1">
                        {highlights.map((h, i) => (
                          <li key={i} className="text-foreground">{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Object.keys(stats).length > 0 && (
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
                  )}
                  {nhan_xet && (
                    <div className="text-xs space-y-2">
                      {nhan_xet.topline && (
                        <div>
                          <div className="mb-1 text-muted-foreground">Tổng quan</div>
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{String(nhan_xet.topline)}</p>
                        </div>
                      )}
                      {Array.isArray(nhan_xet.strengths) && nhan_xet.strengths.length > 0 && (
                        <div>
                          <div className="mb-1 text-muted-foreground">Điểm mạnh</div>
                          <ul className="list-disc pl-4 space-y-1">
                            {nhan_xet.strengths.map((s: string, i: number) => (
                              <li key={i} className="text-foreground">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(nhan_xet.issues) && nhan_xet.issues.length > 0 && (
                        <div>
                          <div className="mb-1 text-muted-foreground">Vấn đề</div>
                          <ul className="list-disc pl-4 space-y-1">
                            {nhan_xet.issues.map((s: string, i: number) => (
                              <li key={i} className="text-foreground">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(nhan_xet.next_actions) && nhan_xet.next_actions.length > 0 && (
                        <div>
                          <div className="mb-1 text-muted-foreground">Hành động tiếp theo</div>
                          <ul className="list-disc pl-4 space-y-1">
                            {nhan_xet.next_actions.map((s: string, i: number) => (
                              <li key={i} className="text-foreground">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {errors.length > 0 && (
                    <div className="text-xs">
                      <div className="mb-1 text-muted-foreground">Errors ({errors.length})</div>
                      <div className="space-y-2">
                        {errors.map((e, i) => (
                          <div key={i} className="rounded border border-border p-2">
                            <div className="mb-1 text-muted-foreground">turn {e.turn} • {e.type} • {e.severity}</div>
                            {e.suggestion && <div className="text-foreground whitespace-pre-wrap">{e.suggestion}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <details className="rounded border border-border p-2">
                    <summary className="text-xs cursor-pointer text-muted-foreground">Raw</summary>
                    <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(er, null, 2)}</pre>
                  </details>
                </div>
              );
            })()
          )}
        </Card>
      </div>
    </div>
  );
};

export default ConversationDetail;


