import React from 'react';
import { STATUS_LABELS } from '../types';
import type { SaleStatus } from '../types';
import { 
  FileText, 
  Send, 
  Search, 
  CheckCircle2, 
  Zap, 
  XCircle 
} from 'lucide-react';

const STATUS_CONFIG: Record<SaleStatus, { color: string; icon: any }> = {
    rascunho: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: FileText },
    enviada: { color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Send },
    em_validacao: { color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Search },
    aprovada: { color: 'bg-green-50 text-green-600 border-green-100', icon: CheckCircle2 },
    instalada: { color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: Zap },
    cancelada: { color: 'bg-red-50 text-red-600 border-red-100', icon: XCircle },
};

export function StatusBadge({ status }: { status: SaleStatus }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho;
    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${config.color} shadow-sm`}>
            <Icon size={12} strokeWidth={2.5} />
            {STATUS_LABELS[status]}
        </span>
    );
}
