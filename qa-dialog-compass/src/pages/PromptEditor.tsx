import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getMyPrompt, updateMyPrompt, deleteMyPrompt } from '@/lib/evaluationsApi';
import { useToast } from '@/components/ui/use-toast';

const PromptEditor = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await getMyPrompt();
        if (!cancelled) setPrompt(res.prompt || '');
      } catch (e: any) {
        toast({ title: 'Tải prompt thất bại', description: e?.message || 'Vui lòng thử lại' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateMyPrompt(prompt);
      setPrompt(res.prompt || '');
      toast({ title: 'Đã lưu prompt' });
    } catch (e: any) {
      toast({ title: 'Lưu prompt thất bại', description: e?.message || 'Vui lòng thử lại' });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setSaving(true);
    try {
      const res = await deleteMyPrompt();
      setPrompt(res.prompt || '');
      toast({ title: 'Đã làm mới prompt về mặc định' });
    } catch (e: any) {
      toast({ title: 'Làm mới prompt thất bại', description: e?.message || 'Vui lòng thử lại' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-6">
        <Card>
          <CardHeader>
            <CardTitle>Chỉnh sửa Prompt QA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Prompt này sẽ được dùng khi bạn chạy QA. Nếu để trống, hệ thống dùng mặc định từ qa.md.</p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={loading ? 'Đang tải...' : 'Nhập prompt tại đây'}
                className="min-h-[480px] font-mono"
                disabled={loading || saving}
              />
              <div className="flex justify-between gap-2">
                <Button variant="secondary" onClick={handleRefresh} disabled={saving || loading}>Làm mới (dùng mặc định)</Button>
                <Button variant="outline" onClick={() => window.history.back()} disabled={saving}>Quay lại</Button>
                <Button onClick={handleSave} disabled={saving || loading}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PromptEditor;


