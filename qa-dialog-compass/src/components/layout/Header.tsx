import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { LogOut, User, Settings, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { getMyPrompt, updateMyPrompt } from '@/lib/evaluationsApi';
import { useToast } from '@/components/ui/use-toast';

export const Header: React.FC = () => {
  const { user, logout } = useAuth() || { user: null, logout: async () => {} };
  const { toast } = useToast();

  const [promptOpen, setPromptOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState('');

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const openPromptEditor = async () => {
    setPromptOpen(true);
    setLoading(true);
    try {
      const res = await getMyPrompt();
      setPrompt(res.prompt || '');
    } catch (e: any) {
      toast({ title: 'Tải prompt thất bại', description: e?.message || 'Vui lòng thử lại' });
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async () => {
    setSaving(true);
    try {
      const res = await updateMyPrompt(prompt);
      setPrompt(res.prompt || '');
      toast({ title: 'Đã lưu prompt' });
      setPromptOpen(false);
    } catch (e: any) {
      toast({ title: 'Lưu prompt thất bại', description: e?.message || 'Vui lòng thử lại' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <span className="hidden font-bold sm:inline-block">
              BIVA Auto QA
            </span>
          </a>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Add search or other content here if needed */}
          </div>
          <nav className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => (window.location.href = '/prompt')} className="hidden md:inline-flex">
              <FileText className="mr-2 h-4 w-4" />
              Chỉnh sửa Prompt QA
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-3 hover:bg-accent/50 transition-colors">
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 shadow-lg border-0 bg-popover/95 backdrop-blur-sm" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.username}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Thông tin cá nhân</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Cài đặt</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => (window.location.href = '/prompt')}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Chỉnh sửa Prompt QA</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
      <Dialog open={promptOpen} onOpenChange={(o) => !saving && setPromptOpen(o)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa Prompt QA của bạn</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Prompt này sẽ được dùng khi bạn chạy QA. Nếu không đặt, hệ thống dùng mặc định từ qa.md.</p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={loading ? 'Đang tải...' : 'Nhập prompt tại đây'}
              className="min-h-[320px] font-mono"
              disabled={loading || saving}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptOpen(false)} disabled={saving}>Hủy</Button>
            <Button onClick={savePrompt} disabled={saving || loading}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
};
