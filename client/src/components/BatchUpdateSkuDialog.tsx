import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface BatchUpdateSkuDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
}

export default function BatchUpdateSkuDialog({
  isOpen,
  onClose,
  selectedIds,
  onSuccess,
}: BatchUpdateSkuDialogProps) {
  const [dailySales, setDailySales] = useState('');
  const [isDiscontinued, setIsDiscontinued] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const batchUpdateMutation = trpc.sku.batchUpdate.useMutation({
    onSuccess: () => {
      toast.success(`成功修改 ${selectedIds.length} 个 SKU`);
      handleClose();
      onSuccess();
    },
    onError: (error) => {
      toast.error(`修改失败: ${error.message}`);
    },
  });

  const handleClose = () => {
    setDailySales('');
    setIsDiscontinued(false);
    setHasChanges(false);
    onClose();
  };

  const handleDailySalesChange = (value: string) => {
    setDailySales(value);
    setHasChanges(true);
  };

  const handleDiscontinuedChange = (checked: boolean) => {
    setIsDiscontinued(checked);
    setHasChanges(true);
  };

  const handleSubmit = async () => {
    if (!hasChanges) {
      toast.error('请至少修改一个字段');
      return;
    }

    const updates: any = {};
    if (dailySales) {
      updates.dailySales = dailySales;
    }
    updates.isDiscontinued = isDiscontinued;

    batchUpdateMutation.mutate({
      ids: selectedIds,
      updates,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>批量修改 SKU ({selectedIds.length} 个)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dailySales">日销量（可选）</Label>
            <Input
              id="dailySales"
              placeholder="输入日销量"
              value={dailySales}
              onChange={(e) => handleDailySalesChange(e.target.value)}
              type="number"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isDiscontinued">是否淘汰</Label>
            <Switch
              id="isDiscontinued"
              checked={isDiscontinued}
              onCheckedChange={handleDiscontinuedChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || batchUpdateMutation.isPending}
          >
            {batchUpdateMutation.isPending ? '修改中...' : '确认修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
